import { describe, expect, it } from 'vitest';
import {
  buildBackup,
  backupToJSON,
  mergeImportedItems,
  parseBackup,
  timestampedName,
} from './backup';
import { createItem, normalizeItem } from '@/domain/itemFactory';
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
});
