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
