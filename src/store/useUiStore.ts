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

export interface OverlayState {
  commandOpen: boolean;
  quickAddOpen: boolean;
  shortcutsOpen: boolean;
  helpOpen: boolean;
  editor: EditorState;
}

interface UiState {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  quickAddOpen: boolean;
  shortcutsOpen: boolean;
  helpOpen: boolean;
  editor: EditorState;
  overlayStack: string[];
  filters: Filters;
  toasts: Toast[];
  undoStack: UndoEntry[];

  setTheme: (theme: ThemePreference) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  registerOverlay: (id: string) => void;
  unregisterOverlay: (id: string) => void;
  isTopOverlay: (id: string) => boolean;

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
  pushUndo: (entry: Omit<UndoEntry, 'id'>) => string;
  undo: (id?: string) => Promise<boolean>;
  clearUndo: () => void;
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  kinds: [],
  statuses: [],
  listId: null,
  tags: [],
};

/** Any modal layer that owns the screen; global shortcuts must stand down while one is up. */
export function isOverlayOpen(state: OverlayState): boolean {
  return (
    state.commandOpen ||
    state.quickAddOpen ||
    state.shortcutsOpen ||
    state.helpOpen ||
    state.editor.open
  );
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'system',
  sidebarCollapsed: false,
  commandOpen: false,
  quickAddOpen: false,
  shortcutsOpen: false,
  helpOpen: false,
  editor: { open: false, item: null, occurrenceKey: null, splitMode: 'all' },
  overlayStack: [],
  filters: { ...DEFAULT_FILTERS },
  toasts: [],
  undoStack: [],

  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),

  registerOverlay: (id) =>
    set((s) => ({
      overlayStack: s.overlayStack.includes(id) ? s.overlayStack : [...s.overlayStack, id],
    })),
  unregisterOverlay: (id) =>
    set((s) => ({ overlayStack: s.overlayStack.filter((entry) => entry !== id) })),
  isTopOverlay: (id) => {
    const stack = get().overlayStack;
    return stack.length > 0 && stack[stack.length - 1] === id;
  },

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
    return full.id;
  },

  undo: async (id?: string) => {
    const stack = get().undoStack;
    if (!stack.length) return false;
    // A toast's Undo carries the id of the entry its own action pushed, so it reverts that
    // entry and never whatever happens to sit on top. An id that is no longer on the stack
    // (evicted by the 25-entry cap, or already undone) is a safe no-op.
    const index = id === undefined ? stack.length - 1 : stack.findIndex((e) => e.id === id);
    if (index < 0) return false;
    const entry = stack[index];
    set({ undoStack: stack.filter((_, i) => i !== index) });
    await entry.run();
    return true;
  },

  clearUndo: () => set({ undoStack: [] }),
}));
