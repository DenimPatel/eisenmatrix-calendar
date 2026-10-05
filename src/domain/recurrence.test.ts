import { describe, expect, it } from 'vitest';
import { expandOccurrences, resolveOccurrenceStatus } from './recurrence';
import { createItem } from './itemFactory';
import { parseLocalDate } from '@/lib/date';
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

function only(item: Item, occKey: string) {
  const day = new Date(`${occKey}T00:00:00`);
  const occ = expandOccurrences(item, day, day);
  expect(occ).toHaveLength(1);
  return occ[0];
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
      overrides: { '2024-01-02': { start: '2024-01-02T09:00' } },
    });
    item.occurrences = { '2024-01-02': { status: 'done', completedAt: 7 } };
    const occ = only(item, '2024-01-02');
    expect(occ.start).toBe('2024-01-02T09:00');
    expect(occ.status).toBe('done');
    expect(occ.completedAt).toBe(7);
    expect(occ.isOverride).toBe(true);
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

describe('occurrence status resolution', () => {
  it('prefers the occurrence state over a stale override status', () => {
    const item = makeItem('2026-07-13', {
      freq: 'daily',
      overrides: { '2026-07-20': { status: 'doing' } },
    });
    item.occurrences = { '2026-07-20': { status: 'done', completedAt: 5 } };

    expect(resolveOccurrenceStatus(item, '2026-07-20')).toMatchObject({
      status: 'done',
      completedAt: 5,
    });
    expect(only(item, '2026-07-20').status).toBe('done');
  });

  it('honours a legacy override status only while the occurrence has no state', () => {
    const item = makeItem('2026-07-13', {
      freq: 'daily',
      overrides: { '2026-07-20': { status: 'done' } },
    });
    expect(resolveOccurrenceStatus(item, '2026-07-20').status).toBe('done');

    item.occurrences = { '2026-07-20': { status: 'todo', completedAt: null } };
    expect(resolveOccurrenceStatus(item, '2026-07-20').status).toBe('todo');
  });

  it('defaults a recurring occurrence with no state to todo, not the series status', () => {
    const item = makeItem('2026-07-13', { freq: 'daily' });
    item.status = 'done';
    expect(resolveOccurrenceStatus(item, '2026-07-20').status).toBe('todo');
  });

  it('reports an override when the occurrence carries one', () => {
    const item = makeItem('2026-07-13', {
      freq: 'daily',
      overrides: { '2026-07-20': { title: 'Moved' } },
    });
    expect(resolveOccurrenceStatus(item, '2026-07-20').isOverride).toBe(true);
    expect(resolveOccurrenceStatus(item, '2026-07-21').isOverride).toBe(false);
  });
});

describe('occurrence ranges', () => {
  function allDaySeries(): Item {
    const item = createItem({
      kind: 'event',
      title: 'Conference',
      start: '2026-07-13',
      end: '2026-07-13',
      allDay: true,
    });
    item.recurrence = {
      freq: 'daily',
      interval: 1,
      weekStartsOn: 1,
      exceptions: [],
      overrides: {},
    };
    return item;
  }

  it('moves the end with a moved all-day occurrence', () => {
    const item = allDaySeries();
    item.recurrence!.overrides = { '2026-07-20': { start: '2026-07-15' } };

    const occ = only(item, '2026-07-20');
    expect(occ.start).toBe('2026-07-15');
    expect(occ.end).toBe('2026-07-15');
    expect(parseLocalDate(occ.end!)!.getTime()).toBeGreaterThanOrEqual(
      parseLocalDate(occ.start)!.getTime(),
    );
  });

  it('keeps the range valid when one occurrence is switched off all-day', () => {
    const item = allDaySeries();
    item.recurrence!.overrides = { '2026-07-20': { start: '2026-07-20T09:00', allDay: false } };

    const occ = only(item, '2026-07-20');
    expect(occ.allDay).toBe(false);
    expect(occ.start).toBe('2026-07-20T09:00');
    expect(parseLocalDate(occ.end!)!.getTime()).toBeGreaterThanOrEqual(
      parseLocalDate(occ.start)!.getTime(),
    );
    // Siblings keep their all-day single-day range.
    expect(only(item, '2026-07-21')).toMatchObject({
      start: '2026-07-21',
      end: '2026-07-21',
      allDay: true,
    });
  });

  it('discards an override end that precedes the occurrence start', () => {
    const item = createItem({
      kind: 'event',
      title: 'Sync',
      start: '2026-07-13T09:00',
      end: '2026-07-13T10:00',
      allDay: false,
    });
    item.recurrence = {
      freq: 'daily',
      interval: 1,
      weekStartsOn: 1,
      exceptions: [],
      overrides: { '2026-07-20': { start: '2026-07-20T11:00', end: '2026-07-13' } },
    };

    const occ = only(item, '2026-07-20');
    expect(occ.start).toBe('2026-07-20T11:00');
    expect(occ.end).toBe('2026-07-20T12:00');
  });

  it('never resolves a range that ends before it starts across a whole series', () => {
    const item = createItem({
      kind: 'event',
      title: 'Sync',
      start: '2026-07-13T09:00',
      end: '2026-07-13T09:00',
      allDay: false,
    });
    item.recurrence = {
      freq: 'daily',
      interval: 1,
      weekStartsOn: 1,
      exceptions: [],
      overrides: {
        '2026-07-15': { start: '2026-07-15', allDay: true },
        '2026-07-16': { start: '2026-07-16T09:00', allDay: false },
      },
    };

    const occs = expandOccurrences(
      item,
      new Date('2026-07-13T00:00:00'),
      new Date('2026-07-20T23:59:59'),
    );
    expect(occs).toHaveLength(8);
    for (const occ of occs) {
      expect(parseLocalDate(occ.end!)!.getTime()).toBeGreaterThanOrEqual(
        parseLocalDate(occ.start)!.getTime(),
      );
    }
  });
});
