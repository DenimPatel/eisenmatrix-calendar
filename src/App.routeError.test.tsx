// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('@/features/matrix/MatrixView', () => ({
  MatrixView: () => {
    throw new Error('route render failed');
  },
}));

import App from '@/App';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

async function waitFor(host: HTMLElement, check: () => boolean, timeout = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error('Timed out waiting for condition');
}

describe('App route error boundary navigation', () => {
  it('recovers when navigating away from a view that failed to render', async () => {
    window.location.hash = '#/matrix';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<App />);
    });

    await waitFor(host, () => host.textContent?.includes('This view could not load') ?? false);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();

    // Navigate away from the failed route; the boundary is keyed by pathname and must
    // clear so the nav rail is not stuck on the alert.
    await act(async () => {
      window.location.hash = '#/settings';
    });
    await waitFor(
      host,
      () =>
        (host.textContent?.includes('Settings') ?? false) && !host.querySelector('[role="alert"]'),
    );
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain('Settings');

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
