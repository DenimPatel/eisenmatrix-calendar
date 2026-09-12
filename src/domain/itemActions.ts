import { itemRepo, type ItemPatch } from '@/db/repository';
import { newId } from '@/lib/id';
import { formatISODate } from '@/lib/date';
import { useUiStore } from '@/store/useUiStore';
import { splitSeries } from './recurrence';
import { habitStreak } from './stats';
import type { HistoryEntry, Item, ItemStatus, OccurrenceStatus, Priority } from '@/types';

function pushUndo(label: string, run: () => Promise<void> | void) {
  useUiStore.getState().pushUndo({ label, run });
}

function toast(message: string, tone: 'info' | 'success' | 'error' = 'info') {
  useUiStore.getState().pushToast({ message, tone });
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
  options?: { silent?: boolean; undoLabel?: string; trackHistory?: boolean },
): Promise<Item | undefined> {
  const existing = await itemRepo.get(id);
  if (!existing) return undefined;
  const next: ItemPatch = { ...patch };
  if (options?.trackHistory !== false) {
    next.history = [...existing.history, ...buildHistory(existing, patch)];
  }
  const updated = await itemRepo.update(id, next);
  pushUndo(options?.undoLabel ?? `Change “${existing.title}”`, async () => {
    await itemRepo.create(existing);
  });
  if (!options?.silent) toast('Updated', 'success');
  return updated;
}

export async function deleteItem(item: Item): Promise<void> {
  await itemRepo.removeWithChildren(item.id);
  pushUndo(`Delete “${item.title}”`, async () => {
    await itemRepo.create(item);
  });
  toast('Deleted', 'info');
}

export async function deleteItems(items: Item[]): Promise<void> {
  await itemRepo.removeMany(items.map((i) => i.id));
  pushUndo(`Delete ${items.length} items`, async () => {
    await itemRepo.createMany(items);
  });
  toast(`Deleted ${items.length} items`, 'info');
}

export async function archiveItem(item: Item): Promise<void> {
  await patchItem(item.id, { archivedAt: Date.now() }, { silent: true, trackHistory: false });
  toast('Archived', 'info');
}

export async function restoreItem(item: Item): Promise<void> {
  await patchItem(item.id, { archivedAt: null }, { silent: true, trackHistory: false });
  toast('Restored', 'success');
}

export async function setStatus(
  item: Item,
  status: ItemStatus,
  occKey?: string | null,
): Promise<void> {
  const timestamp = Date.now();
  if (occKey) {
    const existing = item.occurrences[occKey] ?? {
      status: 'todo' as OccurrenceStatus,
      completedAt: null,
    };
    const occurrences = {
      ...item.occurrences,
      [occKey]: {
        ...existing,
        status,
        completedAt: status === 'done' ? timestamp : null,
      },
    };
    await patchItem(item.id, { occurrences }, { silent: true });
    return;
  }
  const patch: ItemPatch = {
    status,
    completedAt: status === 'done' ? timestamp : null,
  };
  await patchItem(item.id, patch, { silent: true });
}

export async function toggleDone(item: Item, occKey?: string | null): Promise<void> {
  const isDone = occKey ? item.occurrences[occKey]?.status === 'done' : item.status === 'done';
  const nextStatus: ItemStatus = isDone ? 'todo' : 'done';
  await setStatus(item, nextStatus, occKey);

  if (item.kind === 'habit') {
    const updated: Item = {
      ...item,
      occurrences: occKey
        ? {
            ...item.occurrences,
            [occKey]: {
              status: nextStatus as OccurrenceStatus,
              completedAt: nextStatus === 'done' ? Date.now() : null,
            },
          }
        : item.occurrences,
    };
    const streak = habitStreak(updated);
    await itemRepo.update(item.id, { data: { ...item.data, streak } });
  }
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
  patch: { start?: string; end?: string | null; status?: OccurrenceStatus; notes?: string },
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

export async function skipOccurrence(item: Item, occKey: string): Promise<void> {
  const rule = item.recurrence;
  if (!rule) return;
  await patchItem(
    item.id,
    { recurrence: { ...rule, exceptions: [...new Set([...rule.exceptions, occKey])] } },
    { silent: true },
  );
  toast('Occurrence skipped', 'info');
}

/**
 * Apply an edit to a recurring series.
 * `occurrence` edits just one occurrence, `future` splits the series,
 * `all` edits the whole series.
 */
export async function updateRecurring(
  item: Item,
  scope: 'occurrence' | 'future' | 'all',
  occKey: string,
  patch: ItemPatch,
): Promise<void> {
  if (scope === 'occurrence') {
    const rule = item.recurrence;
    if (!rule) return;
    const overrides = {
      ...rule.overrides,
      [occKey]: {
        ...(rule.overrides[occKey] ?? {}),
        ...(patch.start ? { start: patch.start } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      },
    };
    await patchItem(item.id, { ...patch, recurrence: { ...rule, overrides } }, { silent: true });
    return;
  }

  if (scope === 'all') {
    await patchItem(item.id, patch, { silent: true });
    return;
  }

  // future: split the series at occKey and apply the patch to the new tail
  const { head, tail } = splitSeries(item, occKey, newId());
  const tailPatched: Item = {
    ...tail,
    ...patch,
    id: tail.id,
    recurrence: (patch.recurrence as Item['recurrence']) ?? tail.recurrence,
    updatedAt: Date.now(),
  } as Item;
  await itemRepo.create(head);
  await itemRepo.create(tailPatched);
  toast('Series split', 'success');
}

export function todayOccKey(): string {
  return formatISODate(new Date());
}
