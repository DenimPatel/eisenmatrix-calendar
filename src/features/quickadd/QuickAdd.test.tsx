// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuickAdd } from './QuickAdd';
import { db } from '@/db/schema';
import { useUiStore } from '@/store/useUiStore';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountQuickAdd() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<QuickAdd />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
  return {
    host,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

beforeEach(async () => {
  await db.items.clear();
  await db.lists.clear();
  useUiStore.setState({ quickAddOpen: false, commandOpen: false });
});

afterEach(() => {
  document.body.innerHTML = '';
});

afterAll(async () => {
  await db.delete();
});

describe('QuickAdd', () => {
  it('focuses the quick add textbox on open', async () => {
    useUiStore.setState({ quickAddOpen: true });
    const mounted = await mountQuickAdd();

    const input = mounted.host.querySelector('input');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Close dialog');

    await mounted.unmount();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    useUiStore.setState({ quickAddOpen: true });
    const mounted = await mountQuickAdd();
    expect(document.activeElement).toBe(mounted.host.querySelector('input'));

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(useUiStore.getState().quickAddOpen).toBe(false);
    expect(document.activeElement).toBe(opener);

    await mounted.unmount();
    opener.remove();
  });
});
