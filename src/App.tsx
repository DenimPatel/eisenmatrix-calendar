import { useEffect, useRef } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/features/shell/AppShell';
import { TodayView } from '@/features/today/TodayView';
import { CalendarView } from '@/features/calendar/CalendarView';
import { MatrixView } from '@/features/matrix/MatrixView';
import { ListView } from '@/features/list/ListView';
import { GoalsView } from '@/features/goals/GoalsView';
import { HabitsView } from '@/features/habits/HabitsView';
import { BillsView } from '@/features/bills/BillsView';
import { ShoppingView } from '@/features/shopping/ShoppingView';
import { NotesView } from '@/features/notes/NotesView';
import { SettingsView } from '@/features/settings/SettingsView';
import { ItemEditorSheet } from '@/features/item/ItemEditorSheet';
import { QuickAdd } from '@/features/quickadd/QuickAdd';
import { CommandPalette } from '@/features/command/CommandPalette';
import { ShortcutSheet } from '@/features/shell/ShortcutSheet';
import { ToastHost } from '@/components/ui/ToastHost';
import { ReminderRuntime } from '@/pwa/ReminderRuntime';
import { useTheme } from '@/hooks/useTheme';
import { setupPWA } from '@/pwa/register';
import { runLegacyMigration, type MigrationResult } from '@/db/migrations/legacyTasks';
import {
  runNotificationGateMigration,
  type NotificationGateResult,
} from '@/db/migrations/notificationGate';
import { ensureDbOpen } from '@/db/repository';
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  OFFLINE_UNAVAILABLE_MESSAGE,
  reportBootFailure,
} from '@/lib/bootFailure';

export interface BootEffects {
  legacy: Promise<MigrationResult>;
  notificationGate: Promise<NotificationGateResult>;
}

interface AppProps {
  onBootEffects?: (effects: BootEffects) => void;
}

export default function App({ onBootEffects }: AppProps = {}) {
  useTheme();
  const onBootEffectsRef = useRef(onBootEffects);

  useEffect(() => {
    void ensureDbOpen().catch((error: unknown) => {
      reportBootFailure(DATABASE_UNAVAILABLE_MESSAGE, error);
    });
    // Import any v1 localStorage data (with a safety backup) on first boot.
    const legacy = runLegacyMigration();
    void legacy.catch((error: unknown) => {
      reportBootFailure('Data migration failed — some items may be missing.', error);
    });
    // Carry an existing browser notification grant over to the delivery gate.
    const notificationGate = runNotificationGateMigration();
    void notificationGate.catch((error: unknown) => {
      reportBootFailure('Notification settings could not be restored.', error);
    });
    onBootEffectsRef.current?.({ legacy, notificationGate });
    try {
      setupPWA();
    } catch (error) {
      reportBootFailure(OFFLINE_UNAVAILABLE_MESSAGE, error);
    }
  }, []);

  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/matrix" element={<MatrixView />} />
          <Route path="/lists" element={<ListView />} />
          <Route path="/goals" element={<GoalsView />} />
          <Route path="/habits" element={<HabitsView />} />
          <Route path="/bills" element={<BillsView />} />
          <Route path="/shopping" element={<ShoppingView />} />
          <Route path="/notes" element={<NotesView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </AppShell>

      <ItemEditorSheet />
      <QuickAdd />
      <CommandPalette />
      <ShortcutSheet />
      <ReminderRuntime />
      <ToastHost />
    </HashRouter>
  );
}
