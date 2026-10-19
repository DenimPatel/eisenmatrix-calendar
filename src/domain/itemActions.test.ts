import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { itemRepo, reminderLogRepo, type ItemPatch } from '@/db/repository';
import { useUiStore } from '@/store/useUiStore';
import { createItem, normalizeItem } from './itemFactory';
import {
  createItemsPersisted,
  deleteItem,
  deleteItems,
  pruneItemReminders,
  saveItem,
  setStatus,
  skipOccurrence,
  todayOccKey,
  toggleDone,
  updateOccurrence,
  updateRecurring,
} from './itemActions';
import { expandOccurrences, resolveOccurrenceStatus } from './recurrence';
import { upcomingReminders } from './reminders';
import { habitStreak } from './stats';
import { formatISODate, parseLocalDate } from '@/lib/date';
import { addDays } from 'date-fns';
import type { HabitItem, Item, Occurrence, RecurrenceRule, Reminder, TaskItem } from '@/types';

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
  return items
    .map((i) => [i.id, i.parentId] as [string, string | null])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function weeklyTask(id: string): TaskItem {
  const item = normalizeItem({
    ...createItem({
      kind: 'task',
      title: 'Standup',
      notes: 'base notes',
      start: '2026-07-13T09:00',
      end: '2026-07-13T10:00',
      allDay: false,
      tags: ['work'],
      reminders: [{ id: 'r1', offsetMinutes: -10 }],
    }),
    id,
  }) as TaskItem;
  item.data = { estimateMinutes: 15 };
  item.recurrence = {
    freq: 'weekly',
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
  };
  return item;
}

/** Everything but the recurrence rule, the occurrence states and `patchItem`'s bookkeeping. */
function seriesOf(item: Item) {
  const {
    recurrence: _rule,
    occurrences: _occurrences,
    history: _history,
    updatedAt: _updatedAt,
    ...rest
  } = item;
  return rest;
}

/** What a card for this occurrence would show. */
function displayed(occ: Occurrence) {
  return {
    title: occ.item.title,
    notes: occ.item.notes,
    start: occ.start,
    end: occ.end,
    allDay: occ.allDay,
    status: occ.status,
  };
}

function occurrenceAt(item: Item, occKey: string): Occurrence {
  const date = new Date(`${occKey}T00:00:00`);
  return expandOccurrences(item, date, date)[0];
}

beforeEach(async () => {
  await db.items.clear();
  useUiStore.getState().clearUndo();
  useUiStore.setState({ toasts: [] });
});

afterAll(async () => {
  await db.delete();
});

describe('saveItem', () => {
  it('pushes a single create entry whose undo removes the new row', async () => {
    useUiStore.getState().pushUndo({ label: 'Prior', run: () => {} });
    const created = createItem({ kind: 'task', title: 'New task' });
    await saveItem(created);
    const stack = useUiStore.getState().undoStack;
    expect(stack).toHaveLength(2);
    expect(stack[1].label).toBe('Create “New task”');

    expect(await itemRepo.get(created.id)).toBeDefined();
    expect(await useUiStore.getState().undo()).toBe(true);

    expect(await itemRepo.get(created.id)).toBeUndefined();
    const remaining = useUiStore.getState().undoStack;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].label).toBe('Prior');
  });

  it('removes the subtasks saved before the parent on undo, leaving unrelated rows', async () => {
    const parent = createItem({ kind: 'task', title: 'Parent' });
    await createItemsPersisted([task('child', 'Child', parent.id)]);
    await itemRepo.createMany([
      task('other', 'Unrelated'),
      task('other-child', 'Other child', 'other'),
    ]);

    await saveItem(parent);
    expect(useUiStore.getState().undoStack.map((entry) => entry.label)).toEqual([
      'Create 1 items',
      'Create “Parent”',
    ]);

    expect(await useUiStore.getState().undo()).toBe(true);

    expect(await itemRepo.get(parent.id)).toBeUndefined();
    const remaining = await itemRepo.all();
    expect(remaining.map((item) => item.id).sort()).toEqual(['other', 'other-child']);
    expect(remaining.some((item) => item.parentId === parent.id)).toBe(false);
  });

  it('keeps the create entry when silent and suppresses only the toast', async () => {
    const created = createItem({ kind: 'task', title: 'Quiet task' });
    await saveItem(created, { silent: true });
    expect(useUiStore.getState().undoStack.map((entry) => entry.label)).toEqual([
      'Create “Quiet task”',
    ]);
    expect(useUiStore.getState().toasts).toEqual([]);
  });

  it('pushes one edit entry, not a second create entry, when the item exists', async () => {
    const item = createItem({ kind: 'task', title: 'Existing' });
    await itemRepo.create(item);
    await saveItem({ ...item, title: 'Renamed' });
    expect(useUiStore.getState().undoStack.map((entry) => entry.label)).toEqual(['Edit “Renamed”']);
  });

  it('accumulates one history entry per changed edit and undoes them newest-first', async () => {
    const created = createItem({ kind: 'task', title: 'Draft', notes: 'base' });
    await saveItem(created);

    const first = { ...created, title: 'First', notes: 'one' };
    await saveItem(first);
    await saveItem({ ...first, title: 'Second' });

    const edited = (await itemRepo.get(created.id))!;
    expect(edited.history.map((entry) => [entry.field, entry.oldValue, entry.newValue])).toEqual([
      ['Title', 'Draft', 'First'],
      ['Notes', 'base', 'one'],
      ['Title', 'First', 'Second'],
    ]);
    expect(useUiStore.getState().undoStack).toHaveLength(3);

    expect(await useUiStore.getState().undo()).toBe(true);
    expect((await itemRepo.get(created.id))!.title).toBe('First');

    expect(await useUiStore.getState().undo()).toBe(true);
    const restored = (await itemRepo.get(created.id))!;
    expect(restored.title).toBe('Draft');
    expect(restored.notes).toBe('base');
    expect(restored.history).toEqual([]);

    expect(await useUiStore.getState().undo()).toBe(true);
    expect(await itemRepo.get(created.id)).toBeUndefined();
  });
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

  it('does nothing for an empty selection', async () => {
    await itemRepo.createMany([task('p', 'Parent'), task('c', 'Child', 'p')]);
    const before = await itemRepo.all();
    const toastsBefore = useUiStore.getState().toasts;
    useUiStore.getState().pushUndo({ label: 'Prior', run: () => {} });

    await deleteItems([]);

    const stack = useUiStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[0].label).toBe('Prior');
    expect(useUiStore.getState().toasts).toEqual(toastsBefore);
    expect(await itemRepo.all()).toEqual(before);
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

describe('skipOccurrence', () => {
  const OCC = '2026-07-20';
  const OTHER = '2026-07-27';

  it('adds the key to the exceptions and keeps the rest of the series', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await skipOccurrence(before, OCC);

    const after = (await itemRepo.get('s'))!;
    expect(after.recurrence?.exceptions).toEqual([OCC]);
    expect(seriesOf(after)).toEqual(seriesOf(before));
    // Only the skipped day disappears from expansion.
    expect(occurrenceAt(after, OCC)).toBeUndefined();
    expect(displayed(occurrenceAt(after, OTHER))).toEqual(displayed(occurrenceAt(before, OTHER)));
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(['Occurrence skipped']);
  });

  it('does not write a draft rule the editor never saved', async () => {
    await itemRepo.create(weeklyTask('s'));
    const stored = (await itemRepo.get('s'))!;
    const draft = {
      ...stored,
      recurrence: { ...stored.recurrence!, freq: 'monthly' as const },
    };

    await skipOccurrence(draft, OCC);

    const after = (await itemRepo.get('s'))!;
    expect(after.recurrence?.freq).toBe('weekly');
    expect(after.recurrence?.exceptions).toEqual([OCC]);
  });

  it('restores the series on undo', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await skipOccurrence(before, OCC);
    expect(useUiStore.getState().undoStack).toHaveLength(1);

    await useUiStore.getState().undo();

    expect(await itemRepo.get('s')).toEqual(before);
  });

  it('writes nothing for a key that is already skipped, or without a recurrence', async () => {
    await itemRepo.create(weeklyTask('s'));
    const stored = (await itemRepo.get('s'))!;
    await skipOccurrence(stored, OCC);
    const afterFirst = (await itemRepo.get('s'))!;

    await skipOccurrence(afterFirst, OCC);
    await skipOccurrence(task('p', 'Parent'), OCC);

    expect(await itemRepo.get('s')).toEqual(afterFirst);
    expect(await itemRepo.get('p')).toBeUndefined();
    expect(useUiStore.getState().undoStack).toHaveLength(1);
  });

  it('keeps both skipped keys when two skips run concurrently', async () => {
    await itemRepo.create(weeklyTask('s'));
    const stale = (await itemRepo.get('s'))!;

    await Promise.all([skipOccurrence(stale, OCC), skipOccurrence(stale, OTHER)]);

    const after = (await itemRepo.get('s'))!;
    expect([...after.recurrence!.exceptions].sort()).toEqual([OCC, OTHER].sort());
    expect(useUiStore.getState().undoStack).toHaveLength(2);

    expect(await useUiStore.getState().undo()).toBe(true);
    expect((await itemRepo.get('s'))!.recurrence!.exceptions).toHaveLength(1);
    expect(await useUiStore.getState().undo()).toBe(true);
    expect((await itemRepo.get('s'))!.recurrence!.exceptions).toEqual([]);
  });
});

describe('toggleDone (plain item)', () => {
  it('marks a task done and back, recording status history, with each undo restoring the prior row', async () => {
    const item = createItem({ kind: 'task', title: 'Plain task' });
    await itemRepo.create(item);
    const before = (await itemRepo.get(item.id))!;

    await toggleDone(before);

    const done = (await itemRepo.get(item.id))!;
    expect(done.status).toBe('done');
    expect(done.completedAt).toBeGreaterThan(0);
    expect(done.history.map((entry) => entry.field)).toEqual(['Status', 'Completed At']);
    expect(useUiStore.getState().undoStack).toHaveLength(1);

    await toggleDone(done);

    const todo = (await itemRepo.get(item.id))!;
    expect(todo.status).toBe('todo');
    expect(todo.completedAt).toBeNull();
    expect(todo.history).toHaveLength(4);
    expect(useUiStore.getState().undoStack).toHaveLength(2);

    expect(await useUiStore.getState().undo()).toBe(true);
    expect((await itemRepo.get(item.id))!.status).toBe('done');

    expect(await useUiStore.getState().undo()).toBe(true);
    expect(await itemRepo.get(item.id)).toEqual(before);
  });
});

describe('toggleDone (occurrence)', () => {
  const OCC = '2026-07-20';
  const OTHER = '2026-07-27';

  it('toggles only the targeted occurrence and restores it on undo', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await toggleDone(before, OCC);

    const after = (await itemRepo.get('s'))!;
    expect(after.occurrences[OCC]).toMatchObject({ status: 'done' });
    expect(after.occurrences[OCC].completedAt).toBeGreaterThan(0);
    expect(after.occurrences[OTHER]).toBeUndefined();
    expect(after.status).toBe('todo');
    expect(displayed(occurrenceAt(after, OCC))).toMatchObject({ status: 'done' });
    expect(displayed(occurrenceAt(after, OTHER))).toEqual(displayed(occurrenceAt(before, OTHER)));

    expect(await useUiStore.getState().undo()).toBe(true);
    expect(await itemRepo.get('s')).toEqual(before);
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

  it('derives the streak atomically so concurrent toggles match the final state', async () => {
    const yesterday = dayOffset(-1);
    const today = todayOccKey();
    await itemRepo.create(habit('h', yesterday));
    const before = await storedHabit('h');

    await Promise.all([toggleDone(before, yesterday), toggleDone(before, today)]);

    const after = await storedHabit('h');
    expect(after.occurrences[yesterday]?.status).toBe('done');
    expect(after.occurrences[today]?.status).toBe('done');
    // The persisted streak must describe the final occurrence state, not a stale snapshot.
    expect(after.data.streak).toEqual(habitStreak(after));
    expect(after.data.streak.current).toBe(2);
    expect(useUiStore.getState().undoStack).toHaveLength(2);
  });

  it('writes the occurrence and the derived streak in a single row write', async () => {
    await itemRepo.create(habit('h', today));
    const before = await storedHabit('h');

    let writes = 0;
    const count = () => {
      writes++;
    };
    const updating = db.items.hook('updating');
    const creating = db.items.hook('creating');
    updating.subscribe(count);
    creating.subscribe(count);
    try {
      await toggleDone(before, today);
    } finally {
      updating.unsubscribe(count);
      creating.unsubscribe(count);
    }

    expect(writes).toBe(1);
    expect((await storedHabit('h')).data.streak.current).toBe(1);
  });
});

describe('setStatus (occurrences)', () => {
  const K1 = '2026-07-20';
  const K2 = '2026-07-21';

  it('merges into the persisted map so a stale snapshot cannot drop a sibling write', async () => {
    await itemRepo.create(habit('h', K1));
    const stale = await storedHabit('h');

    await setStatus(stale, 'done', K1);
    await setStatus(stale, 'done', K2);

    const after = await storedHabit('h');
    expect(after.occurrences[K1]?.status).toBe('done');
    expect(after.occurrences[K2]?.status).toBe('done');
    expect(useUiStore.getState().undoStack).toHaveLength(2);

    expect(await useUiStore.getState().undo()).toBe(true);
    const firstUndo = await storedHabit('h');
    expect(firstUndo.occurrences[K1]?.status).toBe('done');
    expect(firstUndo.occurrences[K2]).toBeUndefined();

    expect(await useUiStore.getState().undo()).toBe(true);
    const restored = await storedHabit('h');
    expect(restored.occurrences[K1]).toBeUndefined();
    expect(restored.occurrences[K2]).toBeUndefined();
  });

  it('persists both keys when two status writes run concurrently', async () => {
    await itemRepo.create(habit('h', K1));
    const stale = await storedHabit('h');

    await Promise.all([setStatus(stale, 'done', K1), setStatus(stale, 'done', K2)]);

    const after = await storedHabit('h');
    expect(after.occurrences[K1]?.status).toBe('done');
    expect(after.occurrences[K2]?.status).toBe('done');
    expect(useUiStore.getState().undoStack).toHaveLength(2);

    expect(await useUiStore.getState().undo()).toBe(true);
    const firstUndo = await storedHabit('h');
    expect([firstUndo.occurrences[K1], firstUndo.occurrences[K2]].filter(Boolean)).toHaveLength(1);

    expect(await useUiStore.getState().undo()).toBe(true);
    expect((await storedHabit('h')).occurrences).toEqual({});
  });

  it('writes nothing and pushes no undo entry when the persisted status already matches', async () => {
    await itemRepo.create(habit('h', K1));
    await setStatus(await storedHabit('h'), 'done', K1);
    const persisted = await storedHabit('h');
    const undoDepth = useUiStore.getState().undoStack.length;

    await setStatus({ ...persisted, occurrences: {} }, 'done', K1);

    expect(useUiStore.getState().undoStack).toHaveLength(undoDepth);
    expect(await storedHabit('h')).toEqual(persisted);
  });
});

describe('updateRecurring (scope: occurrence)', () => {
  const OCC = '2026-07-20';
  const OTHER = '2026-07-27';

  /** The whole draft as the editor hands it over, series-only fields included. */
  const fullPatch = {
    title: 'Standup (retro)',
    notes: 'retro notes',
    status: 'done' as const,
    urgency: 'high' as const,
    importance: 'high' as const,
    tags: ['retro'],
    allDay: true,
    start: '2026-07-20T11:00',
    end: '2026-07-20T12:00',
    reminders: [{ id: 'r2', offsetMinutes: -5 }],
    data: { estimateMinutes: 45 },
  };

  it('writes only the override, leaving every series field untouched', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, fullPatch);

    const after = (await itemRepo.get('s'))!;
    expect(after.recurrence?.overrides).toEqual({
      [OCC]: {
        start: '2026-07-20T11:00',
        end: '2026-07-20T12:00',
        allDay: true,
        title: 'Standup (retro)',
        notes: 'retro notes',
      },
    });
    expect(seriesOf(after)).toEqual(seriesOf(before));
    // Status is the one field an occurrence owns outside the override, and it lands in the
    // same map the card checkbox writes.
    expect(Object.keys(after.occurrences)).toEqual([OCC]);
    expect(after.occurrences[OCC]).toMatchObject({ status: 'done' });
    expect(after.occurrences[OCC].completedAt).toBeGreaterThan(0);
    expect(after.history).toHaveLength(1);
    expect(after.history[0]).toMatchObject({ field: 'Recurrence' });
    expect(after.history[0].newValue).toContain('"2026-07-20"');
  });

  it('keeps the occurrence status, its checkbox and the resolved status in agreement', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, { status: 'doing' });
    const markedDoing = (await itemRepo.get('s'))!;
    expect(markedDoing.occurrences[OCC]).toMatchObject({ status: 'doing', completedAt: null });
    expect(occurrenceAt(markedDoing, OCC).status).toBe('doing');
    // No second copy of the status anywhere.
    expect('status' in (markedDoing.recurrence!.overrides[OCC] ?? {})).toBe(false);

    await toggleDone(markedDoing, OCC);
    const ticked = (await itemRepo.get('s'))!;
    expect(ticked.occurrences[OCC].status).toBe('done');
    expect(occurrenceAt(ticked, OCC).status).toBe('done');
    expect(ticked.occurrences[OCC].completedAt).toBeGreaterThan(0);

    await toggleDone(ticked, OCC);
    const unticked = (await itemRepo.get('s'))!;
    expect(unticked.occurrences[OCC]).toMatchObject({ status: 'todo', completedAt: null });
    expect(occurrenceAt(unticked, OCC).status).toBe('todo');
  });

  it('erases a legacy override status when the occurrence status is written', async () => {
    const item = weeklyTask('s');
    item.recurrence!.overrides = { [OCC]: { status: 'doing', start: '2026-07-20T16:30' } };
    await itemRepo.create(item);
    const before = (await itemRepo.get('s'))!;

    // Legacy rows show the override status until something writes the occurrence state.
    expect(occurrenceAt(before, OCC).status).toBe('doing');

    await toggleDone(before, OCC);

    const after = (await itemRepo.get('s'))!;
    expect(after.occurrences[OCC]).toMatchObject({ status: 'done' });
    expect(after.recurrence!.overrides[OCC]).toEqual({ start: '2026-07-20T16:30' });
    expect(occurrenceAt(after, OCC).status).toBe('done');

    await toggleDone(after, OCC);
    const unticked = (await itemRepo.get('s'))!;
    expect(unticked.occurrences[OCC]).toMatchObject({ status: 'todo', completedAt: null });
    expect(occurrenceAt(unticked, OCC).status).toBe('todo');
  });

  it('ignores a draft recurrence rule when scoping to a single occurrence', async () => {
    await itemRepo.create(weeklyTask('s'));
    const stored = (await itemRepo.get('s'))!;
    const draft = {
      ...stored,
      recurrence: { ...stored.recurrence!, freq: 'monthly' as const, overrides: {} },
    };

    await updateRecurring(draft, 'occurrence', OCC, { title: 'Standup (retro)' });

    const after = (await itemRepo.get('s'))!;
    expect(after.recurrence?.freq).toBe('weekly');
    expect(after.recurrence?.overrides).toEqual({ [OCC]: { title: 'Standup (retro)' } });
  });

  it('reports whether it wrote anything', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    expect(await updateRecurring(before, 'occurrence', OCC, {})).toBe(false);
    expect(await updateRecurring(before, 'occurrence', OCC, { title: 'Standup (retro)' })).toBe(
      true,
    );
  });

  it('does not re-anchor the base start, end or urgency', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, fullPatch);

    const after = (await itemRepo.get('s'))!;
    expect(after.title).toBe('Standup');
    expect(after.start).toBe('2026-07-13T09:00');
    expect(after.end).toBe('2026-07-13T10:00');
    expect(after.allDay).toBe(false);
    expect(after.status).toBe('todo');
    expect(after.urgency).toBe('low');
    expect(after.importance).toBe('low');
    expect(after.tags).toEqual(['work']);
    expect(after.reminders).toEqual([{ id: 'r1', offsetMinutes: -10 }]);
    expect(after.data).toEqual(before.data);
    expect(after.recurrence).toEqual({
      ...before.recurrence,
      overrides: after.recurrence?.overrides,
    });
  });

  it('leaves every other occurrence of the series displaying the same values', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;
    const beforeOther = displayed(occurrenceAt(before, OTHER));

    await updateRecurring(before, 'occurrence', OCC, fullPatch);

    const after = (await itemRepo.get('s'))!;
    expect(displayed(occurrenceAt(after, OTHER))).toEqual(beforeOther);
    expect(displayed(occurrenceAt(after, '2026-07-13'))).toEqual(
      displayed(occurrenceAt(before, '2026-07-13')),
    );
    expect(displayed(occurrenceAt(after, OCC))).not.toEqual(displayed(occurrenceAt(before, OCC)));
  });

  it('keeps an existing override when a later edit changes another field', async () => {
    const item = weeklyTask('s');
    item.recurrence!.overrides = { [OCC]: { start: '2026-07-20T16:30' } };
    await itemRepo.create(item);
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, { title: 'Standup (retro)' });

    expect((await itemRepo.get('s'))!.recurrence?.overrides[OCC]).toEqual({
      start: '2026-07-20T16:30',
      title: 'Standup (retro)',
    });
  });

  it('writes nothing when the occurrence edit changes nothing', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, {});

    expect(await itemRepo.get('s')).toEqual(before);
    expect(useUiStore.getState().undoStack).toHaveLength(0);
  });

  it('keeps the occurrence date when an occurrence-scope patch changes only the time', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, { start: '2026-07-20T14:45' });

    const after = (await itemRepo.get('s'))!;
    expect(after.recurrence?.overrides[OCC]).toEqual({ start: '2026-07-20T14:45' });
    expect(after.start).toBe('2026-07-13T09:00');
    expect(occurrenceAt(after, OCC).start).toBe('2026-07-20T14:45');
  });

  it('restores the series on undo', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, fullPatch);
    expect(useUiStore.getState().undoStack).toHaveLength(1);

    await useUiStore.getState().undo();

    expect(await itemRepo.get('s')).toEqual(before);
  });

  it('keeps both overrides when two occurrence edits run concurrently', async () => {
    await itemRepo.create(weeklyTask('s'));
    const stale = (await itemRepo.get('s'))!;

    await Promise.all([
      updateRecurring(stale, 'occurrence', OCC, { title: 'Retro' }),
      updateRecurring(stale, 'occurrence', OTHER, { title: 'Planning' }),
    ]);

    const after = (await itemRepo.get('s'))!;
    expect(after.recurrence?.overrides).toEqual({
      [OCC]: { title: 'Retro' },
      [OTHER]: { title: 'Planning' },
    });
    expect(useUiStore.getState().undoStack).toHaveLength(2);

    expect(await useUiStore.getState().undo()).toBe(true);
    expect((await itemRepo.get('s'))!.recurrence?.overrides).toEqual({ [OCC]: { title: 'Retro' } });
    expect(await useUiStore.getState().undo()).toBe(true);
    expect((await itemRepo.get('s'))!.recurrence?.overrides).toEqual({});
  });

  it('still applies every field to the whole series for scope "all"', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'all', OCC, fullPatch);

    const after = (await itemRepo.get('s'))!;
    expect(after.title).toBe('Standup (retro)');
    expect(after.start).toBe('2026-07-20T11:00');
    expect(after.urgency).toBe('high');
    expect(after.recurrence?.overrides).toEqual({});
  });
});

describe('updateRecurring (scope: future)', () => {
  const OCC = '2026-07-20';
  const WIDE = { from: new Date('2020-01-01T00:00:00'), to: new Date('2030-01-01T00:00:00') };

  function countedWeeklyTask(id: string): TaskItem {
    const item = weeklyTask(id);
    item.recurrence = { ...item.recurrence!, count: 10 };
    return item;
  }

  function occurrences(item: Item): string[] {
    return expandOccurrences(item, WIDE.from, WIDE.to).map((o) => o.occKey);
  }

  async function tailOf(): Promise<Item> {
    const items = await db.items.toArray();
    expect(items).toHaveLength(2);
    return items[0].id === 's' ? items[1] : items[0];
  }

  it('anchors the tail on the split day and keeps the series total', async () => {
    await itemRepo.create(countedWeeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'future', OCC, { title: 'Standup (retro)' });

    const tail = await tailOf();
    expect(tail.title).toBe('Standup (retro)');
    expect(tail.start).toBe('2026-07-20T09:00');
    expect(tail.recurrence?.count).toBe(9);
    const head = (await itemRepo.get('s'))!;
    expect(head.recurrence?.until).toBe('2026-07-19');
    const union = [...new Set([...occurrences(head), ...occurrences(tail)])];
    expect(union).toEqual(occurrences(before));
    expect(union).toHaveLength(10);
  });

  it('partitions per-occurrence state between head and tail for "this and future"', async () => {
    const item = countedWeeklyTask('s');
    item.occurrences = {
      '2026-07-13': { status: 'done', completedAt: 1 },
      '2026-07-20': { status: 'done', completedAt: 2 },
      '2026-07-27': { status: 'cancelled', completedAt: null },
    };
    await itemRepo.create(item);
    const stored = (await itemRepo.get('s'))!;

    await updateRecurring(stored, 'future', OCC, { title: 'Standup (retro)' });

    const head = (await itemRepo.get('s'))!;
    const tail = await tailOf();
    // The head keeps only what it can still expand; the tail carries its own states.
    expect(head.occurrences).toEqual({ '2026-07-13': { status: 'done', completedAt: 1 } });
    expect(tail.occurrences).toEqual({
      '2026-07-20': { status: 'done', completedAt: 2 },
      '2026-07-27': { status: 'cancelled', completedAt: null },
    });
    const headKeys = occurrences(head);
    const statusAt = (key: string) =>
      headKeys.includes(key)
        ? resolveOccurrenceStatus(head, key).status
        : resolveOccurrenceStatus(tail, key).status;
    for (const key of occurrences(stored)) {
      expect(statusAt(key)).toBe(resolveOccurrenceStatus(stored, key).status);
    }
  });

  it('persists an edited recurrence rule on the tail for "this and future"', async () => {
    await itemRepo.create(countedWeeklyTask('s'));
    const stored = (await itemRepo.get('s'))!;
    const edited: RecurrenceRule = {
      freq: 'daily',
      interval: 1,
      weekStartsOn: 1,
      exceptions: [],
      overrides: {},
    };

    await updateRecurring(stored, 'future', OCC, { title: 'Standup (retro)', recurrence: edited });

    const tail = await tailOf();
    expect(tail.recurrence).toEqual(edited);
    // The head keeps the pre-split rule, only bounded at the split.
    const head = (await itemRepo.get('s'))!;
    expect(head.recurrence?.freq).toBe('weekly');
    expect(head.recurrence?.until).toBe('2026-07-19');
  });

  it('applies a start the editor actually changed', async () => {
    await itemRepo.create(countedWeeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'future', OCC, {
      title: 'Standup (retro)',
      start: '2026-07-21T11:00',
    });

    expect((await tailOf()).start).toBe('2026-07-21T11:00');
  });

  it('drops a tail end the patched start leaves behind', async () => {
    await itemRepo.create(countedWeeklyTask('s'));
    const stored = (await itemRepo.get('s'))!;

    // The editor sends start/end/dueAt back on every save; only `start` was actually edited, so
    // the shifted end (2026-07-20) is kept while the start moves to 2026-07-25.
    await updateRecurring(stored, 'future', OCC, {
      start: '2026-07-25T11:00',
      end: stored.end,
      dueAt: stored.dueAt,
    });

    const tail = await tailOf();
    expect(tail.start).toBe('2026-07-25T11:00');
    expect(tail.end).toBeNull();
    for (const item of await itemRepo.all()) {
      if (item.start && item.end) {
        expect(parseLocalDate(item.end)!.getTime()).toBeGreaterThanOrEqual(
          parseLocalDate(item.start)!.getTime(),
        );
      }
    }
  });

  it('writes no tail when the split lands past the series’ last occurrence', async () => {
    const item = countedWeeklyTask('s');
    // Weekly from 2026-07-13: the only occurrence is 2026-07-13, so 2026-07-20 is past the end.
    item.recurrence = { ...item.recurrence!, until: '2026-07-14' };
    await itemRepo.create(item);
    const before = (await itemRepo.get('s'))!;

    const written = await updateRecurring(before, 'future', OCC, { title: 'Standup (retro)' });

    expect(written).toBe(false);
    expect(await itemRepo.all()).toEqual([before]);
    expect(useUiStore.getState().undoStack).toHaveLength(0);
    const toasts = useUiStore.getState().toasts;
    expect(toasts[toasts.length - 1]?.message).toMatch(/no later occurrences/i);
    for (const persisted of await itemRepo.all()) {
      if (persisted.recurrence) expect(occurrences(persisted).length).toBeGreaterThan(0);
    }
  });

  /**
   * The editor's `seriesPatch` always sends `start`/`end`/`dueAt`, so a save with no date
   * edit hands the branch the stored dates back. Unless they are recognised as untouched,
   * they overwrite the tail's new anchor and the whole count fix silently loses occurrences.
   */
  it('keeps the tail on the split day when the patch repeats the stored dates', async () => {
    await itemRepo.create(countedWeeklyTask('s'));
    const stored = (await itemRepo.get('s'))!;
    const seriesPatchOf = (draft: Item): ItemPatch => ({
      title: draft.title,
      notes: draft.notes,
      status: draft.status,
      urgency: draft.urgency,
      importance: draft.importance,
      tags: draft.tags,
      listId: draft.listId,
      checklist: draft.checklist,
      allDay: draft.allDay,
      start: draft.start,
      end: draft.end,
      dueAt: draft.dueAt,
      reminders: draft.reminders,
      data: draft.data,
      recurrence: draft.recurrence,
    });

    await updateRecurring(stored, 'future', OCC, {
      ...seriesPatchOf(stored),
      title: 'Standup (retro)',
    });

    const tail = await tailOf();
    expect(tail.start).toBe('2026-07-20T09:00');
    expect(tail.end).toBe('2026-07-20T10:00');
    expect(tail.dueAt).toBe('2026-07-20T09:00');
    // An unchanged rule must not replace the split's count-adjusted tail rule.
    expect(tail.recurrence?.count).toBe(9);
    const head = (await itemRepo.get('s'))!;
    expect(head.start).toBe('2026-07-13T09:00');
    expect(head.end).toBe('2026-07-13T10:00');
    expect(head.dueAt).toBe('2026-07-13T09:00');
    const union = [...occurrences(head), ...occurrences(tail)].sort();
    expect(union).toEqual(occurrences(stored));
    expect(union).toHaveLength(10);
  });

  it('leaves the head untouched and applies the patch only to the tail', async () => {
    await itemRepo.create(countedWeeklyTask('s'));
    const before = (await itemRepo.get('s'))!;
    // The editor hands over the already-patched draft as `item`, not the persisted row.
    const draft: Item = { ...before, title: 'Standup (retro)', notes: 'retro notes' };

    await updateRecurring(draft, 'future', OCC, { title: draft.title, notes: draft.notes });

    const head = (await itemRepo.get('s'))!;
    expect(head.title).toBe('Standup');
    expect(head.notes).toBe('base notes');
    const tail = await tailOf();
    expect(tail.title).toBe('Standup (retro)');
    expect(tail.notes).toBe('retro notes');
  });

  it('leaves every occurrence before the split unchanged', async () => {
    await itemRepo.create(countedWeeklyTask('s'));
    const before = (await itemRepo.get('s'))!;
    const pastKey = '2026-07-13';
    const past = displayed(occurrenceAt(before, pastKey));
    const draft: Item = { ...before, title: 'Standup (retro)' };

    await updateRecurring(draft, 'future', OCC, { title: draft.title });

    const head = (await itemRepo.get('s'))!;
    expect(displayed(occurrenceAt(head, pastKey))).toEqual(past);
  });

  it('pushes one undo entry that restores the original and removes the created tail', async () => {
    await itemRepo.create(countedWeeklyTask('s'));
    const before = (await itemRepo.get('s'))!;
    const beforeAll = await itemRepo.all();
    const draft: Item = { ...before, title: 'Standup (retro)' };

    await updateRecurring(draft, 'future', OCC, { title: draft.title });
    expect(useUiStore.getState().undoStack).toHaveLength(1);
    expect(await itemRepo.all()).toHaveLength(2);

    expect(await useUiStore.getState().undo()).toBe(true);

    expect(await itemRepo.all()).toEqual(beforeAll);
  });

  it('patches the row instead of splitting when the stored row has no recurrence', async () => {
    await itemRepo.create(
      normalizeItem({
        ...createItem({
          kind: 'task',
          title: 'Plain',
          start: '2026-07-13T09:00',
          end: '2026-07-13T10:00',
        }),
        id: 'p',
      }),
    );
    const before = (await itemRepo.get('p'))!;
    expect(before.recurrence).toBeNull();
    // The editor shape: a draft carrying a newly added rule, plus a series patch that (like the
    // editor's) does not repeat the rule.
    const draft: Item = {
      ...before,
      title: 'Plain (weekly)',
      recurrence: {
        freq: 'weekly',
        interval: 1,
        weekStartsOn: 1,
        exceptions: [],
        overrides: {},
      },
    };

    await updateRecurring(draft, 'future', '2026-07-13', { title: 'Plain (weekly)' });

    const after = await itemRepo.all();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('p');
    expect(after[0].title).toBe('Plain (weekly)');
    expect(after[0].recurrence?.freq).toBe('weekly');
    expect(useUiStore.getState().undoStack).toHaveLength(1);

    expect(await useUiStore.getState().undo()).toBe(true);

    const undone = await itemRepo.all();
    expect(undone).toHaveLength(1);
    expect(undone[0].id).toBe('p');
    expect(undone[0].title).toBe('Plain');
    expect(undone[0].recurrence).toBeNull();
  });
});

describe('updateRecurring (scope: occurrence) resolved ranges', () => {
  const OCC = '2026-07-20';
  const OTHER = '2026-07-27';

  function allDaySeries(id: string): Item {
    const item = normalizeItem({
      ...createItem({
        kind: 'event',
        title: 'Conference',
        start: '2026-07-13',
        end: '2026-07-13',
        allDay: true,
      }),
      id,
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

  function rangeOf(occ: Occurrence): { from: number; to: number } {
    expect(occ.end).not.toBeNull();
    return {
      from: parseLocalDate(occ.start)!.getTime(),
      to: parseLocalDate(occ.end!)!.getTime(),
    };
  }

  it('moves the end with an occurrence the editor moved to another day', async () => {
    await itemRepo.create(allDaySeries('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, { start: '2026-07-15' });

    const after = (await itemRepo.get('s'))!;
    expect(displayed(occurrenceAt(after, OCC))).toMatchObject({
      start: '2026-07-15',
      end: '2026-07-15',
    });
    expect(displayed(occurrenceAt(after, OTHER))).toMatchObject({
      start: '2026-07-27',
      end: '2026-07-27',
    });
  });

  it('keeps the range ordered when one occurrence is switched off all-day', async () => {
    await itemRepo.create(allDaySeries('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, { start: '2026-07-20T09:00', allDay: false });

    const after = (await itemRepo.get('s'))!;
    const moved = occurrenceAt(after, OCC);
    expect(moved.allDay).toBe(false);
    expect(moved.start).toBe('2026-07-20T09:00');
    expect(rangeOf(moved).to).toBeGreaterThanOrEqual(rangeOf(moved).from);
    expect(occurrenceAt(after, OTHER)).toMatchObject({
      start: '2026-07-27',
      end: '2026-07-27',
      allDay: true,
    });
  });
});

describe('pruneItemReminders', () => {
  const NOW = Date.now();

  /** Dated today, so `upcomingReminders` has an occurrence to hang an absolute off. */
  function snoozed(id: string, reminders: Reminder[]): Item {
    return normalizeItem({
      ...createItem({ kind: 'task', title: id, start: formatISODate(new Date()) }),
      id,
      reminders,
    });
  }

  /** The row minus the two fields the prune pass is allowed to touch. */
  function otherFields(item: Item): Omit<Item, 'reminders' | 'updatedAt'> {
    const { reminders: _pruned, updatedAt: _written, ...rest } = item;
    return rest;
  }

  it('drops the expired snoozes of an item and keeps its relative and pending reminders', async () => {
    await itemRepo.create(
      snoozed('s', [
        { id: 'rel', offsetMinutes: -10 },
        { id: 'past', absolute: NOW - 2 * 24 * 60 * 60_000, label: 'Snoozed 10m' },
        { id: 'pending', absolute: NOW + 10 * 60_000, label: 'Snoozed 10m' },
      ]),
    );
    const before = (await itemRepo.get('s'))!;

    const pruned = await pruneItemReminders(NOW);

    expect(pruned).toBe(1);
    const after = (await itemRepo.get('s'))!;
    expect(after.reminders.map((r) => r.id)).toEqual(['rel', 'pending']);
    // Nothing else on the row moved, and the machine pass leaves no user-facing trace.
    expect(otherFields(after)).toEqual(otherFields(before));
    expect(after.history).toEqual(before.history);
    expect(useUiStore.getState().toasts).toEqual([]);
  });

  it('writes nothing when no item holds an expired absolute', async () => {
    await itemRepo.createMany([
      snoozed('relative', [{ id: 'rel', offsetMinutes: -10 }]),
      snoozed('pending', [{ id: 'future', absolute: NOW + 60_000 }]),
      snoozed('empty', []),
    ]);
    const before = await itemRepo.all();

    expect(await pruneItemReminders(NOW)).toBe(0);
    expect(await itemRepo.all()).toEqual(before);
    // An unchanged `updatedAt` proves the pass did not rewrite rows that needed no prune,
    // which is what keeps the boot pass to a single read plus at most one bulk write.
    for (const item of await itemRepo.all()) {
      const prior = before.find((b) => b.id === item.id)!;
      expect(item.updatedAt).toBe(prior.updatedAt);
    }
  });

  it('keeps a snooze that is past but still inside the delivery lookback', async () => {
    await itemRepo.create(snoozed('s', [{ id: 'missed', absolute: NOW - 5 * 60_000 }]));

    expect(await pruneItemReminders(NOW, 24 * 60 * 60_000)).toBe(0);
    expect((await itemRepo.get('s'))!.reminders.map((r) => r.id)).toEqual(['missed']);

    // Once it is older than any tick can still deliver, the next pass reclaims it.
    expect(await pruneItemReminders(NOW)).toBe(1);
    expect((await itemRepo.get('s'))!.reminders).toEqual([]);
  });

  it('keeps the 60-minute snooze a delivered 10-minute snooze once destroyed', async () => {
    // The reported regression: 10m snooze → it fires (reminderLog row written) → 60m snooze →
    // reload. Ranking by soonness alone kept the fired row and deleted the pending request.
    const firedAt = NOW - 10 * 60_000;
    await reminderLogRepo.record('ab', '2026-07-20::fired', firedAt);
    await itemRepo.create(
      snoozed('ab', [
        { id: 'fired', absolute: firedAt, label: 'Snoozed 10m' },
        { id: 'owed', absolute: NOW + 50 * 60_000, label: 'Snoozed 60m' },
      ]),
    );

    await pruneItemReminders(NOW, 24 * 60 * 60_000);

    // Nothing is deleted: the fired row can never fire again anyway, and the pending row is
    // the one the user is still owed.
    const after = (await itemRepo.get('ab'))!;
    expect(after.reminders.map((r) => r.id)).toEqual(['fired', 'owed']);

    // And the pending request is still reachable by a tick, at its own timestamp.
    const scheduled = upcomingReminders(
      [after],
      new Date(NOW - 24 * 60 * 60_000),
      new Date(NOW + 50 * 60_000),
    ).filter((entry) => entry.reminder.id === 'owed');
    expect(scheduled.map((entry) => entry.fireAt)).toEqual([NOW + 50 * 60_000]);
  });

  it('reclaims a row the delivery window can no longer reach, from a two-snooze stack', async () => {
    await itemRepo.create(
      snoozed('stale', [
        { id: 'fired', absolute: NOW - 10 * 60_000, label: 'Snoozed 10m' },
        { id: 'owed', absolute: NOW + 50 * 60_000, label: 'Snoozed 60m' },
      ]),
    );

    // A day later the 10-minute row is outside every tick's lookback, so only it goes.
    expect(await pruneItemReminders(NOW + 24 * 60 * 60_000, 24 * 60 * 60_000)).toBe(1);
    expect((await itemRepo.get('stale'))!.reminders.map((r) => r.id)).toEqual(['owed']);
  });
});

describe('updateOccurrence (non-recurring)', () => {
  async function seed(id: string): Promise<Item> {
    const item = normalizeItem({
      ...createItem({
        kind: 'task',
        title: 'Timed',
        start: '2026-07-20T09:00',
        end: '2026-07-20T10:00',
        notes: 'original',
      }),
      id,
    });
    item.recurrence = null;
    await itemRepo.create(item);
    return item;
  }

  it('applies start, end and notes for a non-recurring item', async () => {
    const item = await seed('nr');

    await updateOccurrence(item, '2026-07-20', {
      start: '2026-07-21T09:00',
      end: '2026-07-21T10:30',
      notes: 'moved',
    });

    const stored = (await itemRepo.get('nr'))!;
    expect(stored.start).toBe('2026-07-21T09:00');
    expect(stored.end).toBe('2026-07-21T10:30');
    expect(stored.notes).toBe('moved');
  });

  it('leaves omitted fields unchanged', async () => {
    const item = await seed('nr-partial');

    await updateOccurrence(item, '2026-07-20', { start: '2026-07-21T09:00' });

    const stored = (await itemRepo.get('nr-partial'))!;
    expect(stored.start).toBe('2026-07-21T09:00');
    expect(stored.end).toBe('2026-07-20T10:00');
    expect(stored.notes).toBe('original');
  });

  it('clears end when the patch explicitly passes null', async () => {
    const item = await seed('nr-clear');

    await updateOccurrence(item, '2026-07-20', { end: null });

    const stored = (await itemRepo.get('nr-clear'))!;
    expect(stored.end).toBeNull();
    expect(stored.start).toBe('2026-07-20T09:00');
  });
});
