import { describe, expect, it } from 'vitest';
import { createItem, normalizeItem } from './itemFactory';
import { expandOccurrences } from './recurrence';
import type { ItemKind, RecurrenceRule } from '@/types';

const DAILY: RecurrenceRule = {
  freq: 'daily',
  interval: 1,
  weekStartsOn: 1,
  exceptions: [],
  overrides: {},
};

describe('createItem recurrence defaults', () => {
  it('gives habits a daily recurrence when none is supplied', () => {
    const habit = createItem({ kind: 'habit', start: '2026-10-16' });
    expect(habit.recurrence).toEqual(DAILY);

    const occurrences = expandOccurrences(habit, new Date(2026, 9, 16), new Date(2026, 9, 22));
    expect(occurrences.map((occ) => occ.occKey)).toEqual([
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
    ]);
  });

  it('keeps a caller-supplied recurrence for habits', () => {
    const weekly: RecurrenceRule = {
      freq: 'weekly',
      interval: 2,
      byWeekday: [1, 3],
      weekStartsOn: 0,
      exceptions: ['2026-10-19'],
      overrides: {},
    };
    const habit = createItem({ kind: 'habit', start: '2026-10-16', recurrence: weekly });
    expect(habit.recurrence).toEqual(weekly);
  });

  it('does not add a recurrence default to any other kind', () => {
    const kinds: ItemKind[] = ['task', 'event', 'goal', 'bill', 'shopping', 'note'];
    for (const kind of kinds) {
      expect(createItem({ kind }).recurrence, kind).toBeNull();
    }
  });

  it('does not rewrite habits normalized without a rule', () => {
    const habit = normalizeItem({ kind: 'habit', title: 'Legacy', start: '2026-01-01' });
    expect(habit.recurrence).toBeNull();
  });
});
