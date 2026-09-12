import { addDays, addMonths } from 'date-fns';
import type { Item, Occurrence, OccurrenceStatus, RecurrenceRule } from '@/types';
import {
  clampDayOfMonth,
  dateKeyOf,
  endOfDay,
  formatISODate,
  formatISODateTime,
  hasTimeComponent,
  parseLocalDate,
  startOfDay,
  startOfWeek,
  toOccKey,
} from '@/lib/date';

const MAX_ITERATIONS = 200_000;

function seriesStartOf(item: Item): Date | null {
  return parseLocalDate(item.start ?? item.dueAt);
}

function timeOfDayOf(item: Item): string | null {
  const raw = item.start ?? item.dueAt;
  return hasTimeComponent(raw) ? (raw as string).slice(11, 16) : null;
}

function dateTimesInOrder(dates: Date[]): Date[] {
  return dates.filter((d) => !Number.isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Lazily yield the canonical (unfiltered) occurrence dates for a rule.
 * Consumers break as soon as they pass their window, so the guard is only a
 * safety net against malformed rules.
 */
function* candidateDates(rule: RecurrenceRule, seriesStart: Date): Generator<Date> {
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const base = startOfDay(seriesStart);
  let guard = 0;

  if (rule.freq === 'daily') {
    let cursor = base;
    while (guard++ < MAX_ITERATIONS) {
      yield cursor;
      cursor = addDays(cursor, interval);
    }
    return;
  }

  if (rule.freq === 'weekly') {
    const weekdays = (
      rule.byWeekday && rule.byWeekday.length ? [...rule.byWeekday] : [seriesStart.getDay()]
    )
      .map((d) => ((d % 7) + 7) % 7)
      .sort((a, b) => a - b);
    let weekStart = startOfWeek(base, rule.weekStartsOn);
    while (guard++ < MAX_ITERATIONS) {
      const dates: Date[] = [];
      for (const wd of weekdays) {
        const offset = (wd - rule.weekStartsOn + 7) % 7;
        const candidate = addDays(weekStart, offset);
        if (candidate.getTime() >= base.getTime()) dates.push(candidate);
      }
      for (const d of dateTimesInOrder(dates)) yield d;
      weekStart = addDays(weekStart, 7 * interval);
    }
    return;
  }

  if (rule.freq === 'monthly') {
    const monthDays = (
      rule.byMonthDay && rule.byMonthDay.length ? [...rule.byMonthDay] : [seriesStart.getDate()]
    )
      .map((d) => (d === -1 ? -1 : Math.min(31, Math.max(1, d))))
      .sort((a, b) => (a === -1 ? 32 : a) - (b === -1 ? 32 : b));
    let cursor = new Date(seriesStart.getFullYear(), seriesStart.getMonth(), 1);
    while (guard++ < MAX_ITERATIONS) {
      const dates: Date[] = [];
      for (const md of monthDays) {
        const day = clampDayOfMonth(cursor.getFullYear(), cursor.getMonth(), md);
        const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), day);
        if (candidate.getTime() >= base.getTime()) dates.push(candidate);
      }
      for (const d of dateTimesInOrder(dates)) yield d;
      cursor = addMonths(cursor, interval);
    }
    return;
  }

  // yearly
  const months = (
    rule.byMonth && rule.byMonth.length ? [...rule.byMonth] : [seriesStart.getMonth() + 1]
  )
    .map((m) => Math.min(12, Math.max(1, m)))
    .sort((a, b) => a - b);
  const monthDays = (
    rule.byMonthDay && rule.byMonthDay.length ? [...rule.byMonthDay] : [seriesStart.getDate()]
  )
    .map((d) => (d === -1 ? -1 : Math.min(31, Math.max(1, d))))
    .sort((a, b) => (a === -1 ? 32 : a) - (b === -1 ? 32 : b));
  let year = seriesStart.getFullYear();
  while (guard++ < MAX_ITERATIONS) {
    const dates: Date[] = [];
    for (const m of months) {
      for (const md of monthDays) {
        const day = clampDayOfMonth(year, m - 1, md);
        const candidate = new Date(year, m - 1, day);
        if (candidate.getTime() >= base.getTime()) dates.push(candidate);
      }
    }
    for (const d of dateTimesInOrder(dates)) yield d;
    year += interval;
  }
}

function durationMs(item: Item): number | null {
  const start = parseLocalDate(item.start);
  const end = parseLocalDate(item.end);
  if (!start || !end) return null;
  const diff = end.getTime() - start.getTime();
  return diff > 0 ? diff : null;
}

function occurrenceStart(item: Item, date: Date, overrideStart?: string): string {
  if (overrideStart) return overrideStart;
  const time = timeOfDayOf(item);
  if (item.allDay || !time) return formatISODate(date);
  return formatISODateTime(
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), ...timeToParts(time)),
  );
}

function timeToParts(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number);
  return [h || 0, m || 0];
}

function occurrenceEnd(
  item: Item,
  date: Date,
  startStr: string,
  overrideEnd?: string | null,
): string | null {
  if (overrideEnd !== undefined) return overrideEnd;
  if (!item.end) return null;
  if (item.allDay || !hasTimeComponent(startStr)) return formatISODate(date);
  const dur = durationMs(item);
  if (!dur) return formatISODate(date);
  const start = parseLocalDate(startStr);
  if (!start) return null;
  return formatISODateTime(new Date(start.getTime() + dur));
}

function resolveStatus(
  item: Item,
  occKey: string,
  rule: RecurrenceRule | null,
): {
  status: OccurrenceStatus;
  completedAt: number | null;
  isOverride: boolean;
} {
  const override = rule?.overrides[occKey];
  const state = item.occurrences[occKey];
  if (override?.status) {
    return { status: override.status, completedAt: state?.completedAt ?? null, isOverride: true };
  }
  if (state) {
    return { status: state.status, completedAt: state.completedAt, isOverride: false };
  }
  if (!rule) {
    return { status: item.status, completedAt: item.completedAt, isOverride: false };
  }
  if (item.status === 'cancelled') {
    return { status: 'cancelled', completedAt: null, isOverride: false };
  }
  return { status: 'todo', completedAt: null, isOverride: false };
}

function buildOccurrence(item: Item, date: Date): Occurrence {
  const rule = item.recurrence;
  const occKey = toOccKey(date);
  const override = rule?.overrides[occKey];
  const start = occurrenceStart(item, date, override?.start);
  const end = occurrenceEnd(item, date, start, override?.end);
  const allDay = override?.allDay ?? (item.allDay || !hasTimeComponent(start));
  const { status, completedAt, isOverride } = resolveStatus(item, occKey, rule);
  return {
    item,
    occKey,
    date: startOfDay(date),
    start,
    end,
    allDay,
    status,
    completedAt,
    isOverride,
  };
}

/**
 * Expand an item into its occurrences within `[from, to]` (inclusive).
 * Pure and deterministic; never mutates the item.
 */
export function expandOccurrences(item: Item, from: Date, to: Date): Occurrence[] {
  const rule = item.recurrence;
  const fromDay = startOfDay(from);
  const toDay = endOfDay(to);

  if (!rule) {
    const seriesStart = seriesStartOf(item);
    if (!seriesStart) return [];
    const day = startOfDay(seriesStart);
    if (day < fromDay || day > toDay) return [];
    return [buildOccurrence(item, seriesStart)];
  }

  const seriesStart = seriesStartOf(item);
  if (!seriesStart) return [];

  const untilBound = rule.until ? parseLocalDate(rule.until) : null;
  const untilDay = untilBound ? endOfDay(untilBound) : null;
  const results: Occurrence[] = [];
  let generated = 0;

  for (const candidate of candidateDates(rule, seriesStart)) {
    const day = startOfDay(candidate);
    if (untilDay && day > untilDay) break;
    if (rule.count && generated >= rule.count) break;
    generated++;
    if (day > toDay) break;
    if (day < fromDay) continue;
    const occKey = toOccKey(candidate);
    if (rule.exceptions.includes(occKey)) continue;
    results.push(buildOccurrence(item, candidate));
  }

  return results;
}

/** Whether an item is active on a single local day. */
export function isItemActiveOnDate(item: Item, date: Date): boolean {
  const start = startOfDay(date);
  if (!item.recurrence) {
    const s = seriesStartOf(item);
    return !!s && startOfDay(s).getTime() === start.getTime();
  }
  return expandOccurrences(item, start, start).length > 0;
}

/** First occurrence at or after `after` (optionally capped at `limit`). */
export function nextOccurrence(item: Item, after: Date, limit = 3660): Occurrence | null {
  const from = startOfDay(after);
  const to = addDays(from, limit);
  const all = expandOccurrences(item, from, to);
  return all.length ? all[0] : null;
}

/** First occurrence within a range, used by the legacy migration. */
export function firstOccurrenceInRange(item: Item, from: Date, to: Date): Occurrence | null {
  const all = expandOccurrences(item, from, to);
  return all.length ? all[0] : null;
}

export function occurrenceKeyForDate(date: Date): string {
  return dateKeyOf(formatISODate(date)) as string;
}

/** Update a single occurrence's state on an item, returning a new item. */
export function withOccurrenceState(
  item: Item,
  occKey: string,
  patch: Partial<{ status: OccurrenceStatus; completedAt: number | null; notes: string }>,
): Item {
  const existing = item.occurrences[occKey] ?? {
    status: 'todo' as OccurrenceStatus,
    completedAt: null,
  };
  return {
    ...item,
    occurrences: { ...item.occurrences, [occKey]: { ...existing, ...patch } },
  };
}

/** Split a series: stop the current item before `fromKey` and return a new tail item. */
export function splitSeries(
  item: Item,
  fromKey: string,
  tailId: string,
): { head: Item; tail: Item } {
  const rule = item.recurrence;
  if (!rule) return { head: item, tail: item };
  const previous = addDays(parseLocalDate(fromKey)!, -1);
  const head: Item = {
    ...item,
    recurrence: { ...rule, until: formatISODate(previous) },
    updatedAt: Date.now(),
  };
  const tail: Item = {
    ...item,
    id: tailId,
    recurrence: { ...rule, until: rule.until ?? null },
    occurrences: {},
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return { head, tail };
}
