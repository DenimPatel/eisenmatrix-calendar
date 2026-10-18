import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie, { type Table } from 'dexie';
import { db, EisenMatrixDB, type ReminderLogEntry } from './schema';
import {
  backupRepo,
  itemRepo,
  listRepo,
  reminderFailureRepo,
  reminderLogRepo,
  settingsRepo,
} from './repository';
import { createItem, defaultDataFor, normalizeItem } from '@/domain/itemFactory';
import {
  ITEM_KINDS,
  type AppSettings,
  type Item,
  type ItemKind,
  type List,
  DEFAULT_SETTINGS,
} from '@/types';

function task(id: string, title: string, parentId: string | null = null): Item {
  const base = normalizeItem({ ...createItem({ kind: 'task', title }), id });
  return { ...base, parentId };
}

function rawWithoutData(kind: ItemKind): Item {
  const { data: _data, ...raw } = createItem({ kind, title: `Raw ${kind}` });
  return raw as Item;
}

beforeEach(async () => {
  await Promise.all([
    db.items.clear(),
    db.lists.clear(),
    db.settings.clear(),
    db.reminderLog.clear(),
    db.reminderFailures.clear(),
    db.backups.clear(),
  ]);
});

afterAll(async () => {
  await db.delete();
});

describe('itemRepo', () => {
  it('creates, reads, updates and removes items', async () => {
    await itemRepo.create(task('1', 'Alpha'));
    expect((await itemRepo.get('1'))?.title).toBe('Alpha');

    await itemRepo.update('1', { title: 'Alpha v2' });
    const updated = await itemRepo.get('1');
    expect(updated?.title).toBe('Alpha v2');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(updated!.createdAt);

    await itemRepo.remove('1');
    expect(await itemRepo.get('1')).toBeUndefined();
  });

  it('archives and restores in bulk', async () => {
    await itemRepo.createMany([task('a', 'A'), task('b', 'B')]);
    await itemRepo.setArchived(['a', 'b'], true);
    expect((await itemRepo.all()).every((i) => i.archivedAt)).toBe(true);
    await itemRepo.setArchived(['a', 'b'], false);
    expect((await itemRepo.all()).every((i) => i.archivedAt === null)).toBe(true);
  });

  it('backfills missing or null data on read without rewriting the stored rows', async () => {
    const raw = ITEM_KINDS.map(rawWithoutData);
    const nulled = ITEM_KINDS.map(
      (kind) => ({ ...rawWithoutData(kind), data: null }) as unknown as Item,
    );
    await db.items.bulkPut([...raw, ...nulled]);

    const expected = new Map(ITEM_KINDS.map((kind) => [kind, defaultDataFor(kind)]));
    const all = await itemRepo.all();
    for (const item of [...raw, ...nulled]) {
      expect(await itemRepo.get(item.id)).toMatchObject({ data: expected.get(item.kind) });
      expect(all.find((entry) => entry.id === item.id)?.data).toEqual(expected.get(item.kind));
    }

    const byKind = await itemRepo.byKind('habit');
    expect(byKind.map((item) => item.data)).toEqual([
      defaultDataFor('habit'),
      defaultDataFor('habit'),
    ]);

    for (const item of raw) {
      expect(await db.items.get(item.id)).not.toHaveProperty('data');
    }
    for (const item of nulled) {
      expect((await db.items.get(item.id))?.data).toBeNull();
    }
  });

  it('deep-fills nested kind payloads on read without rewriting the stored rows', async () => {
    const partialTarget = {
      ...rawWithoutData('habit'),
      id: 'partial-target',
      data: { target: { count: 2 } },
    } as Item;
    const nullTarget = {
      ...rawWithoutData('habit'),
      id: 'null-target',
      data: { target: null },
    } as unknown as Item;
    const nullMetric = {
      ...rawWithoutData('goal'),
      id: 'null-metric',
      data: { metric: null },
    } as unknown as Item;
    await db.items.bulkPut([partialTarget, nullTarget, nullMetric]);

    const all = await itemRepo.all();
    expect(all.find((item) => item.id === 'partial-target')?.data).toEqual({
      target: { count: 2, per: 'day' },
      streak: { current: 0, best: 0, lastAt: null },
    });
    expect((await itemRepo.get('null-target'))?.data).toEqual(defaultDataFor('habit'));
    expect((await itemRepo.get('null-metric'))?.data).toEqual(defaultDataFor('goal'));

    expect((await db.items.get('partial-target'))?.data).toEqual({ target: { count: 2 } });
    expect((await db.items.get('null-target'))?.data).toEqual({ target: null });
    expect((await db.items.get('null-metric'))?.data).toEqual({ metric: null });
  });

  it('removes children with their parent', async () => {
    await itemRepo.createMany([
      task('p', 'Parent'),
      task('c1', 'Child 1', 'p'),
      task('c2', 'Child 2', 'p'),
    ]);
    await itemRepo.removeWithChildren('p');
    expect(await itemRepo.all()).toHaveLength(0);
  });

  it('removes deep descendants and leaves unrelated items', async () => {
    await itemRepo.createMany([
      task('p', 'Parent'),
      task('c', 'Child', 'p'),
      task('g', 'Grandchild', 'c'),
      task('gg', 'Great-grandchild', 'g'),
      task('other', 'Unrelated', 'unrelated-parent'),
      task('other-child', 'Unrelated child', 'other'),
    ]);
    await itemRepo.removeWithChildren('p');
    const remaining = (await itemRepo.all()).map((i) => i.id).sort();
    expect(remaining).toEqual(['other', 'other-child']);
  });

  it('terminates on a self-parent item and does not treat it as its own descendant', async () => {
    await itemRepo.createMany([task('s', 'Self', 's'), task('keep', 'Keep')]);
    await itemRepo.removeWithChildren('s');
    const remaining = (await itemRepo.all()).map((i) => i.id).sort();
    expect(remaining).toEqual(['keep']);
  });

  it('terminates on a two-node parent cycle and removes both nodes', async () => {
    await itemRepo.createMany([task('a', 'A', 'b'), task('b', 'B', 'a'), task('keep', 'Keep')]);
    await itemRepo.removeWithChildren('a');
    const remaining = (await itemRepo.all()).map((i) => i.id).sort();
    expect(remaining).toEqual(['keep']);
  });
});

describe('listRepo and settingsRepo', () => {
  it('orders lists and persists settings', async () => {
    const list: List = {
      id: 'l1',
      name: 'Work',
      kind: 'project',
      color: 'accent',
      icon: 'list',
      order: 0,
      archivedAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    await listRepo.create(list);
    expect(await listRepo.all()).toHaveLength(1);

    await settingsRepo.set('app', { theme: 'dark' });
    expect(await settingsRepo.get('app', {})).toEqual({ theme: 'dark' });
  });
});

describe('settingsRepo', () => {
  it('merges interleaved writes to different keys without clobbering either', async () => {
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, weekStartsOn: 0 });

    await Promise.all([
      settingsRepo.merge<AppSettings>('app', { theme: 'dark' }, DEFAULT_SETTINGS),
      settingsRepo.merge<AppSettings>('app', { digestEnabled: true }, DEFAULT_SETTINGS),
    ]);

    expect(await settingsRepo.get('app', DEFAULT_SETTINGS)).toEqual({
      ...DEFAULT_SETTINGS,
      weekStartsOn: 0,
      theme: 'dark',
      digestEnabled: true,
    });
  });

  it('merges a patch into an existing snapshot without dropping untouched keys', async () => {
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, digestTime: '09:30' });

    await settingsRepo.merge<AppSettings>('app', { theme: 'light' }, DEFAULT_SETTINGS);

    expect(await settingsRepo.get('app', DEFAULT_SETTINGS)).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      digestTime: '09:30',
    });
  });

  it('seeds a missing row from the fallback so readers still see full settings', async () => {
    await settingsRepo.merge<AppSettings>('app', { theme: 'dark' }, DEFAULT_SETTINGS);

    expect(await settingsRepo.get('app', DEFAULT_SETTINGS)).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
    });
  });
});

describe('reminderLogRepo', () => {
  it('dedupes fired reminders by item and occurrence', async () => {
    expect(await reminderLogRepo.wasFired('item-1', '2024-01-01')).toBe(false);
    await reminderLogRepo.record('item-1', '2024-01-01');
    expect(await reminderLogRepo.wasFired('item-1', '2024-01-01')).toBe(true);
    expect(await reminderLogRepo.wasFired('item-1', '2024-01-02')).toBe(false);
  });

  it('records exactly one of two concurrent inserts for the same key', async () => {
    const [first, second] = await Promise.all([
      reminderLogRepo.record('item-1', '2024-01-01'),
      reminderLogRepo.record('item-1', '2024-01-01'),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(
      await db.reminderLog.where('[itemId+occKey]').equals(['item-1', '2024-01-01']).count(),
    ).toBe(1);
  });

  it('prunes old log entries', async () => {
    await reminderLogRepo.record('a', 'k', 1000);
    await reminderLogRepo.record('b', 'k', Date.now());
    const deleted = await reminderLogRepo.pruneBefore(5000);
    expect(deleted).toBe(1);
  });
});

describe('reminderFailureRepo', () => {
  it('upserts one failure row per key instead of appending on retry', async () => {
    await reminderFailureRepo.record({
      itemId: 'item-1',
      dedupeKey: '2024-01-01::r1',
      occKey: '2024-01-01',
      title: 'Standup',
      attemptedAt: 1000,
    });
    await reminderFailureRepo.record({
      itemId: 'item-1',
      dedupeKey: '2024-01-01::r1',
      occKey: '2024-01-01',
      title: 'Standup',
      attemptedAt: 2000,
    });

    const rows = await reminderFailureRepo.all();
    expect(rows).toHaveLength(1);
    expect(rows[0].attemptedAt).toBe(2000);
    expect(await reminderFailureRepo.count()).toBe(1);
  });

  it('keeps failures separate from the fired log and clears one on delivery', async () => {
    await reminderFailureRepo.record({
      itemId: 'item-1',
      dedupeKey: '2024-01-01::r1',
      occKey: '2024-01-01',
      title: 'Standup',
    });
    await reminderLogRepo.record('item-1', '2024-01-01::r1');

    expect(await reminderLogRepo.wasFired('item-1', '2024-01-01::r1')).toBe(true);
    expect(await reminderFailureRepo.clear('item-1', '2024-01-01::r1')).toBe(1);
    expect(await reminderFailureRepo.count()).toBe(0);
    expect(await reminderLogRepo.wasFired('item-1', '2024-01-01::r1')).toBe(true);
  });

  it('prunes failures older than a cutoff', async () => {
    await reminderFailureRepo.record({
      itemId: 'a',
      dedupeKey: 'k',
      occKey: 'k',
      title: 'A',
      attemptedAt: 1000,
    });
    await reminderFailureRepo.record({
      itemId: 'b',
      dedupeKey: 'k',
      occKey: 'k',
      title: 'B',
      attemptedAt: Date.now(),
    });

    expect(await reminderFailureRepo.pruneBefore(5000)).toBe(1);
    expect(await reminderFailureRepo.count()).toBe(1);
  });
});

/** The pre-IMP-036 schema, kept so the upgrade path can be exercised. */
class LegacyReminderLogDB extends Dexie {
  reminderLog!: Table<ReminderLogEntry, number>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ reminderLog: '++id, [itemId+occKey], firedAt' });
  }
}

describe('reminderLog unique index migration', () => {
  let seq = 0;
  const opened: EisenMatrixDB[] = [];

  afterEach(async () => {
    while (opened.length) await opened.pop()!.delete();
  });

  it('dedupes existing rows before enforcing the unique compound index', async () => {
    seq += 1;
    const name = `test-reminderlog-${seq}`;
    const legacy = new LegacyReminderLogDB(name);
    await legacy.reminderLog.bulkAdd([
      { itemId: 'a', occKey: 'k', firedAt: 1 },
      { itemId: 'a', occKey: 'k', firedAt: 2 },
      { itemId: 'b', occKey: 'k', firedAt: 3 },
    ]);
    legacy.close();

    const upgraded = new EisenMatrixDB(name);
    opened.push(upgraded);
    await upgraded.open();

    expect(await upgraded.reminderLog.count()).toBe(2);
    await expect(
      upgraded.reminderLog.add({ itemId: 'a', occKey: 'k', firedAt: 4 }),
    ).rejects.toBeInstanceOf(Dexie.ConstraintError);
  });
});

describe('itemRepo.replaceAll', () => {
  it('clears existing rows and bulk-puts the replacement set in one transaction', async () => {
    await itemRepo.createMany([task('a', 'A'), task('b', 'B')]);

    await itemRepo.replaceAll([task('c', 'C'), task('d', 'D')]);

    expect((await itemRepo.all()).map((i) => i.id).sort()).toEqual(['c', 'd']);
    expect(await itemRepo.count()).toBe(2);
  });
});

describe('backupRepo', () => {
  it('adds backups and lists them newest first', async () => {
    await backupRepo.add('legacy-import', '{"a":1}', 1_000);
    await backupRepo.add('manual', '{"b":2}', 2_000);

    const all = await backupRepo.all();
    expect(all.map((b) => b.reason)).toEqual(['manual', 'legacy-import']);
    expect((await backupRepo.latest())?.reason).toBe('manual');
  });

  it('removes one backup by id', async () => {
    const id = await backupRepo.add('only', '{}', 1_000);

    await backupRepo.remove(id);

    expect(await backupRepo.all()).toEqual([]);
    expect(await backupRepo.latest()).toBeUndefined();
  });

  it('prunes all but the newest keep rows', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await backupRepo.add(`r${i}`, '{}', i * 1_000);
    }

    await backupRepo.prune(2);

    const remaining = await backupRepo.all();
    expect(remaining.map((b) => b.reason)).toEqual(['r5', 'r4']);
    expect(remaining).toHaveLength(2);
  });

  it('keeps every row when fewer than keep exist', async () => {
    await backupRepo.add('a', '{}', 1_000);
    await backupRepo.add('b', '{}', 2_000);

    await backupRepo.prune(5);

    expect(await backupRepo.all()).toHaveLength(2);
  });
});
