import {
  addDays,
  addMonths,
  formatISODate,
  parseLocalDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '@/lib/date';
import { expandOccurrences } from './recurrence';
import type { Item, Occurrence } from '@/types';

export interface CompletionStats {
  total: number;
  done: number;
  rate: number;
}

export function completionStats(occurrences: Occurrence[]): CompletionStats {
  const total = occurrences.length;
  const done = occurrences.filter((o) => o.status === 'done').length;
  return { total, done, rate: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function itemCompletionStats(item: Item, from: Date, to: Date): CompletionStats {
  return completionStats(expandOccurrences(item, from, to));
}

function periodStart(date: Date, per: 'day' | 'week' | 'month', weekStartsOn: 0 | 1): Date {
  if (per === 'day') return startOfDay(date);
  if (per === 'week') return startOfWeek(date, weekStartsOn);
  return startOfMonth(date);
}

export interface StreakResult {
  current: number;
  best: number;
  lastAt: string | null;
}

/** Compute habit streaks from stored occurrence state. */
export function habitStreak(item: Item, today = new Date()): StreakResult {
  if (item.kind !== 'habit') return { current: 0, best: 0, lastAt: null };
  const target = item.data.target;
  const weekStartsOn = item.recurrence?.weekStartsOn ?? 1;

  const earliest = item.start ? parseLocalDate(item.start)! : addMonths(today, -12);
  const occurrences = expandOccurrences(item, addDays(earliest, -7), today);
  const doneByPeriod = new Map<string, number>();
  let lastAt: string | null = null;

  for (const occ of occurrences) {
    if (occ.status !== 'done') continue;
    const key = formatISODate(periodStart(occ.date, target.per, weekStartsOn));
    doneByPeriod.set(key, (doneByPeriod.get(key) ?? 0) + 1);
    if (!lastAt || occ.occKey > lastAt) lastAt = occ.occKey;
  }

  const complete = (key: string) => (doneByPeriod.get(key) ?? 0) >= Math.max(1, target.count);

  // Current streak: walk backwards from the current period. An incomplete
  // current period does not break the chain (the day is not over yet).
  let current = 0;
  let cursor = periodStart(today, target.per, weekStartsOn);
  let isCurrentPeriod = true;
  for (let i = 0; i < 400; i++) {
    const key = formatISODate(cursor);
    if (complete(key)) {
      current++;
    } else if (isCurrentPeriod) {
      // allow grace for the in-progress period
    } else {
      break;
    }
    isCurrentPeriod = false;
    const prev = periodStart(addDays(cursor, -1), target.per, weekStartsOn);
    if (prev.getTime() >= cursor.getTime()) break;
    cursor = prev;
  }

  // Best streak: scan forward across all tracked periods.
  const keys = [...doneByPeriod.keys()].sort();
  let best = 0;
  let run = 0;
  for (const key of keys) {
    if (complete(key)) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  best = Math.max(best, current);

  return { current, best, lastAt };
}

export interface GoalProgress {
  current: number;
  target: number;
  percent: number;
  label: string;
}

export function goalProgress(goal: Item, children: Item[] = []): GoalProgress {
  if (goal.kind !== 'goal') {
    return { current: 0, target: 1, percent: 0, label: '0%' };
  }
  const metric = goal.data.metric;
  let current = metric.current ?? 0;
  let target = metric.target ?? 1;

  if (metric.type === 'checklist') {
    target = children.length || 1;
    current = children.filter((c) => c.status === 'done' || c.completedAt).length;
  } else if (metric.type === 'binary') {
    target = 1;
    current = goal.status === 'done' || goal.completedAt ? 1 : (metric.current ?? 0);
  }

  const percent = target === 0 ? 0 : Math.min(100, Math.round((current / target) * 100));
  const unit = metric.unit ? ` ${metric.unit}` : '';
  return { current, target, percent, label: `${current}/${target}${unit}` };
}

/** Consecutive days with at least one completed item, ending today. */
export function activeDayStreak(items: Item[], today = new Date()): number {
  const doneDays = new Set<string>();
  for (const item of items) {
    if (item.completedAt) doneDays.add(formatISODate(new Date(item.completedAt)));
    for (const [key, state] of Object.entries(item.occurrences)) {
      if (state.status === 'done') doneDays.add(key);
    }
  }
  let streak = 0;
  let cursor = startOfDay(today);
  while (streak < 1000 && doneDays.has(formatISODate(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Overall completion rate across every occurrence in a window. */
export function overallCompletion(items: Item[], from: Date, to: Date): CompletionStats {
  const all = items.flatMap((item) => expandOccurrences(item, from, to));
  return completionStats(all);
}
