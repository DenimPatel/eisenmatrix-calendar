import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BACKUP_VERSION,
  buildBackup,
  backupToJSON,
  mergeImportedItems,
  parseBackup,
  readTextFile,
  timestampedName,
} from './backup';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import { expandOccurrences } from '@/domain/recurrence';
import type { Item } from '@/types';

function item(id: string, title: string): Item {
  return normalizeItem({ ...createItem({ kind: 'task', title }), id });
}

describe('backup', () => {
  it('round-trips a full backup', () => {
    const items = [item('a', 'Alpha'), item('b', 'Beta')];
    const payload = buildBackup(items, []);
    const json = backupToJSON(payload);
    const parsed = parseBackup(json);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.version).toBe(2);
    expect(parsed.items.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('accepts the legacy `tasks` array shape', () => {
    const parsed = parseBackup(JSON.stringify({ version: 1, tasks: [item('x', 'Legacy')] }));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].title).toBe('Legacy');
  });

  it('rejects a payload carrying neither items nor tasks', () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow(/not an eisenmatrix backup/i);
    expect(() => parseBackup('{}')).toThrow(/no items or tasks/i);
    expect(() => parseBackup('null')).toThrow(/not an eisenmatrix backup/i);
  });

  it('accepts a legacy payload that carries an empty items array', () => {
    const parsed = parseBackup(JSON.stringify({ version: 1, items: [] }));
    expect(parsed.version).toBe(1);
    expect(parsed.items).toEqual([]);
  });

  it('normalizes a parsed item stored without data to its kind defaults', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'eisenmatrix',
        version: 2,
        items: [{ id: 'no-data', kind: 'habit', title: 'Stretch' }],
      }),
    );
    const [habit] = parsed.items.map(normalizeItem);

    expect(habit.data).toEqual({
      target: { count: 1, per: 'day' },
      streak: { current: 0, best: 0, lastAt: null },
    });
  });

  it('falls back to task for an unknown kind and coerces non-array shape fields', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'eisenmatrix',
        version: 2,
        items: [
          {
            id: 'bad',
            kind: 'bogus',
            title: 'Bad',
            status: 'weird',
            reminders: { x: 1 },
            tags: 'nope',
            checklist: 5,
            occurrences: [1],
          },
        ],
      }),
    );

    expect(parsed.invalid).toBe(0);
    const [bad] = parsed.items.map(normalizeItem);

    expect(bad.kind).toBe('task');
    expect(bad.status).toBe('todo');
    expect(bad.reminders).toEqual([]);
    expect(bad.tags).toEqual([]);
    expect(bad.checklist).toEqual([]);
    expect(bad.occurrences).toEqual({});
  });

  it('counts non-object entries as invalid instead of throwing', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'eisenmatrix',
        version: 2,
        items: [1, null, 'nope', { id: 'ok', kind: 'task', title: 'Fine' }],
      }),
    );

    expect(parsed.invalid).toBe(3);
    expect(parsed.items.map((i) => i.id)).toEqual(['ok']);
  });

  it('counts an item without an id as invalid', () => {
    const parsed = parseBackup(
      JSON.stringify({ app: 'eisenmatrix', version: 2, items: [{ kind: 'task', title: 'No id' }] }),
    );

    expect(parsed.invalid).toBe(1);
    expect(parsed.items).toEqual([]);
  });

  it('coerces a malformed recurrence rule into a complete rule that expands without throwing', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'eisenmatrix',
        version: 2,
        items: [
          {
            id: 'rec-1',
            kind: 'task',
            title: 'Weekly',
            start: '2024-01-01',
            recurrence: { freq: 'weekly' },
          },
        ],
      }),
    );

    expect(parsed.invalid).toBe(0);
    const [item] = parsed.items.map(normalizeItem);
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

  it('counts an item whose recurrence has an unknown frequency as invalid', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'eisenmatrix',
        version: 2,
        items: [{ id: 'rec-2', kind: 'task', title: 'Hourly', recurrence: { freq: 'hourly' } }],
      }),
    );

    expect(parsed.invalid).toBe(1);
    expect(parsed.items).toEqual([]);
  });

  describe('payload identity and version', () => {
    it('rejects a payload produced by another app', () => {
      const json = JSON.stringify({ app: 'other-app', version: 2, items: [item('a', 'Alpha')] });
      expect(() => parseBackup(json)).toThrow(/not an eisenmatrix backup/i);
    });

    it('rejects a too-new format version', () => {
      const json = JSON.stringify({ app: 'eisenmatrix', version: 3, items: [] });
      expect(() => parseBackup(json)).toThrow(/format v3/i);
    });

    it('accepts an older format version carrying the app marker', () => {
      const parsed = parseBackup(
        JSON.stringify({ app: 'eisenmatrix', version: 1, items: [item('v1', 'Older')] }),
      );
      expect(parsed.version).toBe(1);
      expect(parsed.items.map((i) => i.id)).toEqual(['v1']);
    });

    it('accepts a payload with no app or version field', () => {
      const parsed = parseBackup(JSON.stringify({ items: [item('bare', 'Bare')] }));
      expect(parsed.version).toBe(1);
      expect(parsed.items.map((i) => i.id)).toEqual(['bare']);
    });

    it('still returns the current version for a valid payload', () => {
      const parsed = parseBackup(backupToJSON(buildBackup([item('a', 'Alpha')], [])));
      expect(parsed.version).toBe(BACKUP_VERSION);
      expect(parsed.items.map((i) => i.id)).toEqual(['a']);
    });
  });

  it('resolves import conflicts by strategy', () => {
    const existing = [item('a', 'Alpha'), item('b', 'Beta')];
    const incoming = [item('a', 'Alpha v2'), item('c', 'Gamma')];

    const skip = mergeImportedItems(existing, incoming, 'skip');
    expect(skip.toPut.map((i) => i.id)).toEqual(['c']);
    expect(skip.skipped).toBe(1);

    const overwrite = mergeImportedItems(existing, incoming, 'overwrite');
    expect(overwrite.toPut.map((i) => i.title)).toEqual(['Alpha v2', 'Gamma']);
    expect(overwrite.overwritten).toBe(1);

    const duplicate = mergeImportedItems(existing, incoming, 'duplicate');
    expect(duplicate.duplicated).toBe(1);
    expect(duplicate.toPut.map((i) => i.id)).not.toContain('a');
    expect(duplicate.toPut).toHaveLength(2);
  });

  it('builds timestamped filenames', () => {
    expect(timestampedName('eisenmatrix-backup', 'json')).toMatch(
      /^eisenmatrix-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  describe('parentId remapping on duplicate', () => {
    const parent = { ...item('p', 'Parent'), parentId: null };
    const child = { ...item('c', 'Child'), parentId: 'p' };

    it('repoints a duplicated child at the duplicated parent', () => {
      const { toPut, duplicated } = mergeImportedItems(
        [parent, child],
        [parent, child],
        'duplicate',
      );
      expect(duplicated).toBe(2);

      const dupParent = toPut.find((i) => i.title === 'Parent');
      const dupChild = toPut.find((i) => i.title === 'Child');
      expect(dupParent?.id).not.toBe('p');
      expect(dupChild?.id).not.toBe('c');
      expect(dupChild?.parentId).toBe(dupParent?.id);
    });

    it('repoints when the child precedes the parent in the incoming array', () => {
      const { toPut } = mergeImportedItems([parent, child], [child, parent], 'duplicate');
      const dupParent = toPut.find((i) => i.title === 'Parent');
      expect(toPut.find((i) => i.title === 'Child')?.parentId).toBe(dupParent?.id);
    });

    it('keeps the original parentId when the parent is not in the incoming set', () => {
      const orphanChild = { ...item('c', 'Child'), parentId: 'live-parent' };
      const { toPut } = mergeImportedItems(
        [item('live-parent', 'Live Parent'), orphanChild],
        [orphanChild],
        'duplicate',
      );

      const dupChild = toPut.find((i) => i.title === 'Child');
      expect(dupChild?.id).not.toBe('c');
      expect(dupChild?.parentId).toBe('live-parent');
    });

    it('keeps the parentId when the incoming parent is not itself duplicated', () => {
      const freshParent = { ...item('new-p', 'Fresh Parent'), parentId: null };
      const incomingChild = { ...item('new-c', 'Child'), parentId: 'new-p' };
      const { toPut } = mergeImportedItems(
        [parent, child],
        [freshParent, incomingChild],
        'duplicate',
      );

      expect(toPut.map((i) => i.title)).toEqual(['Fresh Parent', 'Child']);
      expect(toPut[1].parentId).toBe('new-p');
    });

    it('repoints a fresh-id child at the duplicated parent', () => {
      const freshChild = { ...item('new-c', 'Child'), parentId: 'p' };
      const { toPut, duplicated } = mergeImportedItems([parent], [parent, freshChild], 'duplicate');
      expect(duplicated).toBe(1);

      const dupParent = toPut.find((i) => i.title === 'Parent');
      const keptChild = toPut.find((i) => i.title === 'Child');
      expect(keptChild?.id).toBe('new-c');
      expect(dupParent?.id).not.toBe('p');
      expect(keptChild?.parentId).toBe(dupParent?.id);
      expect(keptChild?.parentId).not.toBe('p');
    });

    it('resolves a parent that appears twice in the payload to one canonical target', () => {
      const dupPayload = { ...parent, title: 'Parent Again' };
      const freshChild = { ...item('new-c', 'Child'), parentId: 'p' };
      const { toPut, duplicated } = mergeImportedItems(
        [parent],
        [parent, dupPayload, freshChild],
        'duplicate',
      );
      expect(duplicated).toBe(2);

      const targetIds = new Set(toPut.map((i) => i.parentId).filter(Boolean));
      expect(targetIds.size).toBe(1);
      expect(targetIds.has('p')).toBe(false);
    });

    it('leaves skip and overwrite parentIds untouched', () => {
      const skip = mergeImportedItems([parent, child], [parent, child], 'skip');
      expect(skip.toPut).toEqual([]);

      const overwrite = mergeImportedItems([parent, child], [parent, child], 'overwrite');
      expect(overwrite.toPut.map((i) => i.id)).toEqual(['p', 'c']);
      expect(overwrite.toPut[1].parentId).toBe('p');
    });
  });
});

describe('readTextFile', () => {
  function stubFileReader(mode: 'resolve' | 'reject', result: unknown = 'content'): void {
    class FakeFileReader {
      onload: ((event: { target: { result: unknown } }) => void) | null = null;
      onerror: (() => void) | null = null;
      error: unknown = new Error('read failed');
      readAsText(): void {
        if (mode === 'reject') this.onerror?.();
        else this.onload?.({ target: { result } });
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with the reader result', async () => {
    stubFileReader('resolve', 'file body');
    await expect(readTextFile({} as File)).resolves.toBe('file body');
  });

  it('resolves with an empty string when the reader yields no result', async () => {
    stubFileReader('resolve', null);
    await expect(readTextFile({} as File)).resolves.toBe('');
  });

  it('rejects with the reader error', async () => {
    stubFileReader('reject');
    await expect(readTextFile({} as File)).rejects.toThrow('read failed');
  });
});
