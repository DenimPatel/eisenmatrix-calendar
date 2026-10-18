// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from './RouteErrorBoundary';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
    render: async (next: React.ReactNode) => {
      await act(async () => {
        root.render(next);
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

function findButton(host: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(label),
  );
}

function Bomb(): React.ReactNode {
  throw new Error('Failed to fetch dynamically imported module');
}

describe('RouteErrorBoundary', () => {
  it('renders children when nothing throws', async () => {
    const mounted = await mount(
      <RouteErrorBoundary>
        <p>Route content</p>
      </RouteErrorBoundary>,
    );
    expect(mounted.host.textContent).toContain('Route content');
    expect(mounted.host.querySelector('[role="alert"]')).toBeNull();
    await mounted.unmount();
  });

  it('shows a retry instead of a blank screen when a chunk fails to load', async () => {
    const mounted = await mount(
      <RouteErrorBoundary>
        <Bomb />
      </RouteErrorBoundary>,
    );
    const alert = mounted.host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('This view could not load');
    expect(findButton(mounted.host, 'Try again')).toBeDefined();
    expect(findButton(mounted.host, 'Go to Today')).toBeDefined();
    await mounted.unmount();
  });

  it('invokes the injected retry and home handlers', async () => {
    const onRetry = vi.fn();
    const onGoHome = vi.fn();
    const mounted = await mount(
      <RouteErrorBoundary onRetry={onRetry} onGoHome={onGoHome}>
        <Bomb />
      </RouteErrorBoundary>,
    );

    await act(async () => {
      findButton(mounted.host, 'Try again')?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    await act(async () => {
      findButton(mounted.host, 'Go to Today')?.click();
    });
    expect(onGoHome).toHaveBeenCalledTimes(1);
    await mounted.unmount();
  });

  it('clears a latched error when resetKey changes (navigation)', async () => {
    const mounted = await mount(
      <RouteErrorBoundary resetKey="/matrix">
        <Bomb />
      </RouteErrorBoundary>,
    );
    expect(mounted.host.querySelector('[role="alert"]')).not.toBeNull();

    await mounted.render(
      <RouteErrorBoundary resetKey="/settings">
        <p>Settings view</p>
      </RouteErrorBoundary>,
    );
    expect(mounted.host.querySelector('[role="alert"]')).toBeNull();
    expect(mounted.host.textContent).toContain('Settings view');
    await mounted.unmount();
  });

  it('keeps the error while resetKey is unchanged', async () => {
    const mounted = await mount(
      <RouteErrorBoundary resetKey="/matrix">
        <Bomb />
      </RouteErrorBoundary>,
    );
    await mounted.render(
      <RouteErrorBoundary resetKey="/matrix">
        <p>Still broken</p>
      </RouteErrorBoundary>,
    );
    expect(mounted.host.querySelector('[role="alert"]')).not.toBeNull();
    expect(mounted.host.textContent).not.toContain('Still broken');
    await mounted.unmount();
  });

  it('recovers through retry once the child stops throwing', async () => {
    let broken = true;
    function Flaky() {
      if (broken) throw new Error('render failed');
      return <p>Recovered route</p>;
    }

    const mounted = await mount(
      <RouteErrorBoundary
        onRetry={() => {
          broken = false;
        }}
      >
        <Flaky />
      </RouteErrorBoundary>,
    );
    expect(mounted.host.textContent).toContain('This view could not load');

    await act(async () => {
      findButton(mounted.host, 'Try again')?.click();
    });
    expect(mounted.host.textContent).toContain('Recovered route');
    await mounted.unmount();
  });
});
