import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import { itemRepo, listRepo, reminderLogRepo, settingsRepo } from './repository';
import { createItem, defaultDataFor, normalizeItem } from '@/domain/itemFactory';
import { ITEM_KINDS, type Item, type ItemKind, type List } from '@/types';

function task(id: string, title: string, parentId: string | null = null): Item {
  const base = normalizeItem({ ...createItem({ kind: 'task', title }), id });
  return { ...base, parentId };
}

function rawWithoutData(kind: ItemKind): Item {
  const { data: _data, ...raw } = createItem({ kind, title: `Raw ${kind}` });
  return raw as Item;
}

beforeEach(async () => {
  await Promise.all([
    db.items.clear(),
    db.lists.clear(),
    db.settings.clear(),
    db.reminderLog.clear(),
  ]);
});

afterAll(async () => {
  await db.delete();
});

describe('itemRepo', () => {
  it('creates, reads, updates and removes items', async () => {
    await itemRepo.create(task('1', 'Alpha'));
    expect((await itemRepo.get('1'))?.title).toBe('Alpha');

    await itemRepo.update('1', { title: 'Alpha v2' });
    const updated = await itemRepo.get('1');
    expect(updated?.title).toBe('Alpha v2');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(updated!.createdAt);

    await itemRepo.remove('1');
    expect(await itemRepo.get('1')).toBeUndefined();
  });

  it('archives and restores in bulk', async () => {
    await itemRepo.createMany([task('a', 'A'), task('b', 'B')]);
    await itemRepo.setArchived(['a', 'b'], true);
    expect((await itemRepo.all()).every((i) => i.archivedAt)).toBe(true);
    await itemRepo.setArchived(['a', 'b'], false);
    expect((await itemRepo.all()).every((i) => i.archivedAt === null)).toBe(true);
  });

  it('backfills missing or null data on read without rewriting the stored rows', async () => {
    const raw = ITEM_KINDS.map(rawWithoutData);
    const nulled = ITEM_KINDS.map(
      (kind) => ({ ...rawWithoutData(kind), data: null }) as unknown as Item,
    );
    await db.items.bulkPut([...raw, ...nulled]);

    const expected = new Map(ITEM_KINDS.map((kind) => [kind, defaultDataFor(kind)]));
    const all = await itemRepo.all();
    for (const item of [...raw, ...nulled]) {
      expect(await itemRepo.get(item.id)).toMatchObject({ data: expected.get(item.kind) });
      expect(all.find((entry) => entry.id === item.id)?.data).toEqual(expected.get(item.kind));
    }

    const byKind = await itemRepo.byKind('habit');
    expect(byKind.map((item) => item.data)).toEqual([
      defaultDataFor('habit'),
      defaultDataFor('habit'),
    ]);

    for (const item of raw) {
      expect(await db.items.get(item.id)).not.toHaveProperty('data');
    }
    for (const item of nulled) {
      expect((await db.items.get(item.id))?.data).toBeNull();
    }
  });

  it('removes children with their parent', async () => {
    await itemRepo.createMany([
      task('p', 'Parent'),
      task('c1', 'Child 1', 'p'),
      task('c2', 'Child 2', 'p'),
    ]);
    await itemRepo.removeWithChildren('p');
    expect(await itemRepo.all()).toHaveLength(0);
  });

  it('removes deep descendants and leaves unrelated items', async () => {
    await itemRepo.createMany([
      task('p', 'Parent'),
      task('c', 'Child', 'p'),
      task('g', 'Grandchild', 'c'),
      task('gg', 'Great-grandchild', 'g'),
      task('other', 'Unrelated', 'unrelated-parent'),
      task('other-child', 'Unrelated child', 'other'),
    ]);
    await itemRepo.removeWithChildren('p');
    const remaining = (await itemRepo.all()).map((i) => i.id).sort();
    expect(remaining).toEqual(['other', 'other-child']);
  });

  it('terminates on a self-parent item and does not treat it as its own descendant', async () => {
    await itemRepo.createMany([task('s', 'Self', 's'), task('keep', 'Keep')]);
    await itemRepo.removeWithChildren('s');
    const remaining = (await itemRepo.all()).map((i) => i.id).sort();
    expect(remaining).toEqual(['keep']);
  });

  it('terminates on a two-node parent cycle and removes both nodes', async () => {
    await itemRepo.createMany([task('a', 'A', 'b'), task('b', 'B', 'a'), task('keep', 'Keep')]);
    await itemRepo.removeWithChildren('a');
    const remaining = (await itemRepo.all()).map((i) => i.id).sort();
    expect(remaining).toEqual(['keep']);
  });
});

describe('listRepo and settingsRepo', () => {
  it('orders lists and persists settings', async () => {
    const list: List = {
      id: 'l1',
      name: 'Work',
      kind: 'project',
      color: 'accent',
      icon: 'list',
      order: 0,
      archivedAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    await listRepo.create(list);
    expect(await listRepo.all()).toHaveLength(1);

    await settingsRepo.set('app', { theme: 'dark' });
    expect(await settingsRepo.get('app', {})).toEqual({ theme: 'dark' });
  });
});

describe('reminderLogRepo', () => {
  it('dedupes fired reminders by item and occurrence', async () => {
    expect(await reminderLogRepo.wasFired('item-1', '2024-01-01')).toBe(false);
    await reminderLogRepo.record('item-1', '2024-01-01');
    expect(await reminderLogRepo.wasFired('item-1', '2024-01-01')).toBe(true);
    expect(await reminderLogRepo.wasFired('item-1', '2024-01-02')).toBe(false);
  });

  it('prunes old log entries', async () => {
    await reminderLogRepo.record('a', 'k', 1000);
    await reminderLogRepo.record('b', 'k', Date.now());
    const deleted = await reminderLogRepo.pruneBefore(5000);
    expect(deleted).toBe(1);
  });
});
