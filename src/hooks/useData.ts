import { useLiveQuery } from 'dexie-react-hooks';
import { itemRepo, listRepo, settingsRepo } from '@/db/repository';
import type { Item, List } from '@/types';

export function useItems(includeArchived = false): Item[] {
  const items = useLiveQuery(() => itemRepo.all(), [], [] as Item[]);
  const list = items ?? [];
  return includeArchived ? list : list.filter((item) => !item.archivedAt);
}

export function useArchivedItems(): Item[] {
  const items = useLiveQuery(() => itemRepo.all(), [], [] as Item[]);
  return (items ?? []).filter((item) => item.archivedAt);
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
