import { afterEach, describe, expect, it } from 'vitest';
import { EisenMatrixDB } from '@/db/schema';
import {
  LEGACY_BACKUP_KEY,
  LEGACY_MIGRATION_KEY,
  LEGACY_STORAGE_KEY,
  mapLegacyTask,
  runLegacyMigration,
  type LegacyTask,
} from './legacyTasks';

const FIXTURE: LegacyTask[] = [
  {
    id: 'plain-1',
    title: 'Buy stamps',
    description: 'Blue ones',
    urgency: 'Low',
    importance: 'High',
    status: 'To Do',
    date: '2024-02-14',
    frequency: 'None',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    history: [],
  },
  {
    id: 'daily-1',
    title: 'Take vitamins',
    description: '',
    urgency: 'High',
    importance: 'High',
    status: 'In Progress',
    date: '2024-01-01',
    time: '09:00',
    frequency: 'Daily',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    history: [],
    completionHistory: { '2024-01-01': 'Done', '2024-01-02': 'To Do' },
  },
  {
    id: 'weekly-1',
    title: 'Team sync',
    description: '',
    urgency: 'Low',
    importance: 'High',
    status: 'To Do',
    date: '2024-01-03', // Wednesday
    frequency: 'Weekly',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    history: [],
    completionHistory: { '2024-W01': 'Done', '2024-W02': 'Done' },
    recurrenceEndedAt: 1706000000000,
  },
  {
    id: 'monthly-1',
    title: 'Pay rent',
    description: '',
    urgency: 'High',
    importance: 'High',
    status: 'To Do',
    date: '2024-01-05',
    frequency: 'Monthly',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    history: [],
    completionHistory: { '2024-03': 'In Progress' },
  },
  {
    id: 'yearly-1',
    title: 'Renew passport',
    description: '',
    urgency: 'Low',
    importance: 'High',
    status: 'Done',
    date: '2023-06-01',
    frequency: 'Yearly',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    history: [],
    completionHistory: { '2023': 'Done' },
  },
];

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    has: (key: string) => map.has(key),
    raw: map,
  };
}

let dbName = 0;
function freshDb() {
  dbName += 1;
  return new EisenMatrixDB(`test-migration-${dbName}`);
}

const dbs: EisenMatrixDB[] = [];
afterEach(async () => {
  while (dbs.length) {
    const db = dbs.pop()!;
    await db.delete();
  }
});

describe('legacy migration', () => {
  it('maps every v1 field without loss', () => {
    const item = mapLegacyTask(FIXTURE[2], 2);
    expect(item.kind).toBe('task');
    expect(item.urgency).toBe('low');
    expect(item.importance).toBe('high');
    expect(item.start).toBe('2024-01-03');
    expect(item.allDay).toBe(true);
    expect(item.recurrence?.freq).toBe('weekly');
    expect(item.recurrence?.byWeekday).toEqual([3]);
    expect(item.recurrence?.until).toBeDefined();
    expect(item.legacy?.completionHistory).toEqual({ '2024-W01': 'Done', '2024-W02': 'Done' });
    expect(Object.keys(item.occurrences)).toHaveLength(2);
  });

  it('imports tasks, resolves all four completionHistory key formats and backs up raw data', async () => {
    const db = freshDb();
    dbs.push(db);
    const storage = makeStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify(FIXTURE) });

    const result = await runLegacyMigration({ db, storage });
    expect(result.migrated).toBe(true);
    expect(result.count).toBe(FIXTURE.length);
    expect(result.backupCreated).toBe(true);

    const items = await db.items.toArray();
    expect(items).toHaveLength(FIXTURE.length);

    const daily = items.find((i) => i.id === 'daily-1')!;
    expect(daily.start).toBe('2024-01-01T09:00');
    expect(daily.allDay).toBe(false);
    expect(daily.occurrences['2024-01-01']?.status).toBe('done');
    expect(daily.occurrences['2024-01-02']?.status).toBe('todo');

    const weekly = items.find((i) => i.id === 'weekly-1')!;
    expect(Object.keys(weekly.occurrences).length).toBe(2);
    expect(Object.values(weekly.occurrences).every((o) => o.status === 'done')).toBe(true);

    const monthly = items.find((i) => i.id === 'monthly-1')!;
    expect(monthly.occurrences['2024-03-05']?.status).toBe('doing');

    const yearly = items.find((i) => i.id === 'yearly-1')!;
    expect(Object.values(yearly.occurrences)[0]?.status).toBe('done');

    // raw payload preserved in both places
    expect(storage.has(LEGACY_BACKUP_KEY)).toBe(true);
    const backups = await db.backups.toArray();
    expect(backups).toHaveLength(1);
    expect(JSON.parse(backups[0].payload)).toHaveLength(FIXTURE.length);

    // marker written
    const marker = await db.settings.get(LEGACY_MIGRATION_KEY);
    expect((marker?.value as { version: number }).version).toBe(1);
  });

  it('is idempotent and does not duplicate on re-run', async () => {
    const db = freshDb();
    dbs.push(db);
    const storage = makeStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify(FIXTURE) });

    await runLegacyMigration({ db, storage });
    const second = await runLegacyMigration({ db, storage });
    expect(second.migrated).toBe(false);
    expect(await db.items.count()).toBe(FIXTURE.length);
    expect(await db.backups.count()).toBe(1);
  });

  it('marks migration complete when there is nothing to migrate', async () => {
    const db = freshDb();
    dbs.push(db);
    const storage = makeStorage();
    const result = await runLegacyMigration({ db, storage });
    expect(result.migrated).toBe(false);
    expect(await db.items.count()).toBe(0);
  });
});
