import Dexie, { type Table } from 'dexie';
import type { Item, List } from '@/types';

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface ReminderLogEntry {
  id?: number;
  itemId: string;
  occKey: string;
  firedAt: number;
}

/**
 * A failed delivery attempt, kept apart from the `reminderLog` "fired" key so an undelivered
 * reminder stays discoverable after its `fireAt` has aged out of the delivery lookback. One row
 * per `[itemId+dedupeKey]`: a retry updates `attemptedAt` instead of appending.
 */
export interface ReminderFailureEntry {
  id?: number;
  itemId: string;
  dedupeKey: string;
  occKey: string;
  title: string;
  attemptedAt: number;
}

export interface BackupEntry {
  id?: number;
  createdAt: number;
  reason: string;
  payload: string;
}

export class EisenMatrixDB extends Dexie {
  items!: Table<Item, string>;
  lists!: Table<List, string>;
  settings!: Table<SettingRow, string>;
  reminderLog!: Table<ReminderLogEntry, number>;
  reminderFailures!: Table<ReminderFailureEntry, number>;
  backups!: Table<BackupEntry, number>;

  constructor(name = 'eisenmatrix') {
    super(name);
    this.version(1).stores({
      items: 'id, kind, status, listId, parentId, start, dueAt, archivedAt, *tags, [kind+status]',
      lists: 'id, kind, order',
      settings: 'key',
      reminderLog: '++id, [itemId+occKey], firedAt',
      backups: '++id, createdAt',
    });

    // A unique index cannot be built over an existing table that already holds duplicate
    // keys, and Dexie applies index changes before the version's `upgrade`, so the dedupe
    // has to land in its own version before v3 makes `[itemId+occKey]` unique.
    this.version(2)
      .stores({ reminderLog: '++id, [itemId+occKey], firedAt' })
      .upgrade(async (tx) => {
        const rows = await tx.table<ReminderLogEntry, number>('reminderLog').toArray();
        const seen = new Set<string>();
        const duplicates: number[] = [];
        for (const row of rows) {
          const key = `${row.itemId}\u0000${row.occKey}`;
          if (seen.has(key)) duplicates.push(row.id!);
          else seen.add(key);
        }
        if (duplicates.length > 0) await tx.table('reminderLog').bulkDelete(duplicates);
      });

    this.version(3).stores({
      reminderLog: '++id, &[itemId+occKey], firedAt',
    });

    this.version(4).stores({
      reminderFailures: '++id, &[itemId+dedupeKey], attemptedAt',
    });
  }
}

let instance: EisenMatrixDB | null = null;

/** Shared database handle (lazily created so tests can reset it). */
export function getDb(): EisenMatrixDB {
  if (!instance) instance = new EisenMatrixDB();
  return instance;
}

export function resetDbInstance(): void {
  instance = null;
}

export const db = getDb();

export const DB_NAME = 'eisenmatrix';
