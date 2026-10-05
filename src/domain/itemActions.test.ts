import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { itemRepo, type ItemPatch } from '@/db/repository';
import { useUiStore } from '@/store/useUiStore';
import { createItem, normalizeItem } from './itemFactory';
import { deleteItem, deleteItems, todayOccKey, toggleDone, updateRecurring } from './itemActions';
import { expandOccurrences } from './recurrence';
import { formatISODate, parseLocalDate } from '@/lib/date';
import { addDays } from 'date-fns';
import type { HabitItem, Item, Occurrence, TaskItem } from '@/types';

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

  it('restores the series on undo', async () => {
    await itemRepo.create(weeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'occurrence', OCC, fullPatch);
    expect(useUiStore.getState().undoStack).toHaveLength(1);

    await useUiStore.getState().undo();

    expect(await itemRepo.get('s')).toEqual(before);
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

  it('applies a start the editor actually changed', async () => {
    await itemRepo.create(countedWeeklyTask('s'));
    const before = (await itemRepo.get('s'))!;

    await updateRecurring(before, 'future', OCC, {
      title: 'Standup (retro)',
      start: '2026-07-21T11:00',
    });

    expect((await tailOf()).start).toBe('2026-07-21T11:00');
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
    });

    await updateRecurring(stored, 'future', OCC, {
      ...seriesPatchOf(stored),
      title: 'Standup (retro)',
    });

    const tail = await tailOf();
    expect(tail.start).toBe('2026-07-20T09:00');
    expect(tail.end).toBe('2026-07-20T10:00');
    expect(tail.dueAt).toBe('2026-07-20T09:00');
    const head = (await itemRepo.get('s'))!;
    expect(head.start).toBe('2026-07-13T09:00');
    expect(head.end).toBe('2026-07-13T10:00');
    expect(head.dueAt).toBe('2026-07-13T09:00');
    const union = [...occurrences(head), ...occurrences(tail)].sort();
    expect(union).toEqual(occurrences(stored));
    expect(union).toHaveLength(10);
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
