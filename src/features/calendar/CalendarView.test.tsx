// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DndContext } from '@dnd-kit/core';
import { CalendarView } from './CalendarView';
import { itemRepo, settingsRepo } from '@/db/repository';
import { createItem } from '@/domain/itemFactory';
import { formatISODate, parseLocalDate, startOfWeek, todayKey } from '@/lib/date';
import { DEFAULT_SETTINGS } from '@/types/settings';

interface Mounted {
  host: HTMLElement;
  root: Root;
}

async function mountCalendar(weekStartsOn: 0 | 1 | null): Promise<Mounted> {
  if (weekStartsOn === null) {
    await settingsRepo.remove('app');
  } else {
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, weekStartsOn });
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <DndContext>
        <CalendarView />
      </DndContext>,
    );
  });
  await waitForSettingApplied(host, weekStartsOn ?? DEFAULT_SETTINGS.weekStartsOn);
  return { host, root };
}

/** The setting is read through a Dexie live query, so the render lands asynchronously. */
async function waitForSettingApplied(host: HTMLElement, weekStartsOn: 0 | 1): Promise<void> {
  const expected = weekStartsOn === 0 ? 'Sun' : 'Mon';
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (headerLabels(host)[0] === expected) return;
  }
  throw new Error(`calendar did not apply weekStartsOn=${weekStartsOn}`);
}

async function unmount({ host, root }: Mounted): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

async function switchMode(host: HTMLElement, mode: string): Promise<void> {
  const button = Array.from(host.querySelectorAll('button')).find((el) => el.textContent === mode);
  expect(button).toBeDefined();
  await act(async () => {
    button!.click();
  });
}

function headerLabels(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('div'))
    .filter(
      (el) =>
        el.children.length === 0 && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/.test(el.textContent ?? ''),
    )
    .map((el) => el.textContent ?? '');
}

function firstDayKey(host: HTMLElement): string {
  const add = host.querySelector<HTMLElement>('[aria-label^="Add item on "]');
  expect(add).not.toBeNull();
  return add!.getAttribute('aria-label')!.replace('Add item on ', '');
}

describe('CalendarView weekStartsOn', () => {
  it('renders a Sunday-first month grid when weekStartsOn is 0', async () => {
    const mounted = await mountCalendar(0);
    expect(headerLabels(mounted.host)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(parseLocalDate(firstDayKey(mounted.host))!.getDay()).toBe(0);
    await unmount(mounted);
  });

  it('renders a Monday-first month grid when weekStartsOn is 1', async () => {
    const mounted = await mountCalendar(1);
    expect(headerLabels(mounted.host)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(parseLocalDate(firstDayKey(mounted.host))!.getDay()).toBe(1);
    await unmount(mounted);
  });

  it('falls back to Monday when no setting is stored', async () => {
    const mounted = await mountCalendar(null);
    expect(headerLabels(mounted.host)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(parseLocalDate(firstDayKey(mounted.host))!.getDay()).toBe(1);
    await unmount(mounted);
  });

  it('aligns the week view interval to the configured week start', async () => {
    for (const weekStartsOn of [0, 1] as const) {
      const mounted = await mountCalendar(weekStartsOn);
      await switchMode(mounted.host, 'week');
      expect(firstDayKey(mounted.host)).toBe(formatISODate(startOfWeek(new Date(), weekStartsOn)));
      expect(parseLocalDate(firstDayKey(mounted.host))!.getDay()).toBe(weekStartsOn);
      await unmount(mounted);
    }
  });
});

async function seedTasksOnToday(count: number): Promise<string[]> {
  const titles = Array.from({ length: count }, (_, index) => `Overflow item ${index + 1}`);
  await itemRepo.replaceAll(
    titles.map((title) => createItem({ kind: 'task', title, start: todayKey() })),
  );
  return titles;
}

function moreControl(host: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find((el) =>
    /^\+\d+ more$/.test(el.textContent?.trim() ?? ''),
  );
}

function visibleTitles(host: HTMLElement, titles: string[]): string[] {
  const text = host.textContent ?? '';
  return titles.filter((title) => text.includes(title));
}

async function waitForOccurrences(host: HTMLElement, titles: string[]): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (visibleTitles(host, titles).length >= Math.min(3, titles.length)) return;
  }
  throw new Error('calendar did not render the seeded items');
}

describe('CalendarView overflow affordance', () => {
  beforeEach(async () => {
    await itemRepo.replaceAll([]);
  });

  it('caps a month day at 3 and reveals all 6 titles from +3 more', async () => {
    const titles = await seedTasksOnToday(6);
    const mounted = await mountCalendar(1);
    await waitForOccurrences(mounted.host, titles);

    const control = moreControl(mounted.host);
    expect(control).toBeDefined();
    expect(control!.textContent).toBe('+3 more');
    expect(visibleTitles(mounted.host, titles)).toHaveLength(3);

    await act(async () => {
      control!.click();
    });
    expect(visibleTitles(mounted.host, titles)).toHaveLength(6);
    await unmount(mounted);
  });

  it('collapses back to the capped list on a second activation', async () => {
    const titles = await seedTasksOnToday(6);
    const mounted = await mountCalendar(1);
    await waitForOccurrences(mounted.host, titles);

    await act(async () => {
      moreControl(mounted.host)!.click();
    });
    const collapse = moreControl(mounted.host);
    expect(collapse).toBeUndefined();
    expect(visibleTitles(mounted.host, titles)).toHaveLength(6);

    const showLess = Array.from(mounted.host.querySelectorAll('button')).find(
      (el) => el.textContent?.trim() === 'Show less',
    );
    expect(showLess).toBeDefined();
    await act(async () => {
      showLess!.click();
    });
    expect(visibleTitles(mounted.host, titles)).toHaveLength(3);
    expect(moreControl(mounted.host)?.textContent).toBe('+3 more');
    await unmount(mounted);
  });

  it('keeps the default rendering free of a control at 3 or fewer items', async () => {
    const titles = await seedTasksOnToday(3);
    const mounted = await mountCalendar(1);
    await waitForOccurrences(mounted.host, titles);

    expect(moreControl(mounted.host)).toBeUndefined();
    expect(visibleTitles(mounted.host, titles)).toHaveLength(3);
    await unmount(mounted);
  });

  it('caps a year card at 5 and reveals all 6 titles from +1 more', async () => {
    const titles = await seedTasksOnToday(6);
    const mounted = await mountCalendar(1);
    await waitForOccurrences(mounted.host, titles);
    await switchMode(mounted.host, 'year');
    await waitForOccurrences(mounted.host, titles);

    const control = moreControl(mounted.host);
    expect(control).toBeDefined();
    expect(control!.textContent).toBe('+1 more');
    expect(visibleTitles(mounted.host, titles)).toHaveLength(5);

    await act(async () => {
      control!.click();
    });
    expect(visibleTitles(mounted.host, titles)).toHaveLength(6);
    await unmount(mounted);
  });

  it('keeps the default year card free of a control at 5 or fewer items', async () => {
    const titles = await seedTasksOnToday(5);
    const mounted = await mountCalendar(1);
    await waitForOccurrences(mounted.host, titles);
    await switchMode(mounted.host, 'year');
    await waitForOccurrences(mounted.host, titles);

    expect(moreControl(mounted.host)).toBeUndefined();
    expect(visibleTitles(mounted.host, titles)).toHaveLength(5);
    await unmount(mounted);
  });
});
