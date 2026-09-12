import { useEffect, useState } from 'react';
import {
  Bell,
  Download,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Upload,
  CalendarClock,
} from 'lucide-react';
import { useItems, useLists, useSetting } from '@/hooks/useData';
import { useUiStore } from '@/store/useUiStore';
import { backupRepo, itemRepo, listRepo, reminderLogRepo, settingsRepo } from '@/db/repository';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Select, Toggle } from '@/components/ui/Form';
import {
  BACKUP_VERSION,
  buildBackup,
  backupToJSON,
  downloadFile,
  mergeImportedItems,
  parseBackup,
  pickFile,
  readTextFile,
  timestampedName,
  type ImportStrategy,
} from '@/lib/backup';
import { csvToItems, itemsToCSV } from '@/lib/csv';
import { itemsToICS } from '@/lib/ics';
import { normalizeItem } from '@/domain/itemFactory';
import {
  LEGACY_MIGRATION_KEY,
  LEGACY_MIGRATION_VERSION,
  runLegacyMigration,
} from '@/db/migrations/legacyTasks';
import { DEFAULT_SETTINGS, type AppSettings, type ThemePreference } from '@/types';
import { cn } from '@/lib/cn';

export function SettingsView() {
  const items = useItems(true);
  const lists = useLists();
  const settings = useSetting<AppSettings>('app', DEFAULT_SETTINGS);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const pushToast = useUiStore((s) => s.pushToast);
  const [strategy, setStrategy] = useState<ImportStrategy>('skip');
  const [backupCount, setBackupCount] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [permission, setPermission] = useState<string>('default');

  useEffect(() => {
    void backupRepo.all().then((rows) => setBackupCount(rows.length));
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, [items.length]);

  const persist = async (patch: Partial<AppSettings>) => {
    await settingsRepo.set('app', { ...settings, ...patch });
  };

  const exportJSON = () => {
    const payload = buildBackup(items, lists);
    downloadFile(
      timestampedName('eisenmatrix-backup', 'json'),
      backupToJSON(payload),
      'application/json',
    );
    pushToast({ message: 'JSON backup downloaded', tone: 'success' });
  };

  const exportCSV = () => {
    downloadFile(timestampedName('eisenmatrix-items', 'csv'), itemsToCSV(items), 'text/csv');
  };

  const exportICS = () => {
    downloadFile(
      timestampedName('eisenmatrix-calendar', 'ics'),
      itemsToICS(items),
      'text/calendar',
    );
  };

  const createSnapshot = async () => {
    await backupRepo.add('manual', JSON.stringify(buildBackup(items, lists)));
    const rows = await backupRepo.all();
    setBackupCount(rows.length);
    pushToast({ message: 'Snapshot saved on this device', tone: 'success' });
  };

  const importJSON = async () => {
    const file = await pickFile('application/json,.json');
    if (!file) return;
    try {
      const parsed = parseBackup(await readTextFile(file));
      const incoming = parsed.items.map(normalizeItem);
      const { toPut, skipped, overwritten, duplicated } = mergeImportedItems(
        items,
        incoming,
        strategy,
      );
      await itemRepo.createMany(toPut);
      if (parsed.lists.length) await listRepo.createMany(parsed.lists);
      setImportReport(
        `Imported ${toPut.length} items · skipped ${skipped} · overwritten ${overwritten} · duplicated ${duplicated}`,
      );
      pushToast({ message: 'Backup imported', tone: 'success' });
    } catch (error) {
      pushToast({ message: `Import failed: ${(error as Error).message}`, tone: 'error' });
    }
  };

  const importCSV = async () => {
    const file = await pickFile('.csv,text/csv');
    if (!file) return;
    const parsed = csvToItems(await readTextFile(file)).map(normalizeItem);
    const { toPut, skipped, overwritten, duplicated } = mergeImportedItems(items, parsed, strategy);
    await itemRepo.createMany(toPut);
    setImportReport(
      `Imported ${toPut.length} items · skipped ${skipped} · overwritten ${overwritten} · duplicated ${duplicated}`,
    );
    pushToast({ message: 'CSV imported', tone: 'success' });
  };

  const rerunMigration = async () => {
    await settingsRepo.remove(LEGACY_MIGRATION_KEY);
    const result = await runLegacyMigration();
    pushToast({
      message: result.migrated
        ? `Migrated ${result.count} legacy items`
        : 'No legacy data found (or already imported)',
      tone: 'info',
    });
  };

  const resetAll = async () => {
    await Promise.all([itemRepo.replaceAll([]), listRepo.replaceAll([]), reminderLogRepo.clear()]);
    setConfirmReset(false);
    pushToast({ message: 'All data cleared', tone: 'info' });
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      pushToast({ message: 'Notifications are not supported in this browser', tone: 'error' });
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    await persist({ notificationsEnabled: result === 'granted' });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-fg">Settings</h1>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-fg">Appearance</h2>
        <Field label="Theme">
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {(['system', 'light', 'dark'] as ThemePreference[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize',
                  theme === option ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </Field>
        <div className="mt-3">
          <Field label="Week starts on">
            <Select
              value={String(settings.weekStartsOn)}
              onChange={(e) => void persist({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
              options={[
                { value: '1', label: 'Monday' },
                { value: '0', label: 'Sunday' },
              ]}
            />
          </Field>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-fg">Notifications</h2>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <div className="text-fg">Device notifications</div>
            <div className="text-xs text-muted">
              Permission: <span className="font-medium">{permission}</span>. Without a push server,
              background delivery depends on your OS and is best-effort. In-app banners always work.
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void requestNotifications()}>
            <Bell size={14} /> Enable
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <div className="text-fg">Daily digest</div>
            <div className="text-xs text-muted">Overdue items, today's agenda, bills, habits.</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              className="input w-28"
              value={settings.digestTime}
              onChange={(e) => void persist({ digestTime: e.target.value })}
            />
            <Toggle
              checked={settings.digestEnabled}
              label="Daily digest"
              onChange={(on) => void persist({ digestEnabled: on })}
            />
          </div>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-fg">Data</h2>
        <p className="text-xs text-muted">
          {items.length} items · {lists.length} lists · {backupCount} local snapshots · backup
          format v{BACKUP_VERSION}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportJSON}>
            <FileJson size={14} /> Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileSpreadsheet size={14} /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportICS}>
            <CalendarClock size={14} /> Export ICS
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void createSnapshot()}>
            <Download size={14} /> Save snapshot
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <Field label="On import conflict" className="w-48">
            <Select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as ImportStrategy)}
              options={[
                { value: 'skip', label: 'Skip existing' },
                { value: 'overwrite', label: 'Overwrite existing' },
                { value: 'duplicate', label: 'Keep both (new id)' },
              ]}
            />
          </Field>
          <Button variant="outline" size="sm" onClick={() => void importJSON()}>
            <Upload size={14} /> Import JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => void importCSV()}>
            <Upload size={14} /> Import CSV
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={() => void rerunMigration()}>
            <RefreshCw size={14} /> Re-run legacy import
          </Button>
          <span className="text-xs text-muted">
            Current migration version {LEGACY_MIGRATION_VERSION}. Raw v1 data is always kept at
            <code className="mx-1 rounded bg-elevated px-1">eisenmatrix-tasks.v1.bak</code>.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
            <Trash2 size={14} /> Reset all data
          </Button>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-fg">About</h2>
        <p className="text-xs text-muted">
          EisenMatrix Calendar is local-first and 100% static. Everything lives in IndexedDB on this
          device; there is no account and no server. Install it from your browser to use it offline.
        </p>
      </section>

      <Dialog
        open={!!importReport}
        onClose={() => setImportReport(null)}
        title="Import complete"
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setImportReport(null)}>
              Done
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">{importReport}</p>
      </Dialog>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all data?"
        message="This permanently deletes every item, list and reminder log on this device. Export a backup first if you need one."
        confirmLabel="Delete everything"
        danger
        onConfirm={() => void resetAll()}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
