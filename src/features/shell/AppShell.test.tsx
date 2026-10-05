// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';
import { NAV_ITEMS } from './nav';

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

afterEach(() => {
  document.body.innerHTML = '';
});

const cls = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

async function mountShell() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/today']}>
        <AppShell>
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    );
  });
  return {
    host,
    main: () => host.querySelector('main') as HTMLElement,
    navLabels: () =>
      Array.from(host.querySelectorAll('nav')).map((n) => n.getAttribute('aria-label')),
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('AppShell', () => {
  it('gives the rail and the mobile bar distinguishable navigation landmarks', async () => {
    const shell = await mountShell();
    const labels = shell.navLabels();

    // Both navs exist in the DOM at every width (one is hidden by a breakpoint), so
    // identical names would produce two `navigation "Primary"` landmarks.
    expect(labels).toHaveLength(2);
    expect(new Set(labels).size).toBe(2);
    expect(labels.every((l): l is string => typeof l === 'string' && l.length > 0)).toBe(true);
    for (const nav of Array.from(shell.host.querySelectorAll('nav'))) {
      expect(nav.getAttribute('aria-label')).toBe(
        nav.dataset.testid === 'mobile-nav-grid' ? 'Primary' : 'Primary sections',
      );
    }
    // Both still list every destination.
    expect(shell.host.querySelectorAll('nav a')).toHaveLength(NAV_ITEMS.length * 2);

    await shell.unmount();
  });

  it('reserves page-bottom padding from the mobile bar height, desktop unchanged', async () => {
    const shell = await mountShell();
    const main = cls(shell.main());

    // Derived from the measured bar height, so the last content never ends up under the
    // bar — including the part of the bar that reserves the home-indicator inset.
    const padding = main.find((c) => c.startsWith('pb-['));
    expect(padding).toBe('pb-[calc(var(--mobile-nav-h,7rem)+env(safe-area-inset-bottom)+1.75rem)]');
    expect(main).not.toContain('pb-32');
    // Desktop keeps its own padding, where the bar does not render.
    expect(main).toContain('sm:pb-6');

    await shell.unmount();
  });
});
