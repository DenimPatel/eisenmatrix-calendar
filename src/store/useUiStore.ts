import { create } from 'zustand';
import type { Item, ItemKind, ItemStatus, ThemePreference } from '@/types';
import { newId } from '@/lib/id';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  duration: number;
}

export interface UndoEntry {
  id: string;
  label: string;
  run: () => Promise<void> | void;
}

export interface EditorState {
  open: boolean;
  item: Item | null;
  occurrenceKey: string | null;
  splitMode: 'occurrence' | 'future' | 'all';
}

export interface Filters {
  search: string;
  kinds: ItemKind[];
  statuses: ItemStatus[];
  listId: string | null;
  tags: string[];
}

interface UiState {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  quickAddOpen: boolean;
  shortcutsOpen: boolean;
  editor: EditorState;
  filters: Filters;
  toasts: Toast[];
  undoStack: UndoEntry[];

  setTheme: (theme: ThemePreference) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;

  openEditor: (
    item: Item,
    occurrenceKey?: string | null,
    splitMode?: EditorState['splitMode'],
  ) => void;
  closeEditor: () => void;

  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;

  pushToast: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => string;
  dismissToast: (id: string) => void;
  pushUndo: (entry: Omit<UndoEntry, 'id'>) => void;
  undo: () => Promise<boolean>;
  clearUndo: () => void;
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  kinds: [],
  statuses: [],
  listId: null,
  tags: [],
};

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'system',
  sidebarCollapsed: false,
  commandOpen: false,
  quickAddOpen: false,
  shortcutsOpen: false,
  editor: { open: false, item: null, occurrenceKey: null, splitMode: 'all' },
  filters: { ...DEFAULT_FILTERS },
  toasts: [],
  undoStack: [],

  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

  openEditor: (item, occurrenceKey = null, splitMode = 'all') =>
    set({ editor: { open: true, item, occurrenceKey, splitMode } }),
  closeEditor: () =>
    set({ editor: { open: false, item: null, occurrenceKey: null, splitMode: 'all' } }),

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  pushToast: (toast) => {
    const id = newId();
    const duration = toast.duration ?? 4000;
    set((s) => ({
      toasts: [...s.toasts, { ...toast, id, duration }],
    }));
    if (duration > 0) {
      setTimeout(() => get().dismissToast(id), duration);
    }
    return id;
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  pushUndo: (entry) => {
    const full: UndoEntry = { ...entry, id: newId() };
    set((s) => ({ undoStack: [...s.undoStack.slice(-24), full] }));
  },

  undo: async () => {
    const stack = get().undoStack;
    if (!stack.length) return false;
    const entry = stack[stack.length - 1];
    set({ undoStack: stack.slice(0, -1) });
    await entry.run();
    return true;
  },

  clearUndo: () => set({ undoStack: [] }),
}));
