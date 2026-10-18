import { describe, expect, it } from 'vitest';
import { csvToItems, itemsToCSV, parseCSV, toCSV } from './csv';
import { createItem } from '@/domain/itemFactory';
import { normalizeItem } from '@/domain/itemFactory';
import { expandOccurrences } from '@/domain/recurrence';

describe('csv', () => {
  it('parses multi-line quoted fields without corrupting records', () => {
    const csv = 'a,b\r\n"line one\nline two",2\r\nplain,3';
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      ['a', 'b'],
      ['line one\nline two', '2'],
      ['plain', '3'],
    ]);
  });

  it('escapes quotes and commas', () => {
    const text = toCSV([{ name: 'a,b', note: 'say "hi"' }]);
    expect(text).toContain('"a,b"');
    expect(text).toContain('"say ""hi"""');
  });

  it('keeps a mid-field quote literal and round-trips it', () => {
    expect(parseCSV('abc"def,2\r\nplain "quote",3')).toEqual([
      ['abc"def', '2'],
      ['plain "quote"', '3'],
    ]);
    expect(parseCSV(toCSV([{ name: 'abc"def' }]))).toEqual([['name'], ['abc"def']]);
  });

  it('round-trips an item including history and legacy completion data', () => {
    const item = normalizeItem(
      createItem({
        kind: 'task',
        title: 'Renew licence',
        notes: 'Multi\nline notes, with comma',
        start: '2024-05-01',
      }),
    );
    item.tags = ['admin', 'urgent'];
    item.history = [
      {
        id: 'h1',
        timestamp: 1,
        field: 'Title',
        oldValue: 'x',
        newValue: 'Renew licence',
        user: 'User',
      },
    ];
    item.legacy = { completionHistory: { '2024-05': 'Done' } };
    item.occurrences = { '2024-05-01': { status: 'done', completedAt: 42 } };

    const csv = itemsToCSV([item]);
    const [restored] = csvToItems(csv).items.map(normalizeItem);

    expect(restored.title).toBe(item.title);
    expect(restored.notes).toBe(item.notes);
    expect(restored.tags).toEqual(item.tags);
    expect(restored.history).toHaveLength(1);
    expect(restored.legacy?.completionHistory).toEqual({ '2024-05': 'Done' });
    expect(restored.occurrences['2024-05-01']).toEqual({ status: 'done', completedAt: 42 });
  });

  it('normalizes a row without a data column to the kind defaults', () => {
    const [goal] = csvToItems('id,kind,title\r\ncsv-1,goal,Read more').items.map(normalizeItem);

    expect(goal.data).toEqual({ metric: { type: 'binary' }, horizon: 'month' });
  });

  it('rejects a payload whose header has no exported columns', () => {
    expect(() => csvToItems('hello,world\r\nfoo,bar')).toThrow(/not an eisenmatrix csv/i);
    expect(() => csvToItems('junk')).toThrow(/not an eisenmatrix csv/i);
    expect(() => csvToItems('')).toThrow(/empty file/i);
  });

  it('falls back to task for an unknown kind and coerces non-array shape fields', () => {
    const csv = [
      'id,kind,title,status,reminders,tags,checklist,occurrences',
      'bad-1,bogus,Bad kind,weird,{},{},"{""a"":1}",[1,2]',
    ].join('\r\n');

    const result = csvToItems(csv);
    expect(result.invalid).toBe(0);
    const [bad] = result.items.map(normalizeItem);

    expect(bad.kind).toBe('task');
    expect(bad.status).toBe('todo');
    expect(bad.reminders).toEqual([]);
    expect(bad.tags).toEqual([]);
    expect(bad.checklist).toEqual([]);
    expect(bad.occurrences).toEqual({});
  });

  it('generates an id for a row that omits one', () => {
    const [item] = csvToItems('kind,title\r\ntask,No id').items.map(normalizeItem);

    expect(typeof item.id).toBe('string');
    expect(item.id.length).toBeGreaterThan(0);
  });

  it('skips and counts rows with an empty title', () => {
    const result = csvToItems(
      'id,kind,title\r\nblank-1,task,\r\nblank-2,task,"   "\r\ncsv-1,goal,Keep me',
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Keep me');
    expect(result.items.some((i) => !i.title?.trim())).toBe(false);
    expect(result.skippedBlank).toBe(2);
  });

  it('round-trips an empty export as zero items', () => {
    const result = csvToItems(itemsToCSV([]));
    expect(result.items).toEqual([]);
    expect(result.skippedBlank).toBe(0);
  });

  it('coerces an imported recurrence rule into a complete rule that expands without burning the guard', () => {
    const csv = toCSV([
      {
        id: 'rec-1',
        kind: 'task',
        title: 'Weekly standup',
        start: '2024-01-01',
        recurrence: { freq: 'weekly' },
      },
    ]);

    const result = csvToItems(csv);
    expect(result.invalid).toBe(0);
    const [item] = result.items.map(normalizeItem);

    expect(item.recurrence).toEqual({
      freq: 'weekly',
      interval: 1,
      weekStartsOn: 1,
      exceptions: [],
      overrides: {},
    });

    const from = new Date('2024-01-01T00:00:00');
    const to = new Date('2024-01-07T23:59:59');
    expect(() => expandOccurrences(item, from, to)).not.toThrow();
    expect(expandOccurrences(item, from, to).map((o) => o.occKey)).toEqual(['2024-01-01']);
  });

  it('rejects an imported row whose recurrence has an unknown frequency', () => {
    const csv = toCSV([
      {
        id: 'rec-2',
        kind: 'task',
        title: 'Hourly',
        start: '2024-01-01',
        recurrence: { freq: 'hourly' },
      },
    ]);

    const result = csvToItems(csv);
    expect(result.invalid).toBe(1);
    expect(result.items).toEqual([]);
  });
});
