// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileBottomNav } from './MobileBottomNav';
import { NAV_ITEMS } from './nav';
import { ToastHost } from '@/components/ui/ToastHost';
import { MOBILE_NAV_HEIGHT_VAR } from '@/lib/layout';
import { useUiStore } from '@/store/useUiStore';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountNav(initialEntries: string[] = ['/today']) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
  });
  const links = () => Array.from(host.querySelectorAll('nav a'));
  return {
    host,
    bar: () => host.firstElementChild as HTMLElement,
    nav: () => host.querySelector('nav') as HTMLElement,
    links,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.style.removeProperty(MOBILE_NAV_HEIGHT_VAR);
  useUiStore.setState({ toasts: [] });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const cls = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

const REM = 16;
/** Smallest gap the verifier asked for between the toast stack and the bar's top edge. */
const MIN_CLEARANCE_PX = 8;
/** iOS home-indicator inset; the bar must pad itself by this much. */
const HOME_INDICATOR_PX = 34;

/** Grid height implied by the classes actually rendered, derived independently. */
function gridHeightFromClasses(bar: HTMLElement): number {
  const grid = bar.querySelector('nav') as HTMLElement;
  const cells = bar.querySelectorAll('nav a');
  const columns = Number(
    cls(grid)
      .find((c) => c.startsWith('grid-cols-'))
      ?.split('-')
      .pop(),
  );
  const gap = cls(grid).includes('gap-1') ? 4 : 0;
  const padY = cls(grid).includes('py-1') ? 4 : 0;
  const cellH = cls(cells[0]).includes('min-h-11') ? 44 : 0;

  expect(cells).toHaveLength(NAV_ITEMS.length);
  expect({ columns, gap, padY, cellH }).toEqual({ columns: 5, gap: 4, padY: 4, cellH: 44 });

  const rows = Math.ceil(cells.length / columns);
  return rows * cellH + (rows - 1) * gap + padY * 2;
}

/** What the bar adds on top of the grid: its top border, plus any device inset. */
function barChrome(bar: HTMLElement, insetPx: number): number {
  expect(cls(bar)).toContain('border-t');
  expect(cls(bar)).toContain('pb-[env(safe-area-inset-bottom)]');
  return 1 + insetPx;
}

const DERIVED_OFFSET =
  /^bottom-\[calc\(var\(--mobile-nav-h,([\d.]+)rem\)\+env\(safe-area-inset-bottom\)\+([\d.]+)rem\)\]$/;

/** Pulls the fallback and the gap out of the toast stack's offset utility. */
function parseToastOffset(toastStack: HTMLElement): { fallbackPx: number; gapPx: number } {
  const utility = cls(toastStack).find((c) => c.startsWith('bottom-'));
  expect(utility, 'the toast stack has no bottom offset utility').toBeTruthy();
  const match = DERIVED_OFFSET.exec(utility as string);
  expect(
    match,
    `toast offset "${utility}" must be calc(var(${MOBILE_NAV_HEIGHT_VAR},…) + env(safe-area-inset-bottom) + gap), not a fixed height`,
  ).toBeTruthy();
  const [, fallbackRem, gapRem] = match as RegExpExecArray;
  return { fallbackPx: Number(fallbackRem) * REM, gapPx: Number(gapRem) * REM };
}

/**
 * Resolves the toast stack's bottom offset in px the way the browser would, given the grid
 * height the nav has published (0 for "not published yet", which falls back) and the
 * device's bottom inset, which CSS resolves live.
 */
function toastBottomOffsetPx(
  toastStack: HTMLElement,
  publishedGridHeightPx: number,
  insetPx = 0,
): number {
  const { fallbackPx, gapPx } = parseToastOffset(toastStack);
  return Math.max(publishedGridHeightPx, fallbackPx) + insetPx + gapPx;
}

/** Makes the nav grid report a chosen height. */
function stubGridHeight(initialPx: number) {
  let height = initialPx;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const h = this.dataset.testid === 'mobile-nav-grid' ? height : 0;
    return {
      width: 0,
      height: h,
      top: 0,
      left: 0,
      right: 0,
      bottom: h,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  });
  return {
    set: (px: number) => {
      height = px;
    },
    published: () => document.documentElement.style.getPropertyValue(MOBILE_NAV_HEIGHT_VAR),
  };
}

async function mountNavWithToasts() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/today']}>
        <MobileBottomNav />
        <ToastHost />
      </MemoryRouter>,
    );
  });
  return {
    bar: () => host.querySelector('[data-testid="mobile-nav-bar"]') as HTMLElement,
    stack: () => host.querySelector('[data-testid="toast-stack"]') as HTMLElement,
    undo: () => host.querySelector('button') as HTMLElement | null,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('MobileBottomNav', () => {
  it('renders every destination as a focusable link, in nav order', async () => {
    const nav = await mountNav();

    expect(nav.links().map((a) => a.textContent)).toEqual(NAV_ITEMS.map((i) => i.label));
    expect(nav.links().every((a) => a.getAttribute('href'))).toBe(true);

    await nav.unmount();
  });

  it('lays all ten destinations out in a visible grid with no horizontal scroller', async () => {
    const nav = await mountNav();
    const grid = nav.nav();

    expect(grid.getAttribute('aria-label')).toBe('Primary');
    expect(cls(grid)).toContain('grid');
    expect(cls(grid)).toContain('grid-cols-5');
    // A horizontal scroller is what hid Shopping/Notes/Settings at 390px; any overflow
    // utility on the strip is the regression this test exists to catch.
    expect(cls(grid).filter((c) => c.startsWith('overflow'))).toEqual([]);
    // Every destination is a direct grid cell, so none can end up outside the viewport.
    expect(grid.children).toHaveLength(NAV_ITEMS.length);
    expect(nav.links().every((a) => a.parentElement === grid)).toBe(true);

    await nav.unmount();
  });

  it('never renders a scroll cue or any overlay that could sit on top of a link', async () => {
    const nav = await mountNav();

    expect(nav.host.querySelectorAll('[data-testid^="mobile-nav-fade"]')).toHaveLength(0);
    // The bar is exactly the nav: no sibling decoration painted over the labels.
    expect(Array.from(nav.bar().children).map((c) => c.tagName)).toEqual(['NAV']);
    for (const el of Array.from(nav.bar().querySelectorAll('*'))) {
      expect(cls(el).some((c) => c.startsWith('absolute') || c.startsWith('fixed'))).toBe(false);
      expect(cls(el).some((c) => c.startsWith('bg-gradient') || c.startsWith('from-'))).toBe(false);
    }

    await nav.unmount();
  });

  it('keeps any non-link decoration inert, so a cue can never become a mis-tap', async () => {
    const nav = await mountNav();

    for (const el of Array.from(nav.bar().querySelectorAll('*'))) {
      if (el === nav.nav() || el.closest('a')) continue;
      const classes = cls(el);
      expect(classes).toContain('pointer-events-none');
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(el.hasAttribute('onclick')).toBe(false);
    }

    await nav.unmount();
  });

  it('highlights the active destination on first render at 390px', async () => {
    const nav = await mountNav(['/today']);
    const today = nav.links()[0];

    expect(today.getAttribute('aria-current')).toBe('page');
    // A solid accent pill, not a hue-only tint: it carries the 1.4.3 text contrast and the
    // 1.4.11 3:1 non-text contrast in both themes.
    expect(cls(today)).toContain('bg-accent');
    expect(cls(today)).toContain('text-accent-fg');
    // Not hue-only: the inactive cells carry neither token.
    expect(cls(nav.links()[9])).not.toContain('bg-accent');
    expect(cls(nav.links()[9])).toContain('text-muted');

    await nav.unmount();
  });

  it('highlights a deep-linked off-row destination on load, not after interaction', async () => {
    const nav = await mountNav(['/settings']);
    const settings = nav.links().find((a) => a.textContent === 'Settings') as HTMLAnchorElement;

    expect(settings.getAttribute('aria-current')).toBe('page');
    expect(cls(settings)).toContain('bg-accent');
    // Second row of the grid: still inside the viewport, with no scroll step needed.
    expect(settings.parentElement).toBe(nav.nav());

    await nav.unmount();
  });

  it('keeps every cell a comfortable touch target', async () => {
    const nav = await mountNav();

    for (const link of nav.links()) {
      const classes = cls(link);
      expect(classes).toContain('min-h-11');
      expect(classes).toContain('rounded-lg');
    }

    await nav.unmount();
  });

  it('animates nothing, so reduced motion needs no branch', async () => {
    const nav = await mountNav();

    for (const el of Array.from(nav.bar().querySelectorAll('*'))) {
      const classes = cls(el);
      expect(classes.some((c) => c.startsWith('animate-') || c.startsWith('transition'))).toBe(
        false,
      );
      expect(classes).not.toContain('scroll-smooth');
    }

    await nav.unmount();
  });
});

describe('MobileBottomNav bar clearance', () => {
  it('pads itself by the home-indicator inset so no row sits under it', async () => {
    const nav = await mountNav();

    // `viewport-fit=cover` means the bar reaches the physical bottom edge; without this
    // inset the second row of five destinations lands under the iOS home indicator.
    expect(cls(nav.bar())).toContain('pb-[env(safe-area-inset-bottom)]');
    // The inset must not be guessed as a fixed number, which would double-count on
    // devices that have none.
    expect(cls(nav.bar()).some((c) => c.startsWith('pb-') && !c.includes('env('))).toBe(false);

    await nav.unmount();
  });

  it('publishes its measured grid height so overlays cannot be sized against a stale guess', async () => {
    const grid = stubGridHeight(100);
    const nav = await mountNav();

    expect(grid.published()).toBe('100px');

    // Grows (larger root font, a third row of cells) → consumers follow, with no
    // re-measurement needed for the device inset, which they resolve from CSS themselves.
    grid.set(148);
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(grid.published()).toBe('148px');

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(grid.published()).toBe('148px');

    await nav.unmount();
    expect(grid.published()).toBe('');
  });

  it('keeps the published height in step with the grid through a ResizeObserver', async () => {
    const observers: Array<{ callback: ResizeObserverCallback; disconnected: boolean }> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        callback: ResizeObserverCallback;
        disconnected = false;
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
          observers.push(this);
        }
        observe() {}
        unobserve() {}
        disconnect() {
          this.disconnected = true;
        }
      },
    );
    const grid = stubGridHeight(100);
    const nav = await mountNav();

    expect(observers).toHaveLength(1);
    expect(grid.published()).toBe('100px');

    grid.set(140);
    await act(async () => {
      observers[0].callback([], {} as ResizeObserver);
    });
    expect(grid.published()).toBe('140px');

    await nav.unmount();
    expect(observers[0].disconnected).toBe(true);
    expect(grid.published()).toBe('');
  });

  it('holds the toast stack above the bar, so Undo can never land on a nav cell', async () => {
    stubGridHeight(100);
    useUiStore.setState({
      toasts: [
        {
          id: 't1',
          message: 'Deleted',
          tone: 'info',
          actionLabel: 'Undo',
          onAction: () => {},
          duration: 4000,
        },
      ],
    });
    const mounted = await mountNavWithToasts();
    const gridHeight = gridHeightFromClasses(mounted.bar());
    const barHeight = gridHeight + barChrome(mounted.bar(), 0);

    expect(gridHeight).toBe(100);
    expect(barHeight).toBe(101);
    // Before the grid has measured, the fallback alone must still clear the real bar.
    expect(toastBottomOffsetPx(mounted.stack(), 0)).toBeGreaterThanOrEqual(
      barHeight + MIN_CLEARANCE_PX,
    );

    // Once measured, the offset is the grid's height plus a gap, so it cannot drift; a
    // hardcoded `bottom-20`-style utility cannot parse as this and fails above.
    expect(toastBottomOffsetPx(mounted.stack(), gridHeight)).toBeGreaterThanOrEqual(
      barHeight + MIN_CLEARANCE_PX,
    );
    // On a notched device the bar is taller by the inset it reserves, and the stack still clears it.
    expect(
      toastBottomOffsetPx(mounted.stack(), gridHeight, HOME_INDICATOR_PX),
    ).toBeGreaterThanOrEqual(
      gridHeight + barChrome(mounted.bar(), HOME_INDICATOR_PX) + MIN_CLEARANCE_PX,
    );

    // Desktop keeps its own offset, where the bar does not exist at all.
    expect(cls(mounted.stack())).toContain('sm:bottom-4');
    // Only the toasts themselves take pointer events, so the stack's own box never
    // intercepts a tap meant for the bar beneath it.
    expect(cls(mounted.stack())).toContain('pointer-events-none');
    const toast = mounted.stack().firstElementChild as HTMLElement;
    expect(cls(toast)).toContain('pointer-events-auto');
    expect(toast.contains(mounted.undo())).toBe(true);

    await mounted.unmount();
  });

  it('resolves the home-indicator inset in CSS, so no re-measurement can leave the stack behind', async () => {
    const grid = stubGridHeight(100);
    const mounted = await mountNavWithToasts();
    const gridHeight = gridHeightFromClasses(mounted.bar());
    const published = Number.parseInt(grid.published(), 10);

    // The offset carries an `env(safe-area-inset-bottom)` term, so a device that gains or
    // loses its home indicator is handled by the style engine rather than by measurement.
    expect(published).toBe(gridHeight);
    expect(toastBottomOffsetPx(mounted.stack(), published, HOME_INDICATOR_PX)).toBe(
      toastBottomOffsetPx(mounted.stack(), published) + HOME_INDICATOR_PX,
    );
    expect(
      toastBottomOffsetPx(mounted.stack(), published, HOME_INDICATOR_PX),
    ).toBeGreaterThanOrEqual(
      gridHeight + barChrome(mounted.bar(), HOME_INDICATOR_PX) + MIN_CLEARANCE_PX,
    );

    await mounted.unmount();
  });
});
