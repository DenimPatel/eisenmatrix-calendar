// @vitest-environment jsdom
import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DATABASE_UNAVAILABLE_MESSAGE } from '@/lib/bootFailure';
import { useUiStore } from '@/store/useUiStore';

const boot = vi.hoisted(() => ({ rejects: false, error: new Error('blocked') }));

vi.mock('@/db/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/repository')>();
  return {
    ...actual,
    ensureDbOpen: async () => {
      if (boot.rejects) throw boot.error;
    },
  };
});

import App from '@/App';

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    },
  });

  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: { permission: 'granted' },
  });
});

beforeEach(() => {
  boot.rejects = false;
  useUiStore.setState({ toasts: [] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mountApp(): Promise<{ host: HTMLElement; unmount: () => Promise<void> }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<App />);
  });
  for (let turn = 0; turn < 12; turn++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
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

describe('App boot failure copy', () => {
  it('names the local database, not local storage, when the database fails to open', async () => {
    boot.rejects = true;
    const mounted = await mountApp();

    const messages = useUiStore.getState().toasts.map((t) => t.message);
    expect(messages).toContain(DATABASE_UNAVAILABLE_MESSAGE);
    expect(messages.join(' ')).not.toContain('local storage');

    await mounted.unmount();
  });

  it('does not toast a database failure when the database opens', async () => {
    const mounted = await mountApp();

    const messages = useUiStore.getState().toasts.map((t) => t.message);
    expect(messages).not.toContain(DATABASE_UNAVAILABLE_MESSAGE);

    await mounted.unmount();
  });
});
