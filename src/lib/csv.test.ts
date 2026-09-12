import { describe, expect, it } from 'vitest';
import { csvToItems, itemsToCSV, parseCSV, toCSV } from './csv';
import { createItem } from '@/domain/itemFactory';
import { normalizeItem } from '@/domain/itemFactory';

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
    const [restored] = csvToItems(csv).map(normalizeItem);

    expect(restored.title).toBe(item.title);
    expect(restored.notes).toBe(item.notes);
    expect(restored.tags).toEqual(item.tags);
    expect(restored.history).toHaveLength(1);
    expect(restored.legacy?.completionHistory).toEqual({ '2024-05': 'Done' });
    expect(restored.occurrences['2024-05-01']).toEqual({ status: 'done', completedAt: 42 });
  });
});
