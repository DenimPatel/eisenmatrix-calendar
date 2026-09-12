import type { Item, RecurrenceRule, Reminder } from '@/types';
import { hasTimeComponent, parseLocalDate } from './date';

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function stamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function floating(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}00`;
}

function dateOnly(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export function recurrenceToRRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`, `INTERVAL=${Math.max(1, rule.interval)}`];
  if (rule.byWeekday?.length)
    parts.push(`BYDAY=${rule.byWeekday.map((d) => DAY_CODES[d]).join(',')}`);
  if (rule.byMonthDay?.length && rule.freq === 'monthly') {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  }
  if (rule.byMonth?.length && rule.freq === 'yearly') {
    parts.push(`BYMONTH=${rule.byMonth.join(',')}`);
  }
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  if (rule.until) {
    const until = parseLocalDate(rule.until);
    if (until) parts.push(`UNTIL=${dateOnly(until)}T235959Z`);
  }
  return parts.join(';');
}

function reminderToAlarm(reminder: Reminder, itemTitle: string): string[] {
  let trigger: string | null = null;
  if (typeof reminder.offsetMinutes === 'number') {
    const mins = reminder.offsetMinutes;
    const sign = mins < 0 ? '-' : '';
    const abs = Math.abs(mins);
    const days = Math.floor(abs / 1440);
    const hours = Math.floor((abs % 1440) / 60);
    const minutes = abs % 60;
    const datePart = days ? `${days}D` : '';
    const timePart =
      hours || minutes ? `T${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}` : '';
    trigger = abs === 0 ? 'PT0M' : `${sign}P${datePart}${timePart}`;
  } else if (reminder.timeOfDay) {
    // Absolute time-of-day on an all-day item becomes a 0-minute alarm at start.
    trigger = 'PT0M';
  }
  if (!trigger) return [];
  return [
    'BEGIN:VALARM',
    `TRIGGER:${trigger}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(reminder.label ?? itemTitle)}`,
    'END:VALARM',
  ];
}

export function itemsToICS(items: Item[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EisenMatrix Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const item of items) {
    if (!item.start || item.kind === 'note' || item.kind === 'shopping') continue;
    const start = parseLocalDate(item.start);
    if (!start) continue;
    const timed = !item.allDay && hasTimeComponent(item.start);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${item.id}@eisenmatrix`);
    lines.push(`DTSTAMP:${stamp(new Date(item.updatedAt || Date.now()))}`);
    lines.push(`SUMMARY:${escapeText(item.title || 'Untitled')}`);
    if (item.notes) lines.push(`DESCRIPTION:${escapeText(item.notes)}`);
    if (item.kind === 'event' && item.data.location) {
      lines.push(`LOCATION:${escapeText(item.data.location)}`);
    }
    if (timed) {
      lines.push(`DTSTART:${floating(start)}`);
      const end = parseLocalDate(item.end);
      if (end) lines.push(`DTEND:${floating(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(start)}`);
    }
    if (item.recurrence) lines.push(`RRULE:${recurrenceToRRule(item.recurrence)}`);
    for (const reminder of item.reminders) {
      lines.push(...reminderToAlarm(reminder, item.title));
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
