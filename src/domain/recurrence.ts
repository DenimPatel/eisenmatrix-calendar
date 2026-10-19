import { addDays, addMonths, differenceInCalendarDays } from 'date-fns';
import type {
  Item,
  Occurrence,
  OccurrenceOverride,
  OccurrenceStatus,
  RecurrenceRule,
} from '@/types';
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
    const weekStartsOn = rule.weekStartsOn ?? 1;
    const weekdays = (
      rule.byWeekday && rule.byWeekday.length ? [...rule.byWeekday] : [seriesStart.getDay()]
    )
      .map((d) => ((d % 7) + 7) % 7)
      .sort((a, b) => a - b);
    let weekStart = startOfWeek(base, weekStartsOn);
    while (guard++ < MAX_ITERATIONS) {
      const dates: Date[] = [];
      for (const wd of weekdays) {
        const offset = (wd - weekStartsOn + 7) % 7;
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

  // yearly — only for an explicit `yearly` freq; an unknown value must not fall through here.
  if (rule.freq !== 'yearly') return;
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

/**
 * Wall-clock length of the series in minutes: the clock distance from start to end plus any
 * whole calendar days between them. Using wall-clock minutes rather than real elapsed time
 * keeps the series' clock length stable across a DST transition. A date-only endpoint counts
 * as midnight, so an inconsistent series matches the previous real-elapsed behaviour outside
 * DST. Returns null for a non-forward range, matching the old fallback of substituting the start.
 */
function wallClockLengthMinutes(item: Item): number | null {
  const start = parseLocalDate(item.start);
  const end = parseLocalDate(item.end);
  if (!start || !end) return null;
  const clockMinutes = (value: string): number => {
    const [h, m] = value.slice(11, 16).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const minutes =
    differenceInCalendarDays(end, start) * 1440 +
    (clockMinutes(item.end as string) - clockMinutes(item.start as string));
  return minutes > 0 ? minutes : null;
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

/** Whether an override end can stand as the end of an occurrence that starts at `startStr`. */
function endFollowsStart(endStr: string, startStr: string, allDay: boolean): boolean {
  const end = parseLocalDate(endStr);
  const start = parseLocalDate(startStr);
  if (!end || !start) return false;
  if (allDay || !hasTimeComponent(startStr)) return end.getTime() >= start.getTime();
  if (!hasTimeComponent(endStr)) return false;
  return end.getTime() >= start.getTime();
}

/**
 * End derived from the *resolved* start, never from the canonical series day: an occurrence
 * moved to another day, or switched between all-day and timed, would otherwise inherit the
 * series' own end and end up before its own start.
 */
function deriveOccurrenceEnd(item: Item, startStr: string, allDay: boolean): string | null {
  if (!item.end) return null;
  const start = parseLocalDate(startStr);
  if (!start) return null;
  if (allDay || !hasTimeComponent(startStr)) return formatISODate(start);
  const minutes = wallClockLengthMinutes(item);
  if (!minutes) return startStr;
  return formatISODateTime(
    new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      start.getHours(),
      start.getMinutes() + minutes,
    ),
  );
}

function occurrenceEnd(
  item: Item,
  startStr: string,
  allDay: boolean,
  overrideEnd?: string | null,
): string | null {
  if (overrideEnd === undefined) return deriveOccurrenceEnd(item, startStr, allDay);
  if (overrideEnd === null) return null;
  return endFollowsStart(overrideEnd, startStr, allDay)
    ? overrideEnd
    : deriveOccurrenceEnd(item, startStr, allDay);
}

export interface ResolvedOccurrenceStatus {
  status: OccurrenceStatus;
  completedAt: number | null;
  isOverride: boolean;
}

/**
 * `item.occurrences` is the single store for an occurrence's status, so the card checkbox
 * (`toggleDone`), the resolved status and the persisted state cannot disagree. Builds before
 * this rule kept a `status` on the override; that value is honoured only while the occurrence
 * has no state of its own, and every status write erases it (`setStatus`).
 */
export function resolveOccurrenceStatus(item: Item, occKey: string): ResolvedOccurrenceStatus {
  const override = item.recurrence?.overrides?.[occKey];
  const isOverride = override !== undefined;
  const state = item.occurrences[occKey];
  if (state) return { status: state.status, completedAt: state.completedAt, isOverride };
  if (!item.recurrence) return { status: item.status, completedAt: item.completedAt, isOverride };
  if (override?.status) return { status: override.status, completedAt: null, isOverride };
  if (item.status === 'cancelled') return { status: 'cancelled', completedAt: null, isOverride };
  return { status: 'todo', completedAt: null, isOverride };
}

/** Effective title of one occurrence: its retitle override when present, else the series title. */
export function resolveOccurrenceTitle(item: Item, occKey: string): string {
  return item.recurrence?.overrides?.[occKey]?.title ?? item.title;
}

function buildOccurrence(item: Item, date: Date): Occurrence {
  const rule = item.recurrence;
  const occKey = toOccKey(date);
  const override: OccurrenceOverride | undefined = rule?.overrides?.[occKey];
  const start = occurrenceStart(item, date, override?.start);
  const allDay = override?.allDay ?? (item.allDay || !hasTimeComponent(start));
  const end = occurrenceEnd(item, start, allDay, override?.end);
  const { status, completedAt, isOverride } = resolveOccurrenceStatus(item, occKey);
  return {
    item,
    occKey,
    date: startOfDay(date),
    title: resolveOccurrenceTitle(item, occKey),
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
    // `!== undefined`, not truthy: `count: 0` means "no occurrences", and a truthy test
    // would read it as unbounded and expand it forever.
    if (rule.count !== undefined && generated >= rule.count) break;
    generated++;
    if (day > toDay) break;
    if (day < fromDay) continue;
    const occKey = toOccKey(candidate);
    if ((rule.exceptions ?? []).includes(occKey)) continue;
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

/**
 * Occurrences the head consumes when it stops before `fromKey`, counted exactly as
 * `expandOccurrences` does: candidate days, so a skipped day still uses one of `count`,
 * and both `count` and `until` cap the tally. The split may land between two occurrences,
 * so only days strictly before `fromKey` are counted.
 */
function occurrencesBeforeKey(item: Item, rule: RecurrenceRule, fromKey: string): number {
  const seriesStart = seriesStartOf(item);
  const boundary = parseLocalDate(fromKey);
  if (!seriesStart || !boundary) return 0;
  const boundaryDay = startOfDay(boundary);
  const untilBound = rule.until ? parseLocalDate(rule.until) : null;
  const untilDay = untilBound ? endOfDay(untilBound) : null;
  let generated = 0;
  for (const candidate of candidateDates(rule, seriesStart)) {
    const day = startOfDay(candidate);
    if (untilDay && day > untilDay) break;
    if (rule.count !== undefined && generated >= rule.count) break;
    if (day >= boundaryDay) break;
    generated++;
  }
  return generated;
}

/**
 * Whether a series still has at least one occurrence on or after `fromKey`. Counts candidate
 * days exactly as `expandOccurrences` does, so `count` and `until` cap the tally and a skipped
 * day still consumes a `count` slot. A "this and future" split past this point would leave a
 * tail that expands to zero occurrences, so the caller refuses to write one.
 */
export function hasOccurrenceOnOrAfter(item: Item, fromKey: string): boolean {
  const rule = item.recurrence;
  const seriesStart = seriesStartOf(item);
  const boundary = parseLocalDate(fromKey);
  if (!rule || !seriesStart || !boundary) return false;
  const boundaryDay = startOfDay(boundary);
  const untilBound = rule.until ? parseLocalDate(rule.until) : null;
  const untilDay = untilBound ? endOfDay(untilBound) : null;
  let generated = 0;
  for (const candidate of candidateDates(rule, seriesStart)) {
    const day = startOfDay(candidate);
    if (untilDay && day > untilDay) break;
    if (rule.count !== undefined && generated >= rule.count) break;
    generated++;
    if (day >= boundaryDay) return true;
  }
  return false;
}

/**
 * The grid fields `candidateDates` infers from the series start when they are absent —
 * `byWeekday` for weekly, `byMonthDay` for monthly, `byMonth`/`byMonthDay` for yearly.
 * `RecurrenceEditor.baseRule()` leaves them unset, so this is the shape the editor stores.
 */
function impliedAnchorFields(
  rule: RecurrenceRule,
  anchor: Date,
): Partial<Pick<RecurrenceRule, 'byWeekday' | 'byMonth' | 'byMonthDay'>> {
  const implied: Partial<Pick<RecurrenceRule, 'byWeekday' | 'byMonth' | 'byMonthDay'>> = {};
  if (rule.freq === 'weekly' && !rule.byWeekday?.length) implied.byWeekday = [anchor.getDay()];
  if ((rule.freq === 'monthly' || rule.freq === 'yearly') && !rule.byMonthDay?.length) {
    implied.byMonthDay = [anchor.getDate()];
  }
  if (rule.freq === 'yearly' && !rule.byMonth?.length) implied.byMonth = [anchor.getMonth() + 1];
  return implied;
}

/** Move a local `YYYY-MM-DD[THH:mm]` string by whole days, keeping its time-of-day. */
function shiftLocalDate(value: string, days: number): string {
  const parsed = parseLocalDate(value);
  if (!parsed) return value;
  const moved = formatISODate(addDays(parsed, days));
  return hasTimeComponent(value) ? `${moved}${value.slice(10)}` : moved;
}

/**
 * Split a series: stop the current item before `fromKey` and return a new tail item.
 * The tail carries on from `fromKey` — a count-limited series hands it only what the head
 * did not take, so the two halves still cover the original occurrences exactly once.
 *
 * Moving the tail's start onto the split day must not move any occurrence *date*: the split
 * day is often a clamped one (Aug 31 → Sep 30), and a rule that infers its grid from the
 * series start would have the tail re-derive day 30 instead of 31, shifting every later
 * occurrence a day earlier. The tail therefore carries the implied grid of the pre-split
 * anchor, and a count the head fully consumed stays `0` — an empty tail, never unbounded.
 */
export function splitSeries(
  item: Item,
  fromKey: string,
  tailId: string,
): { head: Item; tail: Item } {
  const rule = item.recurrence;
  if (!rule) return { head: item, tail: item };
  const from = parseLocalDate(fromKey);
  if (!from) return { head: item, tail: item };
  const previous = addDays(from, -1);
  const anchor = seriesStartOf(item);
  const shift = anchor ? differenceInCalendarDays(from, anchor) : 0;
  const consumed = occurrencesBeforeKey(item, rule, fromKey);
  const tailCount = rule.count === undefined ? {} : { count: Math.max(0, rule.count - consumed) };
  const untilBound = rule.until ? parseLocalDate(rule.until) : null;
  // A series that already ended stays ended: the head may not run past its own `until`.
  const headUntil =
    untilBound && untilBound.getTime() < previous.getTime()
      ? formatISODate(untilBound)
      : formatISODate(previous);
  // Per-occurrence state follows the occurrence it describes: the head keeps only what it can
  // still expand (keys before the split), the tail takes everything from the split onward. Keys
  // are local `YYYY-MM-DD`, so a plain string compare orders them correctly.
  const headOccurrences: Item['occurrences'] = {};
  const tailOccurrences: Item['occurrences'] = {};
  for (const [key, state] of Object.entries(item.occurrences ?? {})) {
    if (key < fromKey) headOccurrences[key] = state;
    else tailOccurrences[key] = state;
  }
  const head: Item = {
    ...item,
    recurrence: { ...rule, until: headUntil },
    occurrences: headOccurrences,
    updatedAt: Date.now(),
  };
  const tail: Item = {
    ...item,
    id: tailId,
    start: item.start ? shiftLocalDate(item.start, shift) : item.start,
    end: item.end ? shiftLocalDate(item.end, shift) : item.end,
    dueAt: item.dueAt ? shiftLocalDate(item.dueAt, shift) : item.dueAt,
    recurrence: {
      ...rule,
      ...(anchor ? impliedAnchorFields(rule, anchor) : {}),
      until: rule.until ?? null,
      ...tailCount,
    },
    occurrences: tailOccurrences,
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return { head, tail };
}
