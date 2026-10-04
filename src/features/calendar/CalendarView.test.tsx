// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DndContext } from '@dnd-kit/core';
import { CalendarView } from './CalendarView';
import { settingsRepo } from '@/db/repository';
import { formatISODate, parseLocalDate, startOfWeek } from '@/lib/date';
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
