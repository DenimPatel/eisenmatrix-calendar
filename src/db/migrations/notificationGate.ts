import { settingsRepo } from '@/db/repository';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';

export const NOTIFICATION_GATE_MIGRATION_KEY = 'migration.notificationGate';
export const NOTIFICATION_GATE_MIGRATION_VERSION = 1;

export type NotificationGateOutcome =
  'seeded' | 'already-decided' | 'permission-not-granted' | 'already-migrated';

export interface NotificationGateResult {
  seeded: boolean;
  outcome: NotificationGateOutcome;
}

type SettingsStore = Pick<typeof settingsRepo, 'get' | 'set'>;

interface MigrationDeps {
  settings: SettingsStore;
  /** Current OS/browser permission, or `'unsupported'` when the API is missing. */
  permission: () => string;
}

function ambientPermission(): string {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

async function markMigrated(settings: SettingsStore): Promise<void> {
  await settings.set(NOTIFICATION_GATE_MIGRATION_KEY, {
    version: NOTIFICATION_GATE_MIGRATION_VERSION,
    completedAt: Date.now(),
  });
}

/**
 * `notificationsEnabled` used to be write-only: delivery followed raw browser
 * permission alone. Now that the runtime gates on the setting, every existing user
 * who had already granted that permission — from the pre-existing Enable button,
 * from a browser-level grant, or from a grant predating that button — would
 * silently drop to in-app banners only. Seed the setting once for exactly those
 * installations: key absent *and* permission already `granted`.
 *
 * Nobody else is touched. A missing key with no permission keeps the opt-in
 * default, and an explicitly stored `false` (a deliberate opt-out, or the legacy
 * Enable button persisting a refusal) is never overwritten.
 *
 * Idempotent twice over: the marker short-circuits later runs, and the key-presence
 * check alone would also block a re-seed. A run that finds no permission is
 * deliberately *not* marked, so a grant made later outside the app is still picked
 * up on a subsequent launch.
 */
export async function runNotificationGateMigration(
  deps?: Partial<MigrationDeps>,
): Promise<NotificationGateResult> {
  const settings = deps?.settings ?? settingsRepo;
  const permission = deps?.permission ?? ambientPermission;

  const marker = await settings.get<{ version?: number } | undefined>(
    NOTIFICATION_GATE_MIGRATION_KEY,
    undefined,
  );
  if (marker?.version === NOTIFICATION_GATE_MIGRATION_VERSION) {
    return { seeded: false, outcome: 'already-migrated' };
  }

  const stored = await settings.get<Partial<AppSettings> | undefined>('app', undefined);
  const current = stored && typeof stored === 'object' ? stored : null;
  if (current && 'notificationsEnabled' in current) {
    await markMigrated(settings);
    return { seeded: false, outcome: 'already-decided' };
  }

  if (permission() !== 'granted') {
    return { seeded: false, outcome: 'permission-not-granted' };
  }

  await settings.set('app', { ...DEFAULT_SETTINGS, ...current, notificationsEnabled: true });
  await markMigrated(settings);
  return { seeded: true, outcome: 'seeded' };
}
