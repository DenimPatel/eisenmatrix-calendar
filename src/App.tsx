import { Suspense, useEffect, useRef } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/features/shell/AppShell';
import { RouteAnnouncer } from '@/features/shell/RouteAnnouncer';
import { TodayView } from '@/features/today/TodayView';
import { ItemEditorSheet } from '@/features/item/ItemEditorSheet';
import { QuickAdd } from '@/features/quickadd/QuickAdd';
import { CommandPalette } from '@/features/command/CommandPalette';
import { ShortcutSheet } from '@/features/shell/ShortcutSheet';
import { HelpDialog } from '@/features/shell/HelpDialog';
import { ToastHost } from '@/components/ui/ToastHost';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';
import { RouteFallback } from '@/components/ui/RouteFallback';
import { ReminderRuntime } from '@/pwa/ReminderRuntime';
import { useTheme } from '@/hooks/useTheme';
import { lazyRoute } from '@/lib/lazyRoute';
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
import { reportFailure } from '@/lib/reportFailure';

// Today stays eager: it is the landing route, so its first paint must not wait on a
// chunk. Every other view is split so opening Today does not download them.
const CalendarView = lazyRoute(() =>
  import('@/features/calendar/CalendarView').then((m) => ({ default: m.CalendarView })),
);
const MatrixView = lazyRoute(() =>
  import('@/features/matrix/MatrixView').then((m) => ({ default: m.MatrixView })),
);
const ListView = lazyRoute(() =>
  import('@/features/list/ListView').then((m) => ({ default: m.ListView })),
);
const GoalsView = lazyRoute(() =>
  import('@/features/goals/GoalsView').then((m) => ({ default: m.GoalsView })),
);
const HabitsView = lazyRoute(() =>
  import('@/features/habits/HabitsView').then((m) => ({ default: m.HabitsView })),
);
const BillsView = lazyRoute(() =>
  import('@/features/bills/BillsView').then((m) => ({ default: m.BillsView })),
);
const ShoppingView = lazyRoute(() =>
  import('@/features/shopping/ShoppingView').then((m) => ({ default: m.ShoppingView })),
);
const NotesView = lazyRoute(() =>
  import('@/features/notes/NotesView').then((m) => ({ default: m.NotesView })),
);
const SettingsView = lazyRoute(() =>
  import('@/features/settings/SettingsView').then((m) => ({ default: m.SettingsView })),
);

export interface BootEffects {
  legacy: Promise<MigrationResult>;
  notificationGate: Promise<NotificationGateResult>;
}

/**
 * Route content with the lazy-chunk boundary. The boundary is keyed by the current
 * pathname so navigating away from a view that failed to load clears the error and
 * renders the new route instead of leaving the nav rail stuck on the alert.
 */
function RoutedViews() {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </RouteErrorBoundary>
  );
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
    // Import any v1 localStorage data (with a safety backup) on first boot. The migration is
    // headless, so the UI wires its own reporter to surface a swallowed parse failure.
    const legacy = runLegacyMigration({ onFailure: reportFailure });
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
        <RoutedViews />
      </AppShell>

      <RouteAnnouncer />
      <ItemEditorSheet />
      <QuickAdd />
      <CommandPalette />
      <ShortcutSheet />
      <HelpDialog />
      <ReminderRuntime />
      <ToastHost />
    </HashRouter>
  );
}
