import { expandOccurrences } from './recurrence';
import { formatISODate, formatTime, hasTimeComponent, parseLocalDate } from '@/lib/date';
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
 * The offset range a reminder set can shift a fire time by. `expandOccurrences` floors its
 * window to whole days, so an occurrence is only visible from midnight of its own day; a
 * negative offset that crosses midnight would otherwise never be computed. The occurrence
 * window must therefore be widened by the same offsets before the fire times are filtered.
 */
function offsetBounds(reminders: Reminder[]): { min: number; max: number } {
  let min: number | null = null;
  let max: number | null = null;
  for (const reminder of reminders) {
    if (typeof reminder.offsetMinutes !== 'number') continue;
    const ms = reminder.offsetMinutes * 60_000;
    if (min === null || ms < min) min = ms;
    if (max === null || ms > max) max = ms;
  }
  return { min: min ?? 0, max: max ?? 0 };
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
    const { min, max } = offsetBounds(item.reminders);
    const occurrences = expandOccurrences(item, new Date(fromMs - max), new Date(toMs - min));
    for (const occurrence of occurrences) {
      // An occurrence the user completed or cancelled must not notify; a skipped occurrence is
      // already absent because `expandOccurrences` drops exceptions, so the resolved status is
      // the only signal left to honour for "skip this occurrence".
      if (occurrence.status === 'done' || occurrence.status === 'cancelled') continue;
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

const DEFAULT_REMINDER_TIME = '09:00';

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Reconcile a reminder set with an All-day toggle so a single row never carries two meanings:
 * the control the editor renders and `reminderFireTime`/`formatReminderLabel` must agree.
 *
 * Turning All day **off** needs a concrete start time. A date-only start takes the earliest
 * `timeOfDay` in the set (else 09:00) and each `timeOfDay` becomes its offset from that start,
 * so the fire instant is preserved while the control matches the timed item.
 *
 * Turning All day **on** converts an offset back to a clock time only when its fire instant
 * lands on the same calendar day as the start. A cross-day offset has no honest clock time on
 * the all-day day, so it is kept as an offset (never silently dropped) and rendered as an
 * offset row. `absolute` reminders are one-off instants and are always left untouched.
 */
export function reconcileReminderMode(
  reminders: Reminder[],
  allDay: boolean,
  start: string | null,
): { start: string | null; reminders: Reminder[] } {
  const base = parseLocalDate(start);
  if (!base) return { start, reminders };

  if (allDay) {
    const dayKey = formatISODate(base);
    const startTime = hasTimeComponent(start) ? formatTime(start) : null;
    if (!startTime) return { start: dayKey, reminders };
    const startMinutes = timeToMinutes(startTime);
    return {
      start: dayKey,
      reminders: reminders.map((reminder) => {
        if (
          typeof reminder.absolute === 'number' ||
          reminder.timeOfDay ||
          typeof reminder.offsetMinutes !== 'number'
        ) {
          return reminder;
        }
        const fireMinutes = startMinutes + reminder.offsetMinutes;
        const fire = new Date(base);
        fire.setHours(0, 0, 0, 0);
        fire.setMinutes(fireMinutes);
        if (formatISODate(fire) !== dayKey) return reminder;
        const next: Reminder = { ...reminder, timeOfDay: minutesToTime(fireMinutes) };
        delete next.offsetMinutes;
        return next;
      }),
    };
  }

  const times = reminders
    .map((reminder) => (reminder.timeOfDay ? timeToMinutes(reminder.timeOfDay) : null))
    .filter((minutes): minutes is number => minutes !== null);
  const startTime = hasTimeComponent(start)
    ? formatTime(start)
    : minutesToTime(times.length ? Math.min(...times) : timeToMinutes(DEFAULT_REMINDER_TIME));
  const startMinutes = timeToMinutes(startTime);
  return {
    start: `${formatISODate(base)}T${startTime}`,
    reminders: reminders.map((reminder) => {
      if (typeof reminder.absolute === 'number' || !reminder.timeOfDay) return reminder;
      const next: Reminder = {
        ...reminder,
        offsetMinutes: timeToMinutes(reminder.timeOfDay) - startMinutes,
      };
      delete next.timeOfDay;
      return next;
    }),
  };
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
