import type { EisenMatrixDB } from '@/db/schema';
import { getDb } from '@/db/schema';
import { firstOccurrenceInRange } from '@/domain/recurrence';
import {
  endOfDay,
  endOfMonthDate,
  endOfYearDate,
  firstDayOfISOWeek,
  formatISODate,
  parseLocalDate,
} from '@/lib/date';
import type {
  Frequency,
  HistoryEntry,
  Item,
  ItemStatus,
  OccurrenceStatus,
  Priority,
  RecurrenceRule,
} from '@/types';

export const LEGACY_STORAGE_KEY = 'eisenmatrix-tasks';
export const LEGACY_BACKUP_KEY = 'eisenmatrix-tasks.v1.bak';
export const LEGACY_MIGRATION_KEY = 'migration.legacy';
export const LEGACY_MIGRATION_VERSION = 1;

/** The exact shape persisted by v1 of the app. */
export interface LegacyTask {
  id: string;
  title: string;
  description: string;
  urgency: 'High' | 'Low';
  importance: 'High' | 'Low';
  status: 'To Do' | 'In Progress' | 'Done';
  date: string;
  time?: string;
  frequency: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  history: HistoryEntry[];
  completionHistory?: Record<string, string>;
  recurrenceEndedAt?: number;
}

export interface MigrationResult {
  migrated: boolean;
  count: number;
  backupCreated: boolean;
}

interface MigrationDeps {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  db: EisenMatrixDB;
}

const STATUS_MAP: Record<string, ItemStatus> = {
  'To Do': 'todo',
  'In Progress': 'doing',
  Done: 'done',
};

const PRIORITY_MAP: Record<string, Priority> = { High: 'high', Low: 'low' };

const FREQUENCY_MAP: Record<string, Frequency | null> = {
  None: null,
  Daily: 'daily',
  Weekly: 'weekly',
  Monthly: 'monthly',
  Yearly: 'yearly',
};

function buildRule(task: LegacyTask): RecurrenceRule | null {
  const freq = FREQUENCY_MAP[task.frequency] ?? null;
  if (!freq) return null;
  const start = parseLocalDate(task.date) ?? new Date();
  const rule: RecurrenceRule = {
    freq,
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
  };
  if (freq === 'weekly') rule.byWeekday = [start.getDay()];
  if (freq === 'monthly') rule.byMonthDay = [start.getDate()];
  if (freq === 'yearly') rule.byMonth = [start.getMonth() + 1];
  if (task.recurrenceEndedAt) rule.until = formatISODate(new Date(task.recurrenceEndedAt));
  return rule;
}

function periodRange(
  key: string,
  freq: Frequency,
  weekStartsOn: 0 | 1,
): { from: Date; to: Date } | null {
  if (freq === 'daily') {
    const d = parseLocalDate(key);
    return d ? { from: d, to: endOfDay(d) } : null;
  }
  if (freq === 'weekly') {
    const match = /^(\d{4})-W(\d{1,2})$/.exec(key);
    if (!match) return null;
    const year = Number(match[1]);
    const week = Number(match[2]);
    const from = firstDayOfISOWeek(year, week, weekStartsOn);
    const to = endOfDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6));
    return { from, to };
  }
  if (freq === 'monthly') {
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const from = new Date(year, month, 1);
    return { from, to: endOfMonthDate(from) };
  }
  if (freq === 'yearly') {
    const match = /^(\d{4})$/.exec(key);
    if (!match) return null;
    const year = Number(match[1]);
    const from = new Date(year, 0, 1);
    return { from, to: endOfYearDate(from) };
  }
  return null;
}

/** Map the period keys of the v1 `completionHistory` onto real occurrence keys. */
function resolveCompletionHistory(item: Item): Record<string, OccurrenceStatus> {
  const raw = item.legacy?.completionHistory;
  const rule = item.recurrence;
  const resolved: Record<string, OccurrenceStatus> = {};
  if (!raw) return resolved;

  for (const [key, legacyStatus] of Object.entries(raw)) {
    const status = STATUS_MAP[legacyStatus] ?? 'todo';
    let occKey: string | null = null;
    if (rule) {
      const range = periodRange(key, rule.freq, rule.weekStartsOn);
      if (range) {
        const occ = firstOccurrenceInRange(item, range.from, range.to);
        if (occ) occKey = occ.occKey;
        else occKey = formatISODate(range.from);
      }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      occKey = key;
    }
    if (occKey) resolved[occKey] = status;
  }
  return resolved;
}

export function mapLegacyTask(task: LegacyTask, order: number): Item {
  const hasTime = !!task.time;
  const start = hasTime ? `${task.date}T${task.time}` : task.date;
  const rule = buildRule(task);
  const legacyHistory = task.completionHistory ?? {};
  const base: Item = {
    id: task.id,
    kind: 'task',
    title: task.title || 'Untitled Task',
    notes: task.description || '',
    status: STATUS_MAP[task.status] ?? 'todo',
    urgency: PRIORITY_MAP[task.urgency] ?? 'low',
    importance: PRIORITY_MAP[task.importance] ?? 'low',
    start,
    end: null,
    allDay: !hasTime,
    dueAt: start,
    recurrence: rule,
    tags: [],
    listId: null,
    parentId: null,
    order,
    reminders: [],
    checklist: [],
    createdAt: task.createdAt || Date.now(),
    updatedAt: task.updatedAt || Date.now(),
    completedAt: task.completedAt ?? null,
    archivedAt: null,
    history: Array.isArray(task.history) ? task.history : [],
    occurrences: {},
    legacy: { completionHistory: legacyHistory },
    data: {},
  };

  const statuses = resolveCompletionHistory(base);
  const occurrences: Item['occurrences'] = {};
  for (const [occKey, status] of Object.entries(statuses)) {
    occurrences[occKey] = { status, completedAt: null };
  }
  return { ...base, occurrences };
}

export function parseLegacyTasks(raw: string): LegacyTask[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as LegacyTask[];
  } catch {
    // fall through
  }
  return [];
}

/**
 * Import v1 `localStorage` data into IndexedDB. Idempotent and safe to re-run:
 * the raw payload is always backed up before any change.
 */
export async function runLegacyMigration(deps?: Partial<MigrationDeps>): Promise<MigrationResult> {
  const storage = deps?.storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  const db = deps?.db ?? getDb();

  if (!storage) return { migrated: false, count: 0, backupCreated: false };

  const marker = await db.settings.get(LEGACY_MIGRATION_KEY);
  if (marker && (marker.value as { version?: number })?.version === LEGACY_MIGRATION_VERSION) {
    return { migrated: false, count: 0, backupCreated: false };
  }

  const raw = storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    await db.settings.put({
      key: LEGACY_MIGRATION_KEY,
      value: { version: LEGACY_MIGRATION_VERSION, completedAt: Date.now(), count: 0 },
    });
    return { migrated: false, count: 0, backupCreated: false };
  }

  await db.backups.add({
    reason: 'legacy-v1-migration',
    payload: raw,
    createdAt: Date.now(),
  });
  storage.setItem(LEGACY_BACKUP_KEY, raw);
  await db.backups
    .orderBy('createdAt')
    .reverse()
    .toArray()
    .then((all) => {
      const stale = all.slice(10);
      if (stale.length) db.backups.bulkDelete(stale.map((b) => b.id!).filter(Boolean));
    });

  const tasks = parseLegacyTasks(raw);
  const items = tasks.map((task, index) => mapLegacyTask(task, index));
  if (items.length) await db.items.bulkPut(items);

  await db.settings.put({
    key: LEGACY_MIGRATION_KEY,
    value: {
      version: LEGACY_MIGRATION_VERSION,
      completedAt: Date.now(),
      count: items.length,
    },
  });

  return { migrated: true, count: items.length, backupCreated: true };
}

export async function resetLegacyMigrationMarker(db: EisenMatrixDB = getDb()): Promise<void> {
  await db.settings.delete(LEGACY_MIGRATION_KEY);
}
