import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { settingsRepo } from '@/db/repository';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';
import { NOTIFICATION_GATE_MIGRATION_KEY, runNotificationGateMigration } from './notificationGate';

const grant = () => ({ permission: () => 'granted' });
const refuse = (permission = 'denied') => ({ permission: () => permission });

async function storedApp(): Promise<Partial<AppSettings> | undefined> {
  return settingsRepo.get<Partial<AppSettings> | undefined>('app', undefined);
}

async function marker(): Promise<{ version?: number } | undefined> {
  return settingsRepo.get<{ version?: number } | undefined>(
    NOTIFICATION_GATE_MIGRATION_KEY,
    undefined,
  );
}

beforeEach(async () => {
  await db.settings.clear();
});

afterEach(async () => {
  await db.settings.clear();
});

afterAll(async () => {
  await db.delete();
});

describe('notification gate migration', () => {
  it('seeds the setting when permission was already granted and no key was stored', async () => {
    const result = await runNotificationGateMigration(grant());

    expect(result).toEqual({ seeded: true, outcome: 'seeded' });
    const stored = await storedApp();
    expect(stored?.notificationsEnabled).toBe(true);
    expect(stored).toMatchObject({ ...DEFAULT_SETTINGS, notificationsEnabled: true });
    expect((await marker())?.version).toBe(1);
  });

  it('seeds the key into an existing settings row without discarding the other values', async () => {
    await settingsRepo.set('app', { theme: 'dark', weekStartsOn: 0 } as Partial<AppSettings>);

    const result = await runNotificationGateMigration(grant());

    expect(result.seeded).toBe(true);
    const stored = await storedApp();
    expect(stored?.notificationsEnabled).toBe(true);
    expect(stored?.theme).toBe('dark');
    expect(stored?.weekStartsOn).toBe(0);
    expect(stored?.digestTime).toBe(DEFAULT_SETTINGS.digestTime);
  });

  it.each(['denied', 'default', 'unsupported'])(
    'leaves the opt-in default alone when permission is %s',
    async (permission) => {
      const result = await runNotificationGateMigration(refuse(permission));

      expect(result).toEqual({ seeded: false, outcome: 'permission-not-granted' });
      expect(await storedApp()).toBeUndefined();
      // Deliberately unmarked, so a grant made later is still picked up.
      expect(await marker()).toBeUndefined();
    },
  );

  it('never overrides an explicit opt-out, even with permission granted', async () => {
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, notificationsEnabled: false });

    const result = await runNotificationGateMigration(grant());

    expect(result).toEqual({ seeded: false, outcome: 'already-decided' });
    expect((await storedApp())?.notificationsEnabled).toBe(false);
  });

  it('leaves an existing grant alone instead of rewriting the row', async () => {
    await settingsRepo.set('app', {
      ...DEFAULT_SETTINGS,
      notificationsEnabled: true,
      theme: 'light',
    });

    const result = await runNotificationGateMigration(grant());

    expect(result).toEqual({ seeded: false, outcome: 'already-decided' });
    expect((await storedApp())?.notificationsEnabled).toBe(true);
    expect((await storedApp())?.theme).toBe('light');
  });

  it('is idempotent and never re-enables the gate after the user turns it off', async () => {
    await runNotificationGateMigration(grant());
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, notificationsEnabled: false });

    const second = await runNotificationGateMigration(grant());

    expect(second).toEqual({ seeded: false, outcome: 'already-migrated' });
    expect((await storedApp())?.notificationsEnabled).toBe(false);
  });

  it('picks up a grant made outside the app on a later launch', async () => {
    await runNotificationGateMigration(refuse('default'));
    expect(await storedApp()).toBeUndefined();

    const second = await runNotificationGateMigration(grant());

    expect(second).toEqual({ seeded: true, outcome: 'seeded' });
    expect((await storedApp())?.notificationsEnabled).toBe(true);
  });

  it('reads the ambient Notification.permission when no probe is injected', async () => {
    globalThis.Notification = { permission: 'granted' } as unknown as typeof Notification;
    try {
      expect(await runNotificationGateMigration()).toMatchObject({ seeded: true });
      expect((await storedApp())?.notificationsEnabled).toBe(true);

      await db.settings.clear();
      delete (globalThis as { Notification?: unknown }).Notification;
      expect(await runNotificationGateMigration()).toMatchObject({
        seeded: false,
        outcome: 'permission-not-granted',
      });
    } finally {
      delete (globalThis as { Notification?: unknown }).Notification;
    }
  });
});
