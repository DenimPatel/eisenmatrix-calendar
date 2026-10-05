// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ShortcutSheet } from './ShortcutSheet';
import { useUiStore } from '@/store/useUiStore';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountShortcutSheet() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<ShortcutSheet />);
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

beforeEach(() => {
  useUiStore.setState({ shortcutsOpen: false });
});

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('ShortcutSheet', () => {
  it('opens with focus on the dialog heading, not the Close button', async () => {
    useUiStore.setState({ shortcutsOpen: true });
    const mounted = await mountShortcutSheet();

    const heading = mounted.host.querySelector('h2');
    expect(heading?.textContent).toBe('Keyboard shortcuts');
    expect(document.activeElement).toBe(heading);
    expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Close dialog');

    await mounted.unmount();
  });

  it('returns focus to the opener on close', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    useUiStore.setState({ shortcutsOpen: true });
    const mounted = await mountShortcutSheet();
    expect(document.activeElement).toBe(mounted.host.querySelector('h2'));

    await act(async () => {
      useUiStore.getState().setShortcutsOpen(false);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(document.activeElement).toBe(opener);

    await mounted.unmount();
    opener.remove();
  });
});
