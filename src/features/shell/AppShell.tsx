import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  Command,
  Keyboard,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sun,
} from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { isItemDrag, type DropData, type ItemDragData } from './dnd';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/store/useUiStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { QUADRANTS } from '@/domain/eisenhower';
import { patchItem, setPriority, updateOccurrence } from '@/domain/itemActions';
import { createItem } from '@/domain/itemFactory';
import { formatISODate } from '@/lib/date';

export function AppShell({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const openEditor = useUiStore((s) => s.openEditor);
  const [activeDrag, setActiveDrag] = useState<ItemDragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (isItemDrag(data)) setActiveDrag(data);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const drag = activeDrag;
    setActiveDrag(null);
    const drop = event.over?.data.current as DropData | undefined;
    if (!drag || !drop) return;
    const { item } = drag;

    if (drop.dropType === 'quadrant') {
      const quadrant = QUADRANTS[drop.quadrantId];
      if (!quadrant) return;
      await setPriority(item, quadrant.urgency, quadrant.importance);
      return;
    }

    if (drop.dropType === 'list') {
      await patchItem(item.id, { listId: drop.listId }, { silent: true });
      return;
    }

    if (drop.dropType === 'day') {
      const timeOfDay = !item.allDay && item.start?.includes('T') ? item.start.slice(11, 16) : null;
      const nextStart = timeOfDay ? `${drop.dateKey}T${timeOfDay}` : drop.dateKey;
      if (item.recurrence && drag.occurrenceKey) {
        await updateOccurrence(item, drag.occurrenceKey, { start: nextStart });
      } else {
        await patchItem(
          item.id,
          { start: nextStart, dueAt: nextStart, allDay: !timeOfDay },
          { silent: true },
        );
      }
    }
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setTheme(next);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="flex min-h-screen bg-bg text-fg">
        {/* Desktop nav rail */}
        <aside
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-all sm:flex',
            collapsed ? 'w-16' : 'w-56',
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-border px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <span className="text-sm font-black">EM</span>
            </div>
            {!collapsed && <span className="truncate font-bold">EisenMatrix</span>}
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent-soft text-accent'
                      : 'text-muted hover:bg-elevated hover:text-fg',
                  )
                }
                title={item.label}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="space-y-0.5 border-t border-border p-2">
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              <Plus size={18} className="shrink-0" />
              {!collapsed && <span>Quick add</span>}
            </button>
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-elevated hover:text-fg"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-4">
            <div className="flex items-center gap-2 sm:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
                <span className="text-xs font-black">EM</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-sm text-muted hover:border-accent/40 sm:max-w-md"
            >
              <Search size={16} />
              <span className="flex-1 text-left">Search or jump to…</span>
              <kbd className="hidden items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium sm:flex">
                <Command size={10} />K
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleTheme} title={`Theme: ${theme}`}>
                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShortcutsOpen(true)}
                title="Keyboard shortcuts"
              >
                <Keyboard size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex"
                onClick={() =>
                  openEditor(createItem({ kind: 'task', start: formatISODate(new Date()) }))
                }
                title="New task (N)"
              >
                <Plus size={18} />
              </Button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] flex-1 p-3 pb-24 sm:p-5 sm:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-1 overflow-x-auto border-t border-border bg-surface/95 px-1 py-1 backdrop-blur sm:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium',
                isActive ? 'text-accent' : 'text-muted',
              )
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
        }}
      >
        {activeDrag && (
          <div className="max-w-[16rem] truncate rounded-lg border border-accent bg-surface px-3 py-2 text-sm font-medium shadow-lg">
            {activeDrag.item.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
