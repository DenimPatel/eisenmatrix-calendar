// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

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
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

async function mount(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
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

function Bomb({ secret }: { secret: string }): React.ReactNode {
  throw new Error(secret);
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', async () => {
    const mounted = await mount(
      <ErrorBoundary>
        <p>Healthy content</p>
      </ErrorBoundary>,
    );
    expect(mounted.host.textContent).toContain('Healthy content');
    expect(mounted.host.querySelector('[role="alert"]')).toBeNull();
    await mounted.unmount();
  });

  it('renders a recoverable fallback instead of a blank page', async () => {
    const mounted = await mount(
      <ErrorBoundary>
        <Bomb secret="token=sk-live-secret" />
      </ErrorBoundary>,
    );
    const alert = mounted.host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Something went wrong');
    expect(alert?.textContent).toContain('Reload');
    expect(alert?.textContent).toContain('Try again');
    expect(alert?.textContent).not.toContain('sk-live-secret');
    await mounted.unmount();
  });

  it('recovers through Try again once the child stops throwing', async () => {
    let broken = true;
    function Flaky() {
      if (broken) throw new Error('render failed');
      return <p>Recovered content</p>;
    }

    const mounted = await mount(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(mounted.host.textContent).toContain('Something went wrong');

    broken = false;
    const retry = Array.from(mounted.host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Try again'),
    );
    expect(retry).toBeDefined();
    await act(async () => {
      retry?.click();
    });
    expect(mounted.host.textContent).toContain('Recovered content');
    await mounted.unmount();
  });
});
