import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { itemRepo } from '@/db/repository';
import { useUiStore } from '@/store/useUiStore';
import { createItem, normalizeItem } from './itemFactory';
import { deleteItem, deleteItems, todayOccKey, toggleDone } from './itemActions';
import { formatISODate } from '@/lib/date';
import { addDays } from 'date-fns';
import type { HabitItem, Item } from '@/types';

function task(id: string, title: string, parentId: string | null = null): Item {
  return normalizeItem({ ...createItem({ kind: 'task', title }), id, parentId });
}

function habit(id: string, start: string): HabitItem {
  const item = normalizeItem({
    ...createItem({ kind: 'habit', title: 'Read', start }),
    id,
  }) as HabitItem;
  item.recurrence = {
    freq: 'daily',
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
  };
  return item;
}

function dayOffset(days: number): string {
  return formatISODate(addDays(new Date(), days));
}

async function storedHabit(id: string): Promise<HabitItem> {
  return (await itemRepo.get(id)) as HabitItem;
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

describe('toggleDone (habit)', () => {
  const today = todayOccKey();

  it('records a streak history entry and restores status and streak on undo', async () => {
    await itemRepo.create(habit('h', today));
    const before = await storedHabit('h');
    expect(before.data.streak).toEqual({ current: 0, best: 0, lastAt: null });

    await toggleDone(before, today);

    const toggled = await storedHabit('h');
    expect(toggled.occurrences[today]).toMatchObject({ status: 'done' });
    expect(toggled.data.streak).toEqual({ current: 1, best: 1, lastAt: today });
    const streakEntry = toggled.history.find((entry) => entry.field === 'Data');
    expect(streakEntry?.oldValue).toContain('"current":0');
    expect(streakEntry?.newValue).toContain('"current":1');

    await useUiStore.getState().undo();

    const undone = await storedHabit('h');
    expect(undone.occurrences[today]?.status ?? 'todo').toBe('todo');
    expect(undone.data.streak).toEqual(before.data.streak);
    expect(undone).toEqual(before);
  });

  it('pushes a single undo entry so one undo reverts the whole toggle', async () => {
    await itemRepo.create(habit('h', today));
    const before = await storedHabit('h');

    await toggleDone(before, today);
    expect(useUiStore.getState().undoStack).toHaveLength(1);

    expect(await useUiStore.getState().undo()).toBe(true);
    expect(await itemRepo.get('h')).toEqual(before);
  });

  it('computes the streak from the persisted occurrences, not the stale prop', async () => {
    await itemRepo.create(habit('h', dayOffset(-4)));
    const stored = await storedHabit('h');
    stored.occurrences[dayOffset(-2)] = { status: 'done', completedAt: 1 };
    stored.occurrences[dayOffset(-1)] = { status: 'done', completedAt: 1 };
    await itemRepo.create(stored);
    // A caller holding an older snapshot: its occurrence map is empty.
    const stale = { ...stored, occurrences: {} };

    await toggleDone(stale);

    expect((await storedHabit('h')).data.streak).toEqual({
      current: 2,
      best: 2,
      lastAt: dayOffset(-1),
    });
  });
});
