import { describe, expect, it } from 'vitest';
import { expandOccurrences } from './recurrence';
import { createItem } from './itemFactory';
import type { Item, RecurrenceRule } from '@/types';

function makeItem(start: string, rule?: Partial<RecurrenceRule> | null): Item {
  const item = createItem({ kind: 'task', title: 'Test', start, allDay: true });
  item.recurrence = rule
    ? {
        freq: 'daily',
        interval: 1,
        weekStartsOn: 1,
        exceptions: [],
        overrides: {},
        ...rule,
      }
    : null;
  return item;
}

function keys(item: Item, from: string, to: string): string[] {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T23:59:59`);
  return expandOccurrences(item, f, t).map((o) => o.occKey);
}

describe('expandOccurrences', () => {
  it('returns a single occurrence for non-recurring items', () => {
    const item = makeItem('2024-01-15');
    expect(keys(item, '2024-01-01', '2024-01-31')).toEqual(['2024-01-15']);
    expect(keys(item, '2024-02-01', '2024-02-28')).toEqual([]);
  });

  it('handles daily intervals', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', interval: 2 });
    expect(keys(item, '2024-01-01', '2024-01-10')).toEqual([
      '2024-01-01',
      '2024-01-03',
      '2024-01-05',
      '2024-01-07',
      '2024-01-09',
    ]);
  });

  it('handles weekly byWeekday', () => {
    // 2024-01-01 is a Monday
    const item = makeItem('2024-01-01', { freq: 'weekly', byWeekday: [1, 3, 5] });
    expect(keys(item, '2024-01-01', '2024-01-07')).toEqual([
      '2024-01-01',
      '2024-01-03',
      '2024-01-05',
    ]);
  });

  it('clamps month-end instead of skipping short months', () => {
    const item = makeItem('2024-01-31', { freq: 'monthly', byMonthDay: [31] });
    expect(keys(item, '2024-02-01', '2024-02-29')).toEqual(['2024-02-29']);
    expect(keys(item, '2024-04-01', '2024-04-30')).toEqual(['2024-04-30']);
  });

  it('supports last-day-of-month', () => {
    const item = makeItem('2024-01-31', { freq: 'monthly', byMonthDay: [-1] });
    expect(keys(item, '2024-02-01', '2024-02-29')).toEqual(['2024-02-29']);
    expect(keys(item, '2024-04-01', '2024-04-30')).toEqual(['2024-04-30']);
  });

  it('respects count', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', count: 3 });
    expect(keys(item, '2024-01-01', '2024-01-31')).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
    ]);
  });

  it('respects until', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', until: '2024-01-03' });
    expect(keys(item, '2024-01-01', '2024-01-31')).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
    ]);
  });

  it('skips exceptions', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', exceptions: ['2024-01-02'] });
    expect(keys(item, '2024-01-01', '2024-01-03')).toEqual(['2024-01-01', '2024-01-03']);
  });

  it('applies overrides for a single occurrence', () => {
    const item = makeItem('2024-01-01', {
      freq: 'daily',
      overrides: { '2024-01-02': { start: '2024-01-02T09:00', status: 'done' } },
    });
    const occ = expandOccurrences(
      item,
      new Date('2024-01-02T00:00:00'),
      new Date('2024-01-02T23:59:59'),
    );
    expect(occ).toHaveLength(1);
    expect(occ[0].start).toBe('2024-01-02T09:00');
    expect(occ[0].status).toBe('done');
    expect(occ[0].isOverride).toBe(true);
  });

  it('keeps date keys stable across a DST boundary', () => {
    const item = makeItem('2024-03-08', { freq: 'daily' });
    expect(keys(item, '2024-03-08', '2024-03-12')).toEqual([
      '2024-03-08',
      '2024-03-09',
      '2024-03-10',
      '2024-03-11',
      '2024-03-12',
    ]);
  });

  it('preserves time-of-day on recurring timed items', () => {
    const item = createItem({
      kind: 'event',
      title: 'Standup',
      start: '2024-01-01T09:30',
      allDay: false,
    });
    item.recurrence = {
      freq: 'weekly',
      interval: 1,
      byWeekday: [1],
      weekStartsOn: 1,
      exceptions: [],
      overrides: {},
    };
    const occ = expandOccurrences(
      item,
      new Date('2024-01-08T00:00:00'),
      new Date('2024-01-08T23:59:59'),
    );
    expect(occ[0].start).toBe('2024-01-08T09:30');
    expect(occ[0].allDay).toBe(false);
  });

  it('uses per-occurrence state for recurring status', () => {
    const item = makeItem('2024-01-01', { freq: 'daily' });
    item.occurrences = { '2024-01-02': { status: 'done', completedAt: 123 } };
    const occ = expandOccurrences(
      item,
      new Date('2024-01-02T00:00:00'),
      new Date('2024-01-02T23:59:59'),
    );
    expect(occ[0].status).toBe('done');
    expect(occ[0].completedAt).toBe(123);
  });
});
