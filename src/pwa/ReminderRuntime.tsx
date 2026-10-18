import { useEffect, useRef } from 'react';
import { useItems, useSetting } from '@/hooks/useData';
import { itemRepo, reminderFailureRepo, reminderLogRepo } from '@/db/repository';
import { patchItem, pruneItemReminders, toggleDone } from '@/domain/itemActions';
import { newId } from '@/lib/id';
import { upcomingReminders, withSnooze } from '@/domain/reminders';
import { useUiStore } from '@/store/useUiStore';
import { DEFAULT_SETTINGS, type AppSettings, type Item, type Reminder } from '@/types';
import { notificationPermission } from './notifications';
import { LOOKBACK_MS, deliver, deliverDigest, undeliveredCount } from './delivery';

interface TickGate {
  /** Resolves the first time the gate is opened. */
  settled: Promise<void>;
  /** Idempotent: later calls are no-ops, so only the first opening is observed. */
  open(): void;
}

function createTickGate(): TickGate {
  let resolve!: () => void;
  const settled = new Promise<void>((done) => {
    resolve = done;
  });
  let opened = false;
  return {
    settled,
    open() {
      if (opened) return;
      opened = true;
      resolve();
    },
  };
}

/**
 * Boot maintenance reads storage that may be unavailable. The boot already reports a storage
 * failure once, so a rejected prune must be swallowed here rather than becoming an unhandled
 * rejection or a repeated toast.
 */
function ignorePruneFailure(pass: () => Promise<unknown>): void {
  void pass().catch(() => {});
}

/**
 * Drives reminder delivery. Runs on load, on visibility change, and every 60s.
 * There is no push server; this is best-effort while the tab/PWA is alive.
 */
export function ReminderRuntime() {
  const items = useItems();
  const settings = useSetting<AppSettings>('app', DEFAULT_SETTINGS);
  const notifyEnabled = settings.notificationsEnabled;
  const pushToast = useUiStore((s) => s.pushToast);
  const openEditor = useUiStore((s) => s.openEditor);
  // Holds the boot prune back until a tick that can actually deliver something has settled.
  const bootGate = useRef(createTickGate());
  const tickedItems = useRef<Item[] | null>(null);
  // An in-flight tick and an effect rebuild (StrictMode, or a live-query emission) can
  // otherwise both pass `deliver`'s dedupe check before either has recorded, notifying twice.
  const ticking = useRef(false);
  // The undelivered count already reported, so a still-pending reminder toasts once rather
  // than on every 60s tick; reset to 0 whenever the pending set empties.
  const failuresReported = useRef(0);
  // One report at a time: the check runs off the tick's critical path, so two ticks can
  // otherwise both read the same stale count and each push the toast.
  const reporting = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const reportUndelivered = async () => {
      if (document.hidden || reporting.current) return;
      reporting.current = true;
      try {
        const pending = await undeliveredCount();
        if (pending === failuresReported.current) return;
        failuresReported.current = pending;
        if (pending === 0) return;
        pushToast({
          message:
            pending === 1
              ? '1 reminder passed its time undelivered'
              : `${pending} reminders passed their time undelivered`,
          tone: 'error',
          duration: 10000,
        });
      } catch {
        // Storage unavailable: the boot already reported it once, and the count is retried on
        // the next visible tick, so this pass must not add an unhandled rejection or a toast.
      } finally {
        reporting.current = false;
      }
    };

    const tick = async () => {
      if (cancelled || ticking.current) return;
      ticking.current = true;
      try {
        const now = new Date();
        const nowMs = now.getTime();

        const due = upcomingReminders(
          items,
          new Date(nowMs - LOOKBACK_MS),
          new Date(nowMs + 30_000),
        ).filter((scheduled) => scheduled.fireAt <= nowMs + 30_000);

        let undelivered = false;
        for (const scheduled of due) {
          const title = scheduled.occurrence.title || 'Reminder';
          const timeLabel = scheduled.occurrence.start?.includes('T')
            ? scheduled.occurrence.start.slice(11, 16)
            : scheduled.occurrence.occKey;
          const delivered = await deliver(
            title,
            `${timeLabel} · ${scheduled.occKey}`,
            scheduled.item.id,
            `${scheduled.occKey}::${scheduled.reminder.id}`,
            scheduled.occKey,
            'info',
            { notifyEnabled },
          );
          if (!delivered) undelivered = true;
        }

        // Daily digest
        if (settings.digestEnabled) {
          const [h, m] = settings.digestTime.split(':').map(Number);
          const digestAt = new Date(now);
          digestAt.setHours(h || 8, m || 0, 0, 0);
          if (nowMs >= digestAt.getTime() && nowMs - digestAt.getTime() < LOOKBACK_MS) {
            await deliverDigest(items, now, { notifyEnabled });
          }
        }

        // A reminder that could not be delivered this tick is the trigger; a visible tick
        // also surfaces any that already aged out of the retry window. Not awaited, so the
        // report cannot lengthen the tick and make an effect rebuild drop its own tick.
        if (undelivered || !document.hidden) void reportUndelivered();
      } catch {
        // Storage unavailable: `deliver` awaits `wasFired`/`record`, so a blocked IndexedDB
        // rejects here. The boot already reported it once and the next tick retries, so this
        // must settle quietly rather than become an unhandled rejection.
      } finally {
        ticking.current = false;
      }
    };

    // The live query's first emission is what gives a tick something to deliver, so the tick
    // that runs against a *changed* item set is the one whose in-flight deliveries the boot
    // prune has to stay clear of.
    const afterEmission = tickedItems.current !== null && tickedItems.current !== items;
    tickedItems.current = items;

    void tick().finally(() => {
      if (afterEmission) bootGate.current.open();
    });
    const interval = window.setInterval(() => void tick(), 60_000);
    const onVisibility = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onWorkerMessage = (event: MessageEvent) => {
      const data = event.data as
        { type?: string; itemId?: string; occKey?: string; action?: string } | undefined;
      if (data?.type !== 'OPEN_ITEM' || !data.itemId) return;
      void itemRepo
        .get(data.itemId)
        .then(async (item) => {
          if (!item) return;
          if (data.action === 'done' && data.occKey) {
            await toggleDone(item, data.occKey);
            return;
          }
          if (data.action?.startsWith('snooze-')) {
            const minutes = Number(data.action.replace('snooze-', '')) || 10;
            const snooze: Reminder = {
              id: newId(),
              absolute: Date.now() + minutes * 60_000,
              label: `Snoozed ${minutes}m`,
            };
            await patchItem(
              item.id,
              { reminders: withSnooze(item.reminders, snooze) },
              { silent: true, trackHistory: false },
            );
            pushToast({ message: `Snoozed for ${minutes} minutes`, tone: 'info' });
            return;
          }
          openEditor(item, data.occKey ?? null);
        })
        // Storage unavailable: the click still focuses the tab, so a failed lookup must settle
        // quietly rather than escape as an unhandled rejection.
        .catch(() => {});
    };
    navigator.serviceWorker?.addEventListener('message', onWorkerMessage);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
    };
    // `notifyEnabled` is a dep on purpose: the setting arrives through a live
    // query, so flipping it in Settings tears this effect down and rebuilds
    // `tick` with the new value instead of leaving the 60s interval on a stale
    // closure; the rebuilt effect also ticks immediately.
  }, [items, notifyEnabled, settings.digestEnabled, settings.digestTime, pushToast, openEditor]);

  useEffect(() => {
    void notificationPermission();
    ignorePruneFailure(() => reminderLogRepo.pruneBefore(Date.now() - 30 * 24 * 60 * 60 * 1000));
    // Failure rows are kept long enough to be surfaced after the reminder aged out of the
    // retry window, then dropped so the pending count cannot grow without bound.
    ignorePruneFailure(() =>
      reminderFailureRepo.pruneBefore(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );
    ignorePruneFailure(async () => {
      // `items` is a dep of the tick effect above, so this pass's write tears that effect down
      // and rebuilds it, starting another tick. `deliver`'s dedupe is a check-then-record
      // (IMP-036), so a prune landing while a tick is still delivering gets the same reminder
      // notified and logged twice — every cold load that had something to prune. Waiting for
      // the boot tick to settle first keeps the prune off that path: each `deliver` records
      // its `reminderLog` row before returning, so the rebuilt tick finds them already fired.
      await bootGate.current.settled;
      // One pass on load, not per tick: the lookback is the delivery window, so a snooze inside it
      // is left for the first tick to fire (which keeps a snooze missed while the app was closed
      // alive) and only rows older than the window — which no tick can reach again — are dropped.
      await pruneItemReminders(Date.now(), LOOKBACK_MS);
    });
  }, []);

  return null;
}
