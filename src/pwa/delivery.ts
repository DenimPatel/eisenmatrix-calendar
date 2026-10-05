import { reminderLogRepo } from '@/db/repository';
import { expandOccurrences } from '@/domain/recurrence';
import { addDays, endOfDay, formatISODate, startOfDay } from '@/lib/date';
import { useUiStore, type Toast } from '@/store/useUiStore';
import type { Item } from '@/types';
import { showAppNotification, type AppNotificationOptions } from './notifications';

export const DIGEST_TAG = '__digest__';
export const LOOKBACK_MS = 24 * 60 * 60 * 1000;

type PushToast = (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => void;

export interface DeliverOptions {
  toastDuration?: number;
  /** Prefix of the fallback toast; defaults to the notification title. */
  toastTitle?: string;
  /** Replaces the default reminder notification payload (used by the digest). */
  notification?: AppNotificationOptions;
  /** Test seams; production uses the real notification API, store and document. */
  show?: (title: string, options: AppNotificationOptions) => Promise<boolean>;
  pushToast?: PushToast;
  isVisible?: () => boolean;
}

function documentIsVisible(): boolean {
  return typeof document !== 'undefined' && !document.hidden;
}

/**
 * Show one reminder and record it as fired only when it was actually delivered:
 * either the notification was shown, or the in-app toast appeared while the
 * document was visible. An undelivered reminder is left unfired so the next tick
 * (and, ultimately, the `visibilitychange` tick) retries it instead of letting
 * the dedupe window suppress it forever. Retries are bounded by the caller's
 * existing `LOOKBACK_MS` window and happen at most once per tick.
 */
export async function deliver(
  title: string,
  body: string,
  itemId: string,
  dedupeKey: string,
  occurrenceKey: string,
  tone: Toast['tone'] = 'info',
  options: DeliverOptions = {},
): Promise<boolean> {
  const {
    toastDuration = 8000,
    toastTitle = title,
    notification = {
      body,
      tag: `${itemId}:${dedupeKey}`,
      actions: [
        { action: 'done', title: 'Done' },
        { action: 'snooze-10', title: 'Snooze 10m' },
        { action: 'snooze-60', title: 'Snooze 1h' },
      ],
      data: { itemId, occKey: occurrenceKey },
      requireInteraction: true,
    },
    show = showAppNotification,
    pushToast = (toast) => void useUiStore.getState().pushToast(toast),
    isVisible = documentIsVisible,
  } = options;

  // Dedupe per reminder (not per occurrence) so an item with several reminders
  // fires each of them, and snoozes can re-fire under a fresh key.
  if (await reminderLogRepo.wasFired(itemId, dedupeKey)) return false;

  if (await show(title, notification)) {
    await reminderLogRepo.record(itemId, dedupeKey);
    return true;
  }

  // A toast nobody can see is not delivery, so it is not queued while hidden:
  // that is what keeps repeated retries from stacking duplicate, already stale
  // toasts for when the tab regains focus.
  if (!isVisible()) return false;

  pushToast({ message: `${toastTitle} — ${body}`, tone, duration: toastDuration });
  await reminderLogRepo.record(itemId, dedupeKey);
  return true;
}

/** Daily digest; same delivery rule as `deliver`, no per-occurrence actions. */
export async function deliverDigest(
  items: Item[],
  now: Date,
  options: DeliverOptions = {},
): Promise<boolean> {
  const todayKey = formatISODate(now);
  // Dedupe first so an undelivered digest that retries every tick does not also
  // re-expand every item twice per minute.
  if (await reminderLogRepo.wasFired(DIGEST_TAG, todayKey)) return false;

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

  return deliver('Your day at a glance', body, DIGEST_TAG, todayKey, todayKey, 'info', {
    toastDuration: 10000,
    toastTitle: 'Daily digest',
    notification: { body, tag: DIGEST_TAG, data: { itemId: '', occKey: todayKey } },
    ...options,
  });
}