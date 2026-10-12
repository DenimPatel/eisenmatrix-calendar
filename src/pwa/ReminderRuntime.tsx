import { useEffect, useRef } from 'react';
import { useItems, useSetting } from '@/hooks/useData';
import { itemRepo, reminderLogRepo } from '@/db/repository';
import { patchItem, pruneItemReminders, toggleDone } from '@/domain/itemActions';
import { newId } from '@/lib/id';
import { upcomingReminders, withSnooze } from '@/domain/reminders';
import { useUiStore } from '@/store/useUiStore';
import { DEFAULT_SETTINGS, type AppSettings, type Item, type Reminder } from '@/types';
import { notificationPermission } from './notifications';
import { LOOKBACK_MS, deliver, deliverDigest } from './delivery';

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

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const now = new Date();
      const nowMs = now.getTime();

      const due = upcomingReminders(
        items,
        new Date(nowMs - LOOKBACK_MS),
        new Date(nowMs + 30_000),
      ).filter((scheduled) => scheduled.fireAt <= nowMs + 30_000);

      for (const scheduled of due) {
        const title = scheduled.item.title || 'Reminder';
        const timeLabel = scheduled.occurrence.start?.includes('T')
          ? scheduled.occurrence.start.slice(11, 16)
          : scheduled.occurrence.occKey;
        await deliver(
          title,
          `${timeLabel} · ${scheduled.occKey}`,
          scheduled.item.id,
          `${scheduled.occKey}::${scheduled.reminder.id}`,
          scheduled.occKey,
          'info',
          { notifyEnabled },
        );
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
      void itemRepo.get(data.itemId).then(async (item) => {
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
      });
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
    void reminderLogRepo.pruneBefore(Date.now() - 30 * 24 * 60 * 60 * 1000);
    void (async () => {
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
    })();
  }, []);

  return null;
}
