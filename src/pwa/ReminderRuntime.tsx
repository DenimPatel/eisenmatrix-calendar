import { useEffect } from 'react';
import { useItems, useSetting } from '@/hooks/useData';
import { itemRepo, reminderLogRepo } from '@/db/repository';
import { patchItem, toggleDone } from '@/domain/itemActions';
import { newId } from '@/lib/id';
import { upcomingReminders } from '@/domain/reminders';
import { useUiStore } from '@/store/useUiStore';
import { expandOccurrences } from '@/domain/recurrence';
import { addDays, endOfDay, formatISODate, startOfDay } from '@/lib/date';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';
import { notificationPermission, showAppNotification } from './notifications';

const DIGEST_TAG = '__digest__';
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

async function deliver(
  title: string,
  body: string,
  itemId: string,
  dedupeKey: string,
  occurrenceKey: string,
  tone: 'info' | 'success' | 'error' = 'info',
) {
  // Dedupe per reminder (not per occurrence) so an item with several reminders
  // fires each of them, and snoozes can re-fire under a fresh key.
  const alreadyFired = await reminderLogRepo.wasFired(itemId, dedupeKey);
  if (alreadyFired) return false;

  const shown = await showAppNotification(title, {
    body,
    tag: `${itemId}:${dedupeKey}`,
    actions: [
      { action: 'done', title: 'Done' },
      { action: 'snooze-10', title: 'Snooze 10m' },
      { action: 'snooze-60', title: 'Snooze 1h' },
    ],
    data: { itemId, occKey: occurrenceKey },
    requireInteraction: true,
  });

  if (!shown) {
    useUiStore.getState().pushToast({ message: `${title} — ${body}`, tone, duration: 8000 });
  }

  await reminderLogRepo.record(itemId, dedupeKey);
  return true;
}

/**
 * Drives reminder delivery. Runs on load, on visibility change, and every 60s.
 * There is no push server; this is best-effort while the tab/PWA is alive.
 */
export function ReminderRuntime() {
  const items = useItems();
  const settings = useSetting<AppSettings>('app', DEFAULT_SETTINGS);
  const pushToast = useUiStore((s) => s.pushToast);
  const openEditor = useUiStore((s) => s.openEditor);

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
        );
      }

      // Daily digest
      if (settings.digestEnabled) {
        const [h, m] = settings.digestTime.split(':').map(Number);
        const digestAt = new Date(now);
        digestAt.setHours(h || 8, m || 0, 0, 0);
        if (nowMs >= digestAt.getTime() && nowMs - digestAt.getTime() < LOOKBACK_MS) {
          const todayKey = formatISODate(now);
          const already = await reminderLogRepo.wasFired(DIGEST_TAG, todayKey);
          if (!already) {
            const todayOccurrences = items.flatMap((item) =>
              expandOccurrences(item, startOfDay(now), endOfDay(now)),
            );
            const overdue = items
              .flatMap((item) =>
                expandOccurrences(
                  item,
                  addDays(startOfDay(now), -30),
                  addDays(startOfDay(now), -1),
                ),
              )
              .filter((occ) => occ.status !== 'done' && occ.item.kind !== 'habit').length;
            const habitsLeft = items.filter((i) => i.kind === 'habit').length;
            const body = `${todayOccurrences.length} scheduled today · ${overdue} overdue · ${habitsLeft} habits`;
            const shown = await showAppNotification('Your day at a glance', {
              body,
              tag: DIGEST_TAG,
              data: { itemId: '', occKey: todayKey },
            });
            if (!shown)
              pushToast({ message: `Daily digest — ${body}`, tone: 'info', duration: 10000 });
            await reminderLogRepo.record(DIGEST_TAG, todayKey);
          }
        }
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), 60_000);
    const onVisibility = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onWorkerMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; itemId?: string; occKey?: string; action?: string }
        | undefined;
      if (data?.type !== 'OPEN_ITEM' || !data.itemId) return;
      void itemRepo.get(data.itemId).then(async (item) => {
        if (!item) return;
        if (data.action === 'done' && data.occKey) {
          await toggleDone(item, data.occKey);
          return;
        }
        if (data.action?.startsWith('snooze-')) {
          const minutes = Number(data.action.replace('snooze-', '')) || 10;
          await patchItem(
            item.id,
            {
              reminders: [
                ...item.reminders,
                { id: newId(), absolute: Date.now() + minutes * 60_000, label: `Snoozed ${minutes}m` },
              ],
            },
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
  }, [items, settings.digestEnabled, settings.digestTime, pushToast, openEditor]);

  useEffect(() => {
    void notificationPermission();
    void reminderLogRepo.pruneBefore(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }, []);

  return null;
}
