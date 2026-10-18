import { describe, expect, it } from 'vitest';
import {
  expandOccurrences,
  hasOccurrenceOnOrAfter,
  nextOccurrence,
  resolveOccurrenceStatus,
  splitSeries,
} from './recurrence';
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

describe('splitSeries', () => {
  const WIDE = { from: '2000-01-01', to: '2100-01-01' } as const;

  function split(item: Item, fromKey: string) {
    const { head, tail } = splitSeries(item, fromKey, 'tail');
    const headKeys = keys(head, WIDE.from, WIDE.to);
    const tailKeys = keys(tail, WIDE.from, WIDE.to);
    return { head, tail, headKeys, tailKeys, union: [...new Set([...headKeys, ...tailKeys])] };
  }

  it('keeps a count-limited series at its original total', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', count: 10 });
    const { head, tail, headKeys, tailKeys, union } = split(item, '2024-01-04');

    expect(head.recurrence!.until).toBe('2024-01-03');
    expect(headKeys).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    expect(tail.recurrence!.count).toBe(7);
    expect(tailKeys).toHaveLength(7);
    expect(headKeys.length + tailKeys.length).toBe(item.recurrence!.count);
    expect(union).toEqual(keys(item, WIDE.from, WIDE.to));
  });

  it('counts only the occurrences a mid-period split actually consumes', () => {
    const item = makeItem('2024-01-01', { freq: 'weekly', byWeekday: [1, 3, 5], count: 10 });
    // 2024-01-04 is a Thursday: between the Wednesday and Friday occurrences.
    const { headKeys, tailKeys, tail, union } = split(item, '2024-01-04');

    expect(headKeys).toEqual(['2024-01-01', '2024-01-03']);
    expect(tail.recurrence!.count).toBe(8);
    expect(tailKeys[0]).toBe('2024-01-05');
    expect(headKeys.length + tailKeys.length).toBe(10);
    expect(union).toEqual(keys(item, WIDE.from, WIDE.to));
  });

  it('splits on a later occurrence of a multi-day monthly rule without over-counting', () => {
    const item = makeItem('2024-01-05', { freq: 'monthly', byMonthDay: [5, 20], count: 6 });
    const { headKeys, tailKeys, tail, union } = split(item, '2024-02-20');

    expect(headKeys).toEqual(['2024-01-05', '2024-01-20', '2024-02-05']);
    expect(tail.recurrence!.count).toBe(3);
    expect(tailKeys).toEqual(['2024-02-20', '2024-03-05', '2024-03-20']);
    expect(union).toEqual(keys(item, WIDE.from, WIDE.to));
  });

  it('leaves an uncounted series uncounted', () => {
    const item = makeItem('2024-01-01', { freq: 'daily' });
    const { head, tail, headKeys } = split(item, '2024-01-04');

    expect(head.recurrence!.until).toBe('2024-01-03');
    expect(tail.recurrence!.until).toBeNull();
    expect(tail.recurrence!.count).toBeUndefined();
    expect(headKeys).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    // Unbounded on both sides: the tail simply carries on from the split day.
    expect(keys(tail, '2024-01-01', '2024-01-06')).toEqual([
      '2024-01-04',
      '2024-01-05',
      '2024-01-06',
    ]);
    expect(keys(tail, '2024-01-01', '2024-01-06').concat(headKeys).sort()).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
      '2024-01-06',
    ]);
  });

  it('does not change what an until-bounded series generates', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', count: 10, until: '2024-01-05' });
    const expected = keys(item, WIDE.from, WIDE.to);
    const { tail, headKeys, tailKeys, union } = split(item, '2024-01-04');

    expect(tail.recurrence!.until).toBe('2024-01-05');
    expect(headKeys).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    expect(tailKeys).toEqual(['2024-01-04', '2024-01-05']);
    expect(union).toEqual(expected);
  });

  it('leaves a count harmless when the original until ends before the split', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', count: 10, until: '2024-01-03' });
    const expected = keys(item, WIDE.from, WIDE.to);
    const { head, tail, headKeys, tailKeys, union } = split(item, '2024-01-10');

    expect(head.recurrence!.until).toBe('2024-01-03');
    expect(tail.recurrence!.until).toBe('2024-01-03');
    expect(headKeys).toEqual(expected);
    expect(tailKeys).toEqual([]);
    expect(tail.recurrence!.count).toBeGreaterThanOrEqual(expected.length);
    expect(union).toEqual(expected);
  });

  it('moves the tail dates onto the split day, keeping the range and time-of-day', () => {
    const item = createItem({
      kind: 'event',
      title: 'Sync',
      start: '2024-01-01T09:00',
      end: '2024-01-01T10:30',
      allDay: false,
    });
    item.recurrence = {
      freq: 'weekly',
      interval: 1,
      byWeekday: [1],
      weekStartsOn: 1,
      count: 5,
      exceptions: [],
      overrides: {},
    };
    const { head, tail, union } = split(item, '2024-01-22');

    expect(tail.start).toBe('2024-01-22T09:00');
    expect(tail.end).toBe('2024-01-22T10:30');
    expect(head.start).toBe('2024-01-01T09:00');
    expect(head.end).toBe('2024-01-01T10:30');
    const occ = only(tail, '2024-01-22');
    expect(occ.start).toBe('2024-01-22T09:00');
    expect(occ.end).toBe('2024-01-22T10:30');
    expect(union).toEqual(keys(item, WIDE.from, WIDE.to));
  });

  it('keeps a skipped day consuming count, exactly as unsplit expansion does', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', count: 4, exceptions: ['2024-01-02'] });
    item.occurrences = { '2024-01-01': { status: 'done', completedAt: 1 } };
    const { head, tail, headKeys, tailKeys, union } = split(item, '2024-01-04');

    expect(head.recurrence!.count).toBe(4);
    expect(head.recurrence!.exceptions).toEqual(['2024-01-02']);
    expect(head.occurrences['2024-01-01']).toEqual({ status: 'done', completedAt: 1 });
    expect(tail.id).toBe('tail');
    expect(tail.occurrences).toEqual({});
    expect(tail.history).toEqual([]);
    expect(headKeys).toEqual(['2024-01-01', '2024-01-03']);
    expect(tail.recurrence!.count).toBe(1);
    expect(tailKeys).toEqual(['2024-01-04']);
    expect(union).toEqual(keys(item, WIDE.from, WIDE.to));
  });

  it('returns the item unsplit for a missing or unparseable split key', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', count: 10 });
    for (const bad of ['', 'not-a-date']) {
      expect(splitSeries(item, bad, 'tail')).toEqual({ head: item, tail: item });
    }
    const single = makeItem('2024-01-01');
    expect(splitSeries(single, '2024-01-04', 'tail')).toEqual({ head: single, tail: single });
  });

  it('reads a count of zero as an empty series, not an unbounded one', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', count: 0 });
    expect(keys(item, '2024-01-01', '2124-01-01')).toEqual([]);
    expect(expandOccurrences(item, new Date('2024-01-01'), new Date('2024-02-01'))).toEqual([]);
    expect(nextOccurrence(item, new Date('2024-01-01'), 365)).toBeNull();
  });

  it('produces no tail occurrences once the head has consumed the whole count', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', count: 3 });
    const { head, tail, tailKeys } = split(item, '2024-01-04');

    expect(tail.recurrence!.count).toBe(0);
    expect(tailKeys).toEqual([]);
    expect(keys(tail, '2024-01-01', '2124-01-01')).toEqual([]);
    expect(keys(head, WIDE.from, WIDE.to)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });
});

describe('hasOccurrenceOnOrAfter', () => {
  it('is true from a mid-series key and at the last occurrence', () => {
    const item = makeItem('2024-01-01', { freq: 'daily', count: 3 });
    expect(hasOccurrenceOnOrAfter(item, '2024-01-01')).toBe(true);
    expect(hasOccurrenceOnOrAfter(item, '2024-01-02')).toBe(true);
    expect(hasOccurrenceOnOrAfter(item, '2024-01-03')).toBe(true);
  });

  it('is false past a consumed count or a passed until, and for a key off the grid', () => {
    const counted = makeItem('2024-01-01', { freq: 'daily', count: 3 });
    expect(hasOccurrenceOnOrAfter(counted, '2024-01-04')).toBe(false);
    const bounded = makeItem('2024-01-01', { freq: 'daily', until: '2024-01-03' });
    expect(hasOccurrenceOnOrAfter(bounded, '2024-01-10')).toBe(false);
    const weekly = makeItem('2024-01-01', { freq: 'weekly', byWeekday: [1], count: 10 });
    // 2024-01-03 is a Wednesday: no occurrence on that day, but later ones remain.
    expect(hasOccurrenceOnOrAfter(weekly, '2024-01-03')).toBe(true);
  });

  it('is true for an unbounded series and false for a recurrence-less row', () => {
    expect(hasOccurrenceOnOrAfter(makeItem('2024-01-01', { freq: 'daily' }), '2030-01-01')).toBe(
      true,
    );
    expect(hasOccurrenceOnOrAfter(makeItem('2024-01-01'), '2024-01-01')).toBe(false);
  });
});

describe('splitSeries keeps every occurrence on its original date', () => {
  const WIDE = { from: '2000-01-01', to: '2100-01-01' } as const;

  function seriesKeys(item: Item): string[] {
    return expandOccurrences(
      item,
      new Date(`${WIDE.from}T00:00:00`),
      new Date(`${WIDE.to}T23:59:59`),
    ).map((o) => o.occKey);
  }

  function makeItem(start: string, rule?: Partial<RecurrenceRule> | null): Item {
    const item = createItem({ kind: 'task', title: 'Test', start, allDay: true });
    item.recurrence = rule
      ? { freq: 'daily', interval: 1, weekStartsOn: 1, exceptions: [], overrides: {}, ...rule }
      : null;
    return item;
  }

  /** head ∪ tail, with a duplicate check: the two halves must never overlap. */
  function halves(item: Item, fromKey: string) {
    const { head, tail } = splitSeries(item, fromKey, 'tail');
    const headKeys = seriesKeys(head);
    const tailKeys = seriesKeys(tail);
    return { head, tail, headKeys, tailKeys, union: [...headKeys, ...tailKeys].sort() };
  }

  it('keeps a 31st-of-the-month series on the 31st when the split day is clamped', () => {
    const item = makeItem('2026-08-31', { freq: 'monthly', count: 10 });
    const { headKeys, tailKeys, tail, union } = halves(item, '2026-09-30');

    // The rule stores no `byMonthDay`, exactly as `RecurrenceEditor.baseRule()` produces.
    expect(item.recurrence!.byMonthDay).toBeUndefined();
    expect(tail.start).toBe('2026-09-30');
    expect(tailKeys).toEqual([
      '2026-09-30',
      '2026-10-31',
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
    ]);
    expect(headKeys).toEqual(['2026-08-31']);
    expect(union).toEqual(seriesKeys(item));
  });

  it('keeps a month-end series on the 31st when split mid-series on a clamped day', () => {
    const item = makeItem('2024-01-31', { freq: 'monthly', count: 10 });
    const { headKeys, tailKeys, union } = halves(item, '2024-02-29');

    expect(headKeys).toEqual(['2024-01-31']);
    expect(tailKeys).toEqual([
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
      '2024-05-31',
      '2024-06-30',
      '2024-07-31',
      '2024-08-31',
      '2024-09-30',
      '2024-10-31',
    ]);
    expect(union).toEqual(seriesKeys(item));
  });

  it('keeps a 29th/30th anchored monthly series on its own day', () => {
    for (const [start, day30Split] of [
      ['2023-01-30', '2023-02-28'],
      ['2024-01-30', '2024-02-29'],
      ['2023-01-29', '2023-02-28'],
    ] as const) {
      const item = makeItem(start, { freq: 'monthly', count: 6 });
      const { tailKeys, union } = halves(item, day30Split);
      expect(tailKeys[0]).toBe(day30Split);
      expect(union).toEqual(seriesKeys(item));
    }
  });

  it('keeps the leap day on a yearly series split at a non-leap occurrence', () => {
    const item = makeItem('2024-02-29', { freq: 'yearly', count: 6 });
    const { headKeys, tailKeys, union } = halves(item, '2025-02-28');

    expect(headKeys).toEqual(['2024-02-29']);
    expect(tailKeys).toEqual([
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
      '2029-02-28',
    ]);
    expect(union).toEqual(seriesKeys(item));
  });

  it('leaves an explicit month-end rule alone', () => {
    const item = makeItem('2024-01-31', { freq: 'monthly', byMonthDay: [-1], count: 8 });
    const { tailKeys, union } = halves(item, '2024-04-30');
    expect(tailKeys[0]).toBe('2024-04-30');
    expect(union).toEqual(seriesKeys(item));
  });

  /**
   * head ∪ tail must reproduce the unsplit key set exactly — no gaps, no duplicates and no
   * date drift — at every occurrence key the editor can offer as a split point.
   */
  it('reproduces the unsplit occurrence set exactly across the whole rule space', () => {
    const STARTS = ['2023-12-31', '2024-01-15', '2024-01-30', '2024-01-31', '2024-02-29'];
    const RULES: Array<Partial<RecurrenceRule>> = [
      { freq: 'daily' },
      { freq: 'weekly' },
      { freq: 'weekly', byWeekday: [1, 3, 5] },
      { freq: 'monthly' },
      { freq: 'monthly', byMonthDay: [5, 20] },
      { freq: 'monthly', byMonthDay: [-1] },
      { freq: 'yearly' },
      { freq: 'yearly', byMonth: [1, 7] },
      { freq: 'yearly', byMonth: [2], byMonthDay: [29] },
    ];
    const INTERVALS = [1, 2, 3];
    const COUNTS = [1, 2, 3, 5, 8, 12];
    let checked = 0;

    for (const start of STARTS) {
      for (const rule of RULES) {
        for (const interval of INTERVALS) {
          for (const count of COUNTS) {
            const item = makeItem(start, { ...rule, interval, count });
            const original = seriesKeys(item);
            for (const splitKey of original) {
              const { headKeys, tailKeys, union } = halves(item, splitKey);
              const where = `${start} ${rule.freq} i${interval} n${count} @${splitKey}`;
              expect(new Set([...headKeys, ...tailKeys]).size, where).toBe(
                headKeys.length + tailKeys.length,
              );
              expect(union, where).toEqual(original);
              expect(headKeys.length + tailKeys.length, where).toBe(count);
              checked++;
            }
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(2000);
  });

  it('reproduces the unsplit occurrence set for timed series and skipped days', () => {
    const item = createItem({
      kind: 'event',
      title: 'Sync',
      start: '2024-01-31T09:00',
      end: '2024-01-31T10:30',
      allDay: false,
    });
    item.recurrence = {
      freq: 'monthly',
      interval: 1,
      weekStartsOn: 1,
      count: 8,
      exceptions: ['2024-04-30'],
      overrides: {},
    };
    const original = seriesKeys(item);

    for (const splitKey of original) {
      const { tail, union } = halves(item, splitKey);
      expect(tail.start, splitKey).toMatch(/T09:00$/);
      expect(tail.end, splitKey).toMatch(/T10:30$/);
      expect(union, splitKey).toEqual(original);
    }
    expect(original).not.toContain('2024-04-30');
  });
});
