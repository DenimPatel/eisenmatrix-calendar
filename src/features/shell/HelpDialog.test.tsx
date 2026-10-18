// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HelpDialog } from './HelpDialog';
import { ShortcutSheet } from './ShortcutSheet';
import { useUiStore } from '@/store/useUiStore';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node: ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
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
  useUiStore.setState({ helpOpen: false, shortcutsOpen: false });
});

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('HelpDialog', () => {
  it('opens with focus on the heading and lists quick-add syntax', async () => {
    useUiStore.setState({ helpOpen: true });
    const mounted = await mount(<HelpDialog />);

    const heading = mounted.host.querySelector('h2');
    expect(heading?.textContent).toBe('Help & syntax');
    expect(document.activeElement).toBe(heading);

    const text = mounted.host.textContent ?? '';
    expect(text).toContain('pay electricity $120 every month on the 5th !urgent');
    expect(text).toContain('Keyboard shortcuts');
    expect(text).toContain('Export formats');

    await mounted.unmount();
  });

  it('returns focus to the opener on close', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    useUiStore.setState({ helpOpen: true });
    const mounted = await mount(<HelpDialog />);
    expect(document.activeElement).toBe(mounted.host.querySelector('h2'));

    await act(async () => {
      useUiStore.getState().setHelpOpen(false);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(document.activeElement).toBe(opener);

    await mounted.unmount();
    opener.remove();
  });

  it('is reachable from the shortcut sheet', async () => {
    useUiStore.setState({ shortcutsOpen: true });
    const mounted = await mount(<ShortcutSheet />);

    const button = Array.from(mounted.host.querySelectorAll('button')).find(
      (el) => el.textContent?.trim() === 'Quick-add syntax & help',
    );
    expect(button).not.toBeUndefined();

    await act(async () => {
      button!.click();
    });

    expect(useUiStore.getState().helpOpen).toBe(true);
    expect(useUiStore.getState().shortcutsOpen).toBe(false);

    await mounted.unmount();
  });
});
