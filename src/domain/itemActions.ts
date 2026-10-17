import { itemRepo, type ItemPatch } from '@/db/repository';
import { newId } from '@/lib/id';
import { formatISODate } from '@/lib/date';
import { useUiStore } from '@/store/useUiStore';
import { resolveOccurrenceStatus, splitSeries } from './recurrence';
import { pruneExpiredAbsolute } from './reminders';
import { habitStreak } from './stats';
import type {
  HistoryEntry,
  Item,
  ItemStatus,
  OccurrenceState,
  Priority,
  RecurrenceRule,
} from '@/types';

function pushUndo(label: string, run: () => Promise<void> | void) {
  useUiStore.getState().pushUndo({ label, run });
}

function toast(message: string, tone: 'info' | 'success' | 'error' = 'info') {
  useUiStore.getState().pushToast({ message, tone });
}

function toastWithUndo(message: string) {
  useUiStore.getState().pushToast({
    message,
    tone: 'info',
    actionLabel: 'Undo',
    onAction: () => {
      void useUiStore.getState().undo();
    },
  });
}

function buildHistory(existing: Item, patch: ItemPatch): HistoryEntry[] {
  const timestamp = Date.now();
  const entries: HistoryEntry[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'history' || key === 'occurrences' || key === 'updatedAt' || value === undefined) {
      continue;
    }
    const oldValue = (existing as unknown as Record<string, unknown>)[key];
    const oldString =
      typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue ?? '');
    const newString = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    if (oldString === newString) continue;
    entries.push({
      id: newId(),
      timestamp,
      field: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
      oldValue: oldString,
      newValue: newString,
      user: 'User',
    });
  }
  return entries;
}

export async function createItemPersisted(item: Item): Promise<Item> {
  await itemRepo.create(item);
  pushUndo(`Create “${item.title}”`, async () => {
    await itemRepo.remove(item.id);
  });
  return item;
}

export async function createItemsPersisted(items: Item[], label?: string): Promise<void> {
  if (!items.length) return;
  await itemRepo.createMany(items);
  pushUndo(label ?? `Create ${items.length} items`, async () => {
    await itemRepo.removeMany(items.map((i) => i.id));
  });
}

/** Persist an edited item, recording a history entry for each changed field. */
export async function saveItem(item: Item, options?: { silent?: boolean }): Promise<Item> {
  const existing = await itemRepo.get(item.id);
  const patch: ItemPatch = { ...item, updatedAt: Date.now() };
  if (existing) {
    const history = [...existing.history, ...buildHistory(existing, patch)];
    await itemRepo.update(item.id, { ...patch, history });
  } else {
    await itemRepo.create({ ...item, updatedAt: Date.now() });
    pushUndo(`Create “${item.title}”`, async () => {
      await itemRepo.remove(item.id);
    });
  }
  if (existing) {
    pushUndo(`Edit “${item.title}”`, async () => {
      await itemRepo.create(existing);
    });
  }
  if (!options?.silent) toast('Saved', 'success');
  return item;
}

export async function patchItem(
  id: string,
  patch: ItemPatch,
  options?: { silent?: boolean; undoLabel?: string; trackHistory?: boolean; trackUndo?: boolean },
): Promise<Item | undefined> {
  const existing = await itemRepo.get(id);
  if (!existing) return undefined;
  const next: ItemPatch = { ...patch };
  if (options?.trackHistory !== false) {
    next.history = [...existing.history, ...buildHistory(existing, patch)];
  }
  const updated = await itemRepo.update(id, next);
  if (options?.trackUndo !== false) {
    pushUndo(options?.undoLabel ?? `Change “${existing.title}”`, async () => {
      await itemRepo.create(existing);
    });
  }
  if (!options?.silent) toast('Updated', 'success');
  return updated;
}

export async function deleteItem(item: Item): Promise<void> {
  const descendants = await itemRepo.collectDescendants(item.id);
  await itemRepo.removeWithChildren(item.id);
  pushUndo(`Delete “${item.title}”`, async () => {
    await itemRepo.createMany([item, ...descendants]);
  });
  toastWithUndo('Deleted');
}

export async function deleteItems(items: Item[]): Promise<void> {
  const deleted = [...items];
  const ids = new Set(items.map((i) => i.id));
  for (const item of items) {
    for (const descendant of await itemRepo.collectDescendants(item.id)) {
      if (ids.has(descendant.id)) continue;
      ids.add(descendant.id);
      deleted.push(descendant);
    }
  }
  await itemRepo.removeMany([...ids]);
  pushUndo(`Delete ${items.length} items`, async () => {
    await itemRepo.createMany(deleted);
  });
  toastWithUndo(`Deleted ${items.length} items`);
}

export async function archiveItem(item: Item): Promise<void> {
  await patchItem(item.id, { archivedAt: Date.now() }, { silent: true, trackHistory: false });
  toast('Archived', 'info');
}

export async function restoreItem(item: Item): Promise<void> {
  await patchItem(item.id, { archivedAt: null }, { silent: true, trackHistory: false });
  toast('Restored', 'success');
}

/** The occurrence state a status write produces, or `null` when nothing changes. */
function occurrenceStateFor(
  item: Item,
  occKey: string,
  status: ItemStatus,
  timestamp: number,
): Record<string, OccurrenceState> | null {
  const existing = item.occurrences[occKey];
  // A legacy override status is the only thing that can make a status write a no-op while the
  // occurrence still has no state, so compare against the resolved status, not the stored one.
  const resolved = resolveOccurrenceStatus(item, occKey).status;
  const completedAt = status === 'done' ? (existing?.completedAt ?? timestamp) : null;
  if (resolved === status && existing && existing.completedAt === completedAt) return null;
  return {
    ...item.occurrences,
    [occKey]: { ...existing, status, completedAt } as OccurrenceState,
  };
}

/** Rule with a legacy override status erased, so `item.occurrences` stays authoritative. */
function withoutOverrideStatus(item: Item, occKey: string): RecurrenceRule | null {
  const rule = item.recurrence;
  const override = rule?.overrides[occKey];
  if (!rule || !override?.status) return rule;
  const rest = { ...override };
  delete rest.status;
  const overrides = { ...rule.overrides };
  if (Object.keys(rest).length === 0) delete overrides[occKey];
  else overrides[occKey] = rest;
  return { ...rule, overrides };
}

export async function setStatus(
  item: Item,
  status: ItemStatus,
  occKey?: string | null,
): Promise<void> {
  const timestamp = Date.now();
  if (occKey) {
    // One occurrence's status lives in `item.occurrences` — the map `toggleDone` writes — so
    // the card checkbox, `resolveOccurrenceStatus` and the stored state always agree.
    const occurrences = occurrenceStateFor(item, occKey, status, timestamp);
    const rule = withoutOverrideStatus(item, occKey);
    if (!occurrences && rule === item.recurrence) return;
    const patch: ItemPatch = { occurrences: occurrences ?? item.occurrences };
    if (rule !== item.recurrence) patch.recurrence = rule;
    await patchItem(item.id, patch, { silent: true });
    return;
  }
  const patch: ItemPatch = {
    status,
    completedAt: status === 'done' ? timestamp : null,
  };
  await patchItem(item.id, patch, { silent: true });
}

export async function toggleDone(item: Item, occKey?: string | null): Promise<void> {
  const isDone = occKey
    ? resolveOccurrenceStatus(item, occKey).status === 'done'
    : item.status === 'done';
  const nextStatus: ItemStatus = isDone ? 'todo' : 'done';
  await setStatus(item, nextStatus, occKey);

  if (item.kind !== 'habit') return;

  // Re-read: the caller's prop can be stale, and the streak is derived from the
  // occurrence state that `setStatus` just persisted.
  const persisted = await itemRepo.get(item.id);
  if (persisted?.kind !== 'habit') return;
  const streak = habitStreak(persisted);
  // Derived state only: the occurrence write already pushed the undo entry, whose
  // snapshot carries the pre-toggle streak, so a second entry would leave the first
  // undo restoring a stale streak.
  await patchItem(
    item.id,
    { data: { ...persisted.data, streak } },
    { silent: true, trackUndo: false },
  );
}

export async function setPriority(
  item: Item,
  urgency: Priority,
  importance: Priority,
): Promise<void> {
  await patchItem(item.id, { urgency, importance }, { silent: true });
}

export async function updateOccurrence(
  item: Item,
  occKey: string,
  patch: { start?: string; end?: string | null; notes?: string },
): Promise<void> {
  const rule = item.recurrence;
  if (!rule) {
    await patchItem(item.id, { start: patch.start ?? item.start });
    return;
  }
  const overrides = {
    ...rule.overrides,
    [occKey]: { ...(rule.overrides[occKey] ?? {}), ...patch },
  };
  await patchItem(item.id, { recurrence: { ...rule, overrides } }, { silent: true });
}

/** Add `occKey` to the series exceptions so it no longer expands; the series row stays. */
export async function skipOccurrence(item: Item, occKey: string): Promise<void> {
  // The persisted row is the base: the editor hands over a draft that can carry an unsaved
  // series-wide rule, and skipping one occurrence must not write that rule.
  const stored = (await itemRepo.get(item.id)) ?? item;
  const rule = stored.recurrence;
  if (!rule || rule.exceptions.includes(occKey)) return;
  await patchItem(
    item.id,
    { recurrence: { ...rule, exceptions: [...rule.exceptions, occKey] } },
    { silent: true },
  );
  toast('Occurrence skipped', 'info');
}

/**
 * Apply an edit to a recurring series.
 * `occurrence` edits just one occurrence, `future` splits the series,
 * `all` edits the whole series. Resolves to whether a row was written.
 */
export async function updateRecurring(
  item: Item,
  scope: 'occurrence' | 'future' | 'all',
  occKey: string,
  patch: ItemPatch,
): Promise<boolean> {
  if (scope === 'occurrence') {
    // The persisted row is the base: a draft can carry a stale rule or a series-wide edit
    // (e.g. the recurrence editor) that must not reach storage for a single occurrence.
    const stored = (await itemRepo.get(item.id)) ?? item;
    const rule = stored.recurrence;
    if (!rule) return false;
    // One occurrence owns only these fields; every other field belongs to the series,
    // so applying the whole patch here would re-anchor every occurrence. `status` is
    // deliberately absent: it is per-occurrence state, not an override.
    const current = rule.overrides[occKey];
    const override = {
      ...current,
      ...(patch.start ? { start: patch.start } : {}),
      ...(patch.end !== undefined ? { end: patch.end } : {}),
      ...(patch.allDay !== undefined ? { allDay: patch.allDay } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    };
    const occurrences =
      patch.status !== undefined
        ? occurrenceStateFor(stored, occKey, patch.status, Date.now())
        : null;
    // An override with nothing left in it (status now lives in `occurrences`) is not stored.
    const overrides = { ...rule.overrides };
    if (Object.keys(override).length === 0) delete overrides[occKey];
    else overrides[occKey] = override;
    const ruleChanged = JSON.stringify(overrides) !== JSON.stringify(rule.overrides);
    if (!ruleChanged && !occurrences) return false;
    const next: ItemPatch = {};
    if (ruleChanged) next.recurrence = { ...rule, overrides };
    if (occurrences) next.occurrences = occurrences;
    await patchItem(item.id, next, { silent: true });
    return true;
  }

  if (scope === 'all') {
    await patchItem(item.id, patch, { silent: true });
    return true;
  }

  // future: split the series at occKey and apply the patch to the new tail
  const { head, tail } = splitSeries(item, occKey, newId());
  // `splitSeries` anchors the tail on the split day and hands it only the count the head
  // did not use, so a start/end/dueAt the editor left untouched must not drag the tail back
  // onto the range the head already covers.
  const stored = (await itemRepo.get(item.id)) ?? item;
  const tailPatch: ItemPatch = { ...patch };
  for (const field of ['start', 'end', 'dueAt'] as const) {
    if (tailPatch[field] === stored[field]) delete tailPatch[field];
  }
  const tailPatched: Item = {
    ...tail,
    ...tailPatch,
    id: tail.id,
    recurrence: (tailPatch.recurrence as Item['recurrence']) ?? tail.recurrence,
    updatedAt: Date.now(),
  } as Item;
  await itemRepo.create(head);
  await itemRepo.create(tailPatched);
  toast('Series split', 'success');
  return true;
}

/**
 * One prune pass for the snooze reminders a reminder list has accumulated. Snoozes append an
 * `absolute` reminder per press and nothing removed them, so the list grew without bound and
 * stale rows kept showing in the reminder editor.
 *
 * `lookbackMs` is the delivery layer's window (`LOOKBACK_MS`), not a wider grace: it is what
 * tells `pruneExpiredAbsolute` which rows a tick could still deliver, so a snooze that is past
 * but inside the window is left for the tick to fire and reclaimed by a *later* pass. Runs as a
 * boot maintenance pass, so it reads the items once and rewrites only the rows that actually
 * change; no history, undo or toast, because no user edit is being overwritten. Returns how many
 * items were rewritten.
 */
export async function pruneItemReminders(
  now: number = Date.now(),
  lookbackMs = 0,
): Promise<number> {
  const items = await itemRepo.all();
  const entries: Array<{ id: string; patch: ItemPatch }> = [];
  for (const item of items) {
    if (!item.reminders?.some((reminder) => typeof reminder.absolute === 'number')) continue;
    const reminders = pruneExpiredAbsolute(item.reminders, now, lookbackMs);
    if (reminders.length === item.reminders.length) continue;
    entries.push({ id: item.id, patch: { reminders } });
  }
  if (entries.length === 0) return 0;
  await itemRepo.updateMany(entries);
  return entries.length;
}

export function todayOccKey(): string {
  return formatISODate(new Date());
}
