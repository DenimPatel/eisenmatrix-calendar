import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  format,
  isSameDay as dfIsSameDay,
  isSameMonth as dfIsSameMonth,
  isToday as dfIsToday,
  startOfMonth,
  startOfYear,
} from 'date-fns';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Local-safe `YYYY-MM-DD`. Never uses UTC (fixes the v1 off-by-one bug). */
export function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local-safe `YYYY-MM-DDTHH:mm`. */
export function formatISODateTime(date: Date): string {
  return `${formatISODate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function todayKey(): string {
  return formatISODate(new Date());
}

/** Parse a local `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` string into a Date. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  if (DATETIME.test(value)) {
    const [datePart, timePart] = value.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when the string carries a time component. */
export function hasTimeComponent(value: string | null | undefined): boolean {
  return !!value && DATETIME.test(value);
}

/** Extract the local `YYYY-MM-DD` portion of a date or datetime string. */
export function dateKeyOf(value: string | null | undefined): string | null {
  if (!value) return null;
  if (DATE_ONLY.test(value)) return value;
  if (DATETIME.test(value)) return value.slice(0, 10);
  const parsed = parseLocalDate(value);
  return parsed ? formatISODate(parsed) : null;
}

export function toOccKey(date: Date): string {
  return formatISODate(date);
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  return d;
}

export function endOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const start = startOfWeek(date, weekStartsOn);
  return endOfDay(addDays(start, 6));
}

export function endOfMonthDate(date: Date): Date {
  return endOfMonth(date);
}

export function endOfYearDate(date: Date): Date {
  return endOfYear(date);
}

export { addDays, addWeeks, addMonths, addYears, eachDayOfInterval, startOfMonth, startOfYear };

export function isSameDay(a: Date, b: Date): boolean {
  return dfIsSameDay(a, b);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return dfIsSameMonth(a, b);
}

export function isToday(date: Date): boolean {
  return dfIsToday(date);
}

export function formatDisplayDate(date: Date, pattern = 'EEE, MMM d'): string {
  return format(date, pattern);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  if (DATETIME.test(value)) return value.slice(11, 16);
  return '';
}

export function withTime(dateKey: string, time: string): string {
  return `${dateKey}T${time}`;
}

export function setTimeOnDateString(value: string, time: string): string {
  const key = dateKeyOf(value) ?? formatISODate(new Date());
  return `${key}T${time}`;
}

export function stripTime(value: string | null | undefined): string | null {
  return dateKeyOf(value);
}

/** Days between two local calendar days (b - a), ignoring time. */
export function calendarDaysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Clamp a day-of-month to a valid day in the given month (handles 31st -> Feb 28/29). */
export function clampDayOfMonth(year: number, monthIndex: number, day: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  if (day === -1) return last;
  return Math.min(Math.max(1, day), last);
}

/** First occurrence date inside an ISO-ish week number for a given year (best effort). */
export function firstDayOfISOWeek(year: number, week: number, weekStartsOn: 0 | 1 = 1): Date {
  const jan4 = new Date(year, 0, 4);
  const start = startOfWeek(jan4, weekStartsOn);
  return addDays(start, (week - 1) * 7);
}
