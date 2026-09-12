import type { BaseItem, Item, ItemData, ItemKind, List } from '@/types';
import { getDb, type BackupEntry } from './schema';

export type ItemPatch = Partial<Omit<BaseItem, 'id' | 'kind'>> & { data?: ItemData };

function mergeItem(existing: Item, patch: ItemPatch): Item {
  const next = {
    ...existing,
    ...patch,
    data: patch.data ?? existing.data,
    updatedAt: patch.updatedAt ?? Date.now(),
  } as Item;
  return next;
}

export const itemRepo = {
  async all(): Promise<Item[]> {
    return getDb().items.toArray();
  },

  async get(id: string): Promise<Item | undefined> {
    return getDb().items.get(id);
  },

  async create(item: Item): Promise<Item> {
    await getDb().items.put(item);
    return item;
  },

  async createMany(items: Item[]): Promise<void> {
    await getDb().items.bulkPut(items);
  },

  async update(id: string, patch: ItemPatch): Promise<Item | undefined> {
    const existing = await getDb().items.get(id);
    if (!existing) return undefined;
    const next = mergeItem(existing, patch);
    await getDb().items.put(next);
    return next;
  },

  async updateMany(entries: Array<{ id: string; patch: ItemPatch }>): Promise<void> {
    await getDb().transaction('rw', getDb().items, async () => {
      for (const { id, patch } of entries) {
        await this.update(id, patch);
      }
    });
  },

  async remove(id: string): Promise<void> {
    await getDb().items.delete(id);
  },

  async removeMany(ids: string[]): Promise<void> {
    await getDb().items.bulkDelete(ids);
  },

  async removeWithChildren(id: string): Promise<void> {
    const db = getDb();
    await db.transaction('rw', db.items, async () => {
      const descendants = await db.items.filter((i) => i.parentId === id).toArray();
      await db.items.bulkDelete([id, ...descendants.map((d) => d.id)]);
    });
  },

  async byKind(kind: ItemKind): Promise<Item[]> {
    return getDb().items.where('kind').equals(kind).toArray();
  },

  async byList(listId: string): Promise<Item[]> {
    return getDb().items.where('listId').equals(listId).toArray();
  },

  async children(parentId: string): Promise<Item[]> {
    return getDb().items.where('parentId').equals(parentId).toArray();
  },

  async query(predicate: (item: Item) => boolean): Promise<Item[]> {
    return getDb().items.filter(predicate).toArray();
  },

  /** Bulk soft-delete (archive) or restore. */
  async setArchived(ids: string[], archived: boolean): Promise<void> {
    const ts = Date.now();
    await getDb()
      .items.where('id')
      .anyOf(ids)
      .modify({ archivedAt: archived ? ts : null, updatedAt: ts });
  },

  async replaceAll(items: Item[]): Promise<void> {
    const db = getDb();
    await db.transaction('rw', db.items, async () => {
      await db.items.clear();
      await db.items.bulkPut(items);
    });
  },

  async count(): Promise<number> {
    return getDb().items.count();
  },
};

export const listRepo = {
  async all(): Promise<List[]> {
    return getDb().lists.orderBy('order').toArray();
  },
  async create(list: List): Promise<List> {
    await getDb().lists.put(list);
    return list;
  },
  async createMany(lists: List[]): Promise<void> {
    await getDb().lists.bulkPut(lists);
  },
  async update(id: string, patch: Partial<List>): Promise<void> {
    await getDb().lists.update(id, { ...patch, updatedAt: Date.now() });
  },
  async remove(id: string): Promise<void> {
    await getDb().lists.delete(id);
  },
  async replaceAll(lists: List[]): Promise<void> {
    const db = getDb();
    await db.transaction('rw', db.lists, async () => {
      await db.lists.clear();
      await db.lists.bulkPut(lists);
    });
  },
};

export const settingsRepo = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await getDb().settings.get(key);
    return row === undefined ? fallback : (row.value as T);
  },
  async set(key: string, value: unknown): Promise<void> {
    await getDb().settings.put({ key, value });
  },
  async remove(key: string): Promise<void> {
    await getDb().settings.delete(key);
  },
  async all(): Promise<Record<string, unknown>> {
    const rows = await getDb().settings.toArray();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
};

export const reminderLogRepo = {
  async wasFired(itemId: string, occKey: string): Promise<boolean> {
    const count = await getDb()
      .reminderLog.where('[itemId+occKey]')
      .equals([itemId, occKey])
      .count();
    return count > 0;
  },
  async record(itemId: string, occKey: string, firedAt = Date.now()): Promise<void> {
    await getDb().reminderLog.add({ itemId, occKey, firedAt });
  },
  async clear(): Promise<void> {
    await getDb().reminderLog.clear();
  },
  async pruneBefore(timestamp: number): Promise<number> {
    return getDb().reminderLog.where('firedAt').below(timestamp).delete();
  },
};

export const backupRepo = {
  async add(reason: string, payload: string, createdAt = Date.now()): Promise<number> {
    return getDb().backups.add({ reason, payload, createdAt });
  },
  async all(): Promise<BackupEntry[]> {
    return getDb().backups.orderBy('createdAt').reverse().toArray();
  },
  async latest(): Promise<BackupEntry | undefined> {
    const all = await getDb().backups.orderBy('createdAt').reverse().toArray();
    return all[0];
  },
  async remove(id: number): Promise<void> {
    await getDb().backups.delete(id);
  },
  async prune(keep: number): Promise<void> {
    const all = await getDb().backups.orderBy('createdAt').reverse().toArray();
    const stale = all.slice(keep);
    await getDb().backups.bulkDelete(stale.map((b) => b.id!).filter(Boolean));
  },
};
