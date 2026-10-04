import { describe, expect, it } from 'vitest';
import { habitStreak } from './stats';
import { createItem } from './itemFactory';
import type { HabitData, Item } from '@/types';

function makeHabit(
  start: string,
  per: 'day' | 'week' | 'month' = 'month',
  count = 1,
): Item {
  const item = createItem({ kind: 'habit', title: 'Read', start, allDay: true });
  item.recurrence = {
    freq: 'daily',
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
  };
  (item.data as HabitData).target = { count, per };
  return item;
}

function markDone(item: Item, keys: string[]): Item {
  for (const key of keys) {
    item.occurrences[key] = { status: 'done', completedAt: Date.now() };
  }
  return item;
}

describe('habitStreak', () => {
  it('resets the best run across a fully-missed month', () => {
    const item = markDone(makeHabit('2024-01-01'), ['2024-01-10', '2024-03-10']);
    const result = habitStreak(item, new Date(2024, 2, 31));
    expect(result.best).toBe(1);
    expect(result.current).toBe(1);
  });

  it('keeps the run across adjacent completed months', () => {
    const item = markDone(makeHabit('2024-01-01'), ['2024-01-10', '2024-02-10']);
    const result = habitStreak(item, new Date(2024, 1, 15));
    expect(result.best).toBe(2);
    expect(result.current).toBe(2);
  });

  it('resets the best run across a fully-missed week', () => {
    const item = markDone(makeHabit('2024-01-01', 'week'), ['2024-01-03', '2024-01-17']);
    const result = habitStreak(item, new Date(2024, 1, 1));
    expect(result.best).toBe(1);
  });

  it('honours target.count when deciding a period is complete', () => {
    const item = markDone(makeHabit('2024-01-01', 'month', 2), ['2024-01-05']);
    const result = habitStreak(item, new Date(2024, 0, 31));
    expect(result.best).toBe(0);
  });

  it('does not break the current streak on an in-progress period', () => {
    const item = markDone(makeHabit('2024-01-01'), ['2024-01-10']);
    const result = habitStreak(item, new Date(2024, 1, 10));
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
  });
});
