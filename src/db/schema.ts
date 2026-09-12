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
