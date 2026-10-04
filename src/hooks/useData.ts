import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { itemRepo, listRepo, settingsRepo } from '@/db/repository';
import type { Item, List } from '@/types';

const EMPTY_ITEMS: Item[] = [];

export function useItems(includeArchived = false): Item[] {
  const items = useLiveQuery(() => itemRepo.all(), [], EMPTY_ITEMS);
  return useMemo(
    () => (includeArchived ? items : items.filter((item) => !item.archivedAt)),
    [items, includeArchived],
  );
}

export function useArchivedItems(): Item[] {
  const items = useLiveQuery(() => itemRepo.all(), [], EMPTY_ITEMS);
  return useMemo(() => items.filter((item) => item.archivedAt), [items]);
}

export function useItem(id: string | null | undefined): Item | undefined {
  return useLiveQuery(() => (id ? itemRepo.get(id) : Promise.resolve(undefined)), [id], undefined);
}

export function useLists(): List[] {
  const lists = useLiveQuery(() => listRepo.all(), [], [] as List[]);
  return lists ?? [];
}

export function useChildren(parentId: string | null | undefined): Item[] {
  const items = useLiveQuery(
    () => (parentId ? itemRepo.children(parentId) : Promise.resolve([] as Item[])),
    [parentId],
    [] as Item[],
  );
  return items ?? [];
}

export function useSetting<T>(key: string, fallback: T): T {
  const value = useLiveQuery(
    () => settingsRepo.get<T>(key, fallback),
    [key, JSON.stringify(fallback)],
    fallback,
  );
  return (value ?? fallback) as T;
}
