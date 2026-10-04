import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { itemRepo } from '@/db/repository';
import { useUiStore } from '@/store/useUiStore';
import { createItem, normalizeItem } from './itemFactory';
import { deleteItem, deleteItems } from './itemActions';
import type { Item } from '@/types';

function task(id: string, title: string, parentId: string | null = null): Item {
  return normalizeItem({ ...createItem({ kind: 'task', title }), id, parentId });
}

function relationships(items: Item[]): Array<[string, string | null]> {
  return items.map((i) => [i.id, i.parentId] as [string, string | null]).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
}

beforeEach(async () => {
  await db.items.clear();
  useUiStore.getState().clearUndo();
  useUiStore.setState({ toasts: [] });
});

afterAll(async () => {
  await db.delete();
});

describe('deleteItem', () => {
  it('restores the parent and every descendant on undo', async () => {
    await itemRepo.createMany([
      task('p', 'Parent'),
      task('c', 'Child', 'p'),
      task('g', 'Grandchild', 'c'),
    ]);
    const before = await itemRepo.all();
    const parent = (await itemRepo.get('p'))!;

    await deleteItem(parent);
    expect(await itemRepo.all()).toHaveLength(0);

    await useUiStore.getState().undo();

    const after = await itemRepo.all();
    expect(after).toHaveLength(before.length);
    expect(relationships(after)).toEqual(relationships(before));
  });

  it('does not restore unrelated items that were never deleted', async () => {
    await itemRepo.createMany([
      task('p', 'Parent'),
      task('c', 'Child', 'p'),
      task('other', 'Unrelated'),
    ]);
    await deleteItem((await itemRepo.get('p'))!);

    await useUiStore.getState().undo();

    const ids = (await itemRepo.all()).map((i) => i.id).sort();
    expect(ids).toEqual(['c', 'other', 'p']);
  });
});

describe('deleteItems', () => {
  it('deletes the selection and every transitive descendant', async () => {
    await itemRepo.createMany([
      task('p', 'Parent'),
      task('c', 'Child', 'p'),
      task('g', 'Grandchild', 'c'),
    ]);

    await deleteItems([(await itemRepo.get('p'))!]);

    expect(await itemRepo.all()).toHaveLength(0);
  });

  it('restores the selection and descendants on undo, leaving siblings untouched', async () => {
    await itemRepo.createMany([
      task('p', 'Parent'),
      task('c', 'Child', 'p'),
      task('g', 'Grandchild', 'c'),
      task('other', 'Unrelated'),
    ]);
    const before = await itemRepo.all();

    await deleteItems([(await itemRepo.get('p'))!]);
    expect((await itemRepo.all()).map((i) => i.id).sort()).toEqual(['other']);

    await useUiStore.getState().undo();

    const after = await itemRepo.all();
    expect(after).toHaveLength(before.length);
    expect(relationships(after)).toEqual(relationships(before));
  });

  it('handles a selection containing both a parent and its child', async () => {
    await itemRepo.createMany([
      task('p', 'Parent'),
      task('c', 'Child', 'p'),
      task('g', 'Grandchild', 'c'),
    ]);
    const before = await itemRepo.all();

    await deleteItems([(await itemRepo.get('p'))!, (await itemRepo.get('c'))!]);
    expect(await itemRepo.all()).toHaveLength(0);

    await useUiStore.getState().undo();

    const after = await itemRepo.all();
    expect(after).toHaveLength(before.length);
    expect(relationships(after)).toEqual(relationships(before));
  });
});
