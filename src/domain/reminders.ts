import { expandOccurrences } from './recurrence';
import { parseLocalDate } from '@/lib/date';
import type { Item, Occurrence, Reminder } from '@/types';

export interface ScheduledReminder {
  item: Item;
  occurrence: Occurrence;
  reminder: Reminder;
  occKey: string;
  fireAt: number;
}

/** Compute the concrete fire timestamp for a reminder on an occurrence. */
export function reminderFireTime(occurrence: Occurrence, reminder: Reminder): number | null {
  if (typeof reminder.absolute === 'number') return reminder.absolute;

  const start = parseLocalDate(occurrence.start ?? occurrence.occKey);
  if (!start) return null;

  if (typeof reminder.offsetMinutes === 'number') {
    return start.getTime() + reminder.offsetMinutes * 60_000;
  }

  if (reminder.timeOfDay) {
    const [h, m] = reminder.timeOfDay.split(':').map(Number);
    const at = new Date(start);
    at.setHours(h || 0, m || 0, 0, 0);
    return at.getTime();
  }

  return null;
}

/** All fire times for one occurrence, sorted and de-duplicated. */
export function fireTimesForOccurrence(occurrence: Occurrence): number[] {
  const times = new Set<number>();
  for (const reminder of occurrence.item.reminders) {
    const at = reminderFireTime(occurrence, reminder);
    if (at != null) times.add(at);
  }
  return [...times].sort((a, b) => a - b);
}

/**
 * Every reminder that should fire within `[from, to]` (inclusive), across all
 * non-archived items, sorted chronologically.
 */
export function upcomingReminders(items: Item[], from: Date, to: Date): ScheduledReminder[] {
  const out: ScheduledReminder[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (const item of items) {
    if (item.archivedAt) continue;
    if (!item.reminders.length && !item.recurrence) continue;
    const occurrences = expandOccurrences(item, from, to);
    for (const occurrence of occurrences) {
      for (const reminder of item.reminders) {
        const fireAt = reminderFireTime(occurrence, reminder);
        if (fireAt == null) continue;
        if (fireAt < fromMs || fireAt > toMs) continue;
        out.push({ item, occurrence, reminder, occKey: occurrence.occKey, fireAt });
      }
    }
  }

  return out.sort((a, b) => a.fireAt - b.fireAt);
}

/**
 * The delivery layer's lookback window, restated here because `domain` cannot import from `pwa`
 * and a prune that disagrees with the tick about which reminders are reachable deletes live ones.
 */
export const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * Drop the one-off `absolute` reminders a snooze left behind, keeping everything the user can
 * still be shown. Every snooze used to append a new `absolute` row and nothing removed them, so
 * this is what keeps `item.reminders` from growing without bound.
 *
 * An `absolute` falls into exactly one of three classes, and only the first may be deleted:
 *
 * - **expired** (`absolute <= now - lookbackMs`): `upcomingReminders` only scans back the
 *   delivery lookback, so no tick can ever surface it again. Dead weight, always dropped.
 * - **due, still in the window** (`now - lookbackMs < absolute <= now`): it may already have
 *   fired, and it may equally still be *pending* — a toast nobody saw while the tab was hidden
 *   is retried by the next tick rather than logged, so "past" proves nothing. A prune cannot
 *   tell the two apart without a per-row `reminderLog` read, so it keeps them; they age out
 *   through the rule above on a later pass.
 * - **pending** (`absolute > now`): a snooze the user is still owed, so it outranks every
 *   earlier row and must survive. Only the *soonest* of a stack is kept, because a later press
 *   supersedes the earlier ones (see `withSnooze`).
 *
 * Relative reminders (`offsetMinutes`/`timeOfDay`) are never pruned: they re-anchor on every
 * occurrence and are never stale, however old the item is.
 *
 * `lookbackMs` must be the delivery layer's window (`LOOKBACK_MS`, the same value as
 * `DEFAULT_LOOKBACK_MS`); `0` treats anything already in the past as expired, which is only
 * safe for a caller with no delivery lookback.
 */
export function pruneExpiredAbsolute(
  reminders: Reminder[],
  now: number = Date.now(),
  lookbackMs = 0,
): Reminder[] {
  const expiredBefore = now - lookbackMs;
  let keepIndex = -1;
  let pendingAt: number | undefined;
  for (const [index, reminder] of reminders.entries()) {
    const { absolute } = reminder;
    if (typeof absolute !== 'number' || absolute <= now) continue;
    if (pendingAt === undefined || absolute < pendingAt) {
      pendingAt = absolute;
      keepIndex = index;
    }
  }
  return reminders.filter((reminder, index) => {
    const { absolute } = reminder;
    if (typeof absolute !== 'number') return true;
    if (absolute <= expiredBefore) return false;
    return absolute > now ? index === keepIndex : true;
  });
}

/**
 * The reminder list a snooze press produces: the item's relative reminders plus the new
 * `absolute`, which *replaces* any absolute already there. Appending meant N presses in one
 * session left N rows (collapsing only on the next load) and left the prune pass to choose
 * between them; superseding keeps exactly one pending absolute at all times.
 */
export function withSnooze(reminders: Reminder[], snooze: Reminder): Reminder[] {
  return [...reminders.filter((reminder) => typeof reminder.absolute !== 'number'), snooze];
}

export function formatReminderLabel(reminder: Reminder): string {
  if (typeof reminder.absolute === 'number') {
    return new Date(reminder.absolute).toLocaleString();
  }
  if (reminder.timeOfDay) return `At ${reminder.timeOfDay}`;
  if (typeof reminder.offsetMinutes === 'number') {
    const mins = reminder.offsetMinutes;
    if (mins === 0) return 'At start';
    const abs = Math.abs(mins);
    const unit =
      abs % 1440 === 0
        ? `${abs / 1440} day${abs / 1440 === 1 ? '' : 's'}`
        : abs % 60 === 0
          ? `${abs / 60} hour${abs / 60 === 1 ? '' : 's'}`
          : `${abs} min`;
    return `${mins > 0 ? 'After' : 'Before'} ${unit}`;
  }
  return 'Reminder';
}
