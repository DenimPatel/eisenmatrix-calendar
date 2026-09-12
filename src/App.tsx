import { useEffect } from 'react';
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
import { runLegacyMigration } from '@/db/migrations/legacyTasks';

export default function App() {
  useTheme();

  useEffect(() => {
    // Import any v1 localStorage data (with a safety backup) on first boot.
    void runLegacyMigration();
    setupPWA();
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
