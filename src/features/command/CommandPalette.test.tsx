// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandPalette } from './CommandPalette';
import { db } from '@/db/schema';
import { useUiStore } from '@/store/useUiStore';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountCommandPalette() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
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
  useUiStore.setState({ commandOpen: false, quickAddOpen: false });
});

afterEach(() => {
  document.body.innerHTML = '';
});

afterAll(async () => {
  await db.delete();
});

describe('CommandPalette', () => {
  it('focuses the search combobox on open', async () => {
    useUiStore.setState({ commandOpen: true });
    const mounted = await mountCommandPalette();

    const combobox = mounted.host.querySelector('[role="combobox"]');
    expect(combobox).not.toBeNull();
    expect(document.activeElement).toBe(combobox);

    await mounted.unmount();
  });

  it('returns focus to the opener when it closes', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    useUiStore.setState({ commandOpen: true });
    const mounted = await mountCommandPalette();
    expect(document.activeElement).toBe(mounted.host.querySelector('[role="combobox"]'));

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(useUiStore.getState().commandOpen).toBe(false);
    expect(document.activeElement).toBe(opener);

    await mounted.unmount();
    opener.remove();
  });
});
