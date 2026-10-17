import { useMemo, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { liveQuery } from 'dexie';
import { itemRepo, listRepo, settingsRepo } from '@/db/repository';
import type { Item, List } from '@/types';

const EMPTY_ITEMS: Item[] = [];

let itemsSource: Item[] = EMPTY_ITEMS;
let visibleItems: Item[] | null = null;
let archivedItems: Item[] | null = null;
let itemsError: unknown = null;
let itemsSubscription: { unsubscribe(): void } | null = null;
const itemsListeners = new Set<() => void>();

function notifyItemsListeners(): void {
  for (const listener of itemsListeners) listener();
}

function setItemsSource(items: Item[]): void {
  if (items === itemsSource && !itemsError) return;
  itemsSource = items;
  visibleItems = null;
  archivedItems = null;
  itemsError = null;
  notifyItemsListeners();
}

function setItemsError(error: unknown): void {
  itemsError = error;
  notifyItemsListeners();
}

function subscribeItems(listener: () => void): () => void {
  itemsListeners.add(listener);
  if (itemsListeners.size === 1) {
    itemsSubscription = liveQuery(() => itemRepo.all()).subscribe({
      next: setItemsSource,
      error: setItemsError,
    });
  }
  return () => {
    itemsListeners.delete(listener);
    if (itemsListeners.size === 0) {
      itemsSubscription?.unsubscribe();
      itemsSubscription = null;
    }
  };
}

function currentItems(): Item[] {
  if (itemsError) throw itemsError;
  return itemsSource;
}

function getVisibleItems(): Item[] {
  currentItems();
  if (visibleItems === null) visibleItems = itemsSource.filter((item) => !item.archivedAt);
  return visibleItems;
}

function getArchivedItems(): Item[] {
  currentItems();
  if (archivedItems === null) archivedItems = itemsSource.filter((item) => item.archivedAt);
  return archivedItems;
}

export function useItems(includeArchived = false): Item[] {
  return useSyncExternalStore(subscribeItems, includeArchived ? currentItems : getVisibleItems);
}

export function useArchivedItems(): Item[] {
  return useSyncExternalStore(subscribeItems, getArchivedItems);
}

export function useItem(id: string | null | undefined): Item | undefined {
  return useLiveQuery(() => (id ? itemRepo.get(id) : Promise.resolve(undefined)), [id], undefined);
}

export function useLists(): List[] {
  return useLiveQuery(() => listRepo.all(), [], [] as List[]);
}

export function useChildren(parentId: string | null | undefined): Item[] {
  return useLiveQuery(
    () => (parentId ? itemRepo.children(parentId) : Promise.resolve([] as Item[])),
    [parentId],
    [] as Item[],
  );
}

export function useSetting<T>(key: string, fallback: T): T {
  const serializedFallback = useMemo(() => JSON.stringify(fallback), [fallback]);
  return useLiveQuery(
    () => settingsRepo.get<T>(key, fallback),
    [key, serializedFallback],
    fallback,
  );
}
