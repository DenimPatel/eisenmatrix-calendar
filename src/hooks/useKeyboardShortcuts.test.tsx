// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { isOverlayOpen, useUiStore, type EditorState, type OverlayState } from '@/store/useUiStore';
import { createItem } from '@/domain/itemFactory';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CLOSED_EDITOR: EditorState = {
  open: false,
  item: null,
  occurrenceKey: null,
  splitMode: 'all',
};

function baseState(): OverlayState {
  return {
    commandOpen: false,
    quickAddOpen: false,
    shortcutsOpen: false,
    helpOpen: false,
    editor: CLOSED_EDITOR,
  };
}

describe('isOverlayOpen', () => {
  it('is false when every overlay is closed', () => {
    expect(isOverlayOpen(baseState())).toBe(false);
  });

  it.each(['commandOpen', 'quickAddOpen', 'shortcutsOpen', 'helpOpen'] as const)(
    'is true when %s is set',
    (flag) => {
      expect(isOverlayOpen({ ...baseState(), [flag]: true })).toBe(true);
    },
  );

  it('is true when only the editor is open', () => {
    const item = createItem({ kind: 'task' });
    expect(isOverlayOpen({ ...baseState(), editor: { ...CLOSED_EDITOR, open: true, item } })).toBe(
      true,
    );
  });

  it('ignores non-overlay state such as toasts and undo entries', () => {
    const state = useUiStore.getState();
    expect(isOverlayOpen(state)).toBe(false);
    state.pushToast({ message: 'hi', tone: 'info', duration: 0 });
    expect(isOverlayOpen(useUiStore.getState())).toBe(false);
  });
});

function Harness() {
  useKeyboardShortcuts();
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

async function mountShortcuts() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/today']}>
        <Harness />
      </MemoryRouter>,
    );
  });
  return {
    path: () => host.querySelector('[data-testid="path"]')?.textContent,
    press: async (key: string, init: KeyboardEventInit = {}) => {
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

function resetUi() {
  useUiStore.setState({ ...baseState(), toasts: [], undoStack: [] });
}

/** Everything a suppressed shortcut could have changed: route, overlays and the editor. */
function snapshot(app: { path: () => string | null | undefined }) {
  const state = useUiStore.getState();
  return {
    path: app.path(),
    commandOpen: state.commandOpen,
    quickAddOpen: state.quickAddOpen,
    shortcutsOpen: state.shortcutsOpen,
    editorOpen: state.editor.open,
    editorItemId: state.editor.item?.id ?? null,
  };
}

beforeEach(() => {
  resetUi();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useKeyboardShortcuts', () => {
  it('navigates to a view with its digit shortcut', async () => {
    const app = await mountShortcuts();

    await app.press('2');
    expect(app.path()).toBe('/calendar');

    await app.unmount();
  });

  it('opens quick add with c', async () => {
    const app = await mountShortcuts();

    await app.press('c');
    expect(useUiStore.getState().quickAddOpen).toBe(true);

    await app.unmount();
  });

  it('opens the shortcut sheet with ?', async () => {
    const app = await mountShortcuts();

    await app.press('?');
    expect(useUiStore.getState().shortcutsOpen).toBe(true);

    await app.unmount();
  });

  it('opens the editor on a new task with n', async () => {
    const app = await mountShortcuts();

    await app.press('n');
    const state = useUiStore.getState();
    expect(state.editor.open).toBe(true);
    expect(state.editor.item?.kind).toBe('task');

    await app.unmount();
  });

  it.each(['commandOpen', 'quickAddOpen', 'shortcutsOpen'] as const)(
    'does not navigate or create while %s is set',
    async (flag) => {
      useUiStore.setState({ [flag]: true });
      const app = await mountShortcuts();
      const before = snapshot(app);

      for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'c', 'n', '?', '/']) {
        await app.press(key);
        expect(snapshot(app), `key "${key}" must not fire`).toEqual(before);
      }

      await app.unmount();
    },
  );

  it('does not navigate or create while the editor is open', async () => {
    const item = createItem({ kind: 'event', title: 'Standup' });
    useUiStore.getState().openEditor(item);
    const app = await mountShortcuts();
    const before = snapshot(app);

    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'c', 'n', '?', '/']) {
      await app.press(key);
      expect(snapshot(app), `key "${key}" must not fire`).toEqual(before);
    }

    await app.unmount();
  });

  it('still runs undo from inside an open overlay', async () => {
    const run = vi.fn();
    useUiStore.getState().pushUndo({ label: 'delete', run });
    useUiStore.getState().openEditor(createItem({ kind: 'task', title: 'Draft' }));
    const app = await mountShortcuts();

    await app.press('z', { metaKey: true });

    expect(run).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().undoStack).toHaveLength(0);
    expect(useUiStore.getState().toasts[0]?.message).toBe('Undone');

    await app.unmount();
  });

  it('leaves typing targets alone even when no overlay is open', async () => {
    const app = await mountShortcuts();
    const input = document.createElement('input');
    document.body.appendChild(input);

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }),
      );
    });
    expect(useUiStore.getState().quickAddOpen).toBe(false);

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(useUiStore.getState().undoStack).toHaveLength(0);

    input.remove();
    await app.unmount();
  });
});
