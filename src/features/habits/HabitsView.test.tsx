// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HabitsView } from './HabitsView';
import { db } from '@/db/schema';
import { itemRepo, settingsRepo } from '@/db/repository';
import { createItem } from '@/domain/itemFactory';
import { expandOccurrences } from '@/domain/recurrence';
import {
  addDays,
  endOfDay,
  formatISODate,
  parseLocalDate,
  startOfDay,
  startOfWeek,
  todayKey,
} from '@/lib/date';
import { useUiStore } from '@/store/useUiStore';
import { DEFAULT_SETTINGS } from '@/types/settings';

const DAYS = 12 * 7;

let habitSeq = 0;

interface Mounted {
  host: HTMLElement;
  root: Root;
  title: string;
}

async function mountHabits(weekStartsOn: 0 | 1 | null): Promise<Mounted> {
  const title = `Stretch ${++habitSeq}`;
  await itemRepo.create(createItem({ kind: 'habit', title, start: todayKey() }));
  if (weekStartsOn === null) {
    await settingsRepo.remove('app');
  } else {
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, weekStartsOn });
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<HabitsView />);
  });
  await waitForSettingApplied(host, weekStartsOn ?? DEFAULT_SETTINGS.weekStartsOn);
  await waitForHeatmap(host, title);
  return { host, root, title };
}

/**
 * The items store is shared across mounts and keeps the last snapshot after the final
 * listener unsubscribes. Wait for the grid labelled with this mount's unique habit so a
 * preceding test's snapshot can never be asserted against.
 */
async function waitForHeatmap(host: HTMLElement, title: string): Promise<HTMLElement> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const grid = host.querySelector<HTMLElement>(
      `[role="img"][aria-label="${title} completion heatmap"]`,
    );
    if (grid?.children.length === DAYS) return grid;
  }
  throw new Error(`heatmap for ${title} never rendered`);
}

/** The setting is read through a Dexie live query, so the render lands asynchronously. */
async function waitForSettingApplied(host: HTMLElement, weekStartsOn: 0 | 1): Promise<void> {
  const expected = weekStartsOn === 0 ? 'Sun' : 'Mon';
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (weekdayHeader(host)[0] === expected) return;
  }
  throw new Error(`habits did not apply weekStartsOn=${weekStartsOn}`);
}

async function unmount({ host, root }: Pick<Mounted, 'host' | 'root'>): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

function weekdayHeader(host: HTMLElement): string[] {
  const header = host.querySelector<HTMLElement>('div.grid-rows-7:not([role])');
  return header ? Array.from(header.children).map((el) => el.textContent ?? '') : [];
}

function heatmapDayKeys(host: HTMLElement): string[] {
  const grid = host.querySelector<HTMLElement>('[role="img"]');
  return grid
    ? Array.from(grid.children).map((el) => (el.getAttribute('title') ?? '').split(':')[0])
    : [];
}

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  useUiStore.getState().closeEditor();
});

afterAll(async () => {
  await db.delete();
});

async function waitForMarkToday(host: HTMLElement, label: string): Promise<HTMLButtonElement> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (button) return button;
  }
  throw new Error(`mark-today never became ${label}`);
}

describe('HabitsView mark today', () => {
  it('exposes aria-pressed and updates after toggling', async () => {
    const mounted = await mountHabits(1);

    const before = await waitForMarkToday(mounted.host, 'Complete today');
    expect(before.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      before.click();
    });

    const after = await waitForMarkToday(mounted.host, 'Undo today');
    expect(after.getAttribute('aria-pressed')).toBe('true');
    await unmount(mounted);
  });
});

describe('HabitsView empty heatmap cells', () => {
  it('uses a token that differs from the card surface for empty cells', async () => {
    const mounted = await mountHabits(1);
    const grid = mounted.host.querySelector<HTMLElement>(
      `[role="img"][aria-label="${mounted.title} completion heatmap"]`,
    );
    expect(grid).not.toBeNull();
    const emptyCells = Array.from(grid!.children).filter((el) =>
      (el.getAttribute('title') ?? '').endsWith(': 0'),
    );
    expect(emptyCells).toHaveLength(DAYS);
    for (const cell of emptyCells) {
      expect(cell.classList.contains('bg-border')).toBe(true);
      expect(cell.classList.contains('bg-surface')).toBe(false);
      expect(cell.classList.contains('bg-elevated')).toBe(false);
    }
    await unmount(mounted);
  });
});

function heatmapTable(host: HTMLElement): HTMLTableElement | null {
  return host.querySelector('table');
}

describe('HabitsView heatmap legend and text summary', () => {
  it('renders a visible less-to-more legend matching the grid shades', async () => {
    const mounted = await mountHabits(1);
    const legend = Array.from(mounted.host.querySelectorAll('div')).find(
      (el) => el.textContent?.includes('Less') && el.textContent?.includes('More'),
    );
    expect(legend).toBeDefined();
    expect(legend!.textContent).toContain('Less');
    expect(legend!.textContent).toContain('More');

    const swatches = legend!.querySelectorAll('span[class*="h-3.5"]');
    expect(swatches).toHaveLength(5);
    expect(swatches[0].classList.contains('bg-border')).toBe(true);
    expect(swatches[4].className).toContain('bg-emerald-600');
    await unmount(mounted);
  });

  it('exposes every day as text in an accessible table', async () => {
    const mounted = await mountHabits(1);
    const table = heatmapTable(mounted.host);
    expect(table).not.toBeNull();
    // The wrapper, not the table, is the clipped 1px box: `sr-only` on the table itself would
    // still let its min-content width push the document scroll width past the viewport.
    const wrapper = table!.parentElement;
    expect(wrapper?.className).toContain('sr-only');
    expect(wrapper?.className).toContain('overflow-hidden');
    expect(table!.querySelector('caption')?.textContent).toContain('Stretch');

    expect(table!.querySelectorAll('thead th')).toHaveLength(DAYS / 7 + 1);
    const rows = table!.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(7);
    expect(Array.from(rows).map((row) => row.querySelector('th')?.textContent)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);

    const cells = Array.from(table!.querySelectorAll('tbody td'));
    expect(cells).toHaveLength(DAYS);
    expect(cells.every((cell) => cell.textContent === '0')).toBe(true);
    await unmount(mounted);
  });

  it('reports completed occurrences in the table, not just as colour', async () => {
    const mounted = await mountHabits(1);
    const complete = await waitForMarkToday(mounted.host, 'Complete today');
    await act(async () => {
      complete.click();
    });

    let ones = 0;
    for (let attempt = 0; attempt < 200; attempt++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
      const cells = Array.from(mounted.host.querySelectorAll('table tbody td'));
      ones = cells.filter((cell) => cell.textContent === '1').length;
      if (ones === 1) break;
    }
    expect(ones).toBe(1);
    await unmount(mounted);
  });
});

describe('HabitsView weekStartsOn', () => {
  it('renders a Sunday-first heatmap when weekStartsOn is 0', async () => {
    const mounted = await mountHabits(0);
    expect(weekdayHeader(mounted.host)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    const days = heatmapDayKeys(mounted.host);
    expect(days).toHaveLength(DAYS);
    expect(parseLocalDate(days[0])!.getDay()).toBe(0);
    await unmount(mounted);
  });

  it('renders a Monday-first heatmap when weekStartsOn is 1', async () => {
    const mounted = await mountHabits(1);
    expect(weekdayHeader(mounted.host)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    const days = heatmapDayKeys(mounted.host);
    expect(days).toHaveLength(DAYS);
    expect(parseLocalDate(days[0])!.getDay()).toBe(1);
    await unmount(mounted);
  });

  it('falls back to Monday when no setting is stored', async () => {
    const mounted = await mountHabits(null);
    expect(weekdayHeader(mounted.host)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(parseLocalDate(heatmapDayKeys(mounted.host)[0])!.getDay()).toBe(1);
    await unmount(mounted);
  });

  it('creates a new habit that expands daily for the coming week', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<HabitsView />);
    });

    const button = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('New habit'),
    );
    expect(button).toBeDefined();
    await act(async () => {
      button!.click();
    });

    const draft = useUiStore.getState().editor.item;
    expect(draft?.kind).toBe('habit');
    expect(draft?.recurrence?.freq).toBe('daily');
    const occurrences = expandOccurrences(
      draft!,
      startOfDay(new Date()),
      endOfDay(addDays(new Date(), 6)),
    );
    expect(occurrences).toHaveLength(7);

    await unmount({ host, root });
  });

  it('anchors the window start to the configured week start for both settings', async () => {
    for (const weekStartsOn of [0, 1] as const) {
      const mounted = await mountHabits(weekStartsOn);
      const days = heatmapDayKeys(mounted.host);
      const expectedStart = startOfWeek(addDays(new Date(), -(DAYS - 1)), weekStartsOn);
      expect(days[0]).toBe(formatISODate(expectedStart));
      expect(days[DAYS - 1] <= todayKey()).toBe(true);
      await unmount(mounted);
    }
  });
});
