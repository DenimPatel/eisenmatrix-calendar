import { afterAll, describe, expect, it } from 'vitest';
import { expandOccurrences } from './recurrence';
import { createItem } from './itemFactory';
import type { Item, RecurrenceRule } from '@/types';

// The bug only manifests in a DST-observing zone, so pin the process to one. Node reads
// `process.env.TZ` on each Date operation, so setting it here is enough; the original value
// is restored so this file cannot leak the zone into a shared worker.
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'America/New_York';
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

function series(start: string, end: string, rule?: Partial<RecurrenceRule>): Item {
  const item = createItem({ kind: 'event', title: 'Weekly', start, end, allDay: false });
  item.recurrence = {
    freq: 'weekly',
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
    ...rule,
  };
  return item;
}

function occurrences(item: Item, from: string, to: string) {
  return expandOccurrences(item, new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`));
}

describe('recurring timed end across a DST transition', () => {
  it('keeps the series wall-clock end when a weekly series crosses the spring-forward day', () => {
    const item = series('2026-03-01T01:00', '2026-03-01T04:00');
    const occ = occurrences(item, '2026-03-01', '2026-03-22');

    expect(occ.map((o) => o.occKey)).toEqual([
      '2026-03-01',
      '2026-03-08',
      '2026-03-15',
      '2026-03-22',
    ]);
    for (const o of occ) {
      expect(o.start, o.occKey).toBe(`${o.occKey}T01:00`);
      expect(o.end, o.occKey).toBe(`${o.occKey}T04:00`);
    }
  });

  it('keeps the series wall-clock end when the series starts on the spring-forward day', () => {
    const item = series('2026-03-08T01:00', '2026-03-08T04:00');
    const occ = occurrences(item, '2026-03-08', '2026-03-28');

    expect(occ.map((o) => o.occKey)).toEqual(['2026-03-08', '2026-03-15', '2026-03-22']);
    for (const o of occ) {
      expect(o.start, o.occKey).toBe(`${o.occKey}T01:00`);
      expect(o.end, o.occKey).toBe(`${o.occKey}T04:00`);
    }
  });

  it('preserves the wall-clock end in the fall-back direction too', () => {
    const item = series('2026-10-25T01:00', '2026-10-25T04:00');
    const occ = occurrences(item, '2026-10-25', '2026-11-15');

    expect(occ.map((o) => o.occKey)).toEqual([
      '2026-10-25',
      '2026-11-01',
      '2026-11-08',
      '2026-11-15',
    ]);
    for (const o of occ) {
      expect(o.end, o.occKey).toBe(`${o.occKey}T04:00`);
    }
  });

  it('leaves non-DST occurrences and all-day items unchanged', () => {
    const timed = series('2026-01-05T09:00', '2026-01-05T10:30');
    for (const o of occurrences(timed, '2026-01-05', '2026-01-19')) {
      expect(o.end, o.occKey).toBe(`${o.occKey}T10:30`);
    }

    const allDay = createItem({
      kind: 'event',
      title: 'All day',
      start: '2026-03-01',
      end: '2026-03-01',
      allDay: true,
    });
    allDay.recurrence = {
      freq: 'weekly',
      interval: 1,
      weekStartsOn: 1,
      exceptions: [],
      overrides: {},
    };
    for (const o of occurrences(allDay, '2026-03-01', '2026-03-15')) {
      expect(o.allDay, o.occKey).toBe(true);
      expect(o.end, o.occKey).toBe(o.occKey);
    }
  });
});
