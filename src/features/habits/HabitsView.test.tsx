// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HabitsView } from './HabitsView';
import { db } from '@/db/schema';
import { itemRepo, settingsRepo } from '@/db/repository';
import { createItem } from '@/domain/itemFactory';
import { addDays, formatISODate, parseLocalDate, startOfWeek, todayKey } from '@/lib/date';
import { DEFAULT_SETTINGS } from '@/types/settings';

const DAYS = 12 * 7;

interface Mounted {
  host: HTMLElement;
  root: Root;
}

async function mountHabits(weekStartsOn: 0 | 1 | null): Promise<Mounted> {
  await itemRepo.create(createItem({ kind: 'habit', title: 'Stretch', start: todayKey() }));
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
  return { host, root };
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

async function unmount({ host, root }: Mounted): Promise<void> {
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
});

afterAll(async () => {
  await db.delete();
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
