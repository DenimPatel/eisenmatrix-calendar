// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TodayView } from './TodayView';
import { db } from '@/db/schema';
import { createItem } from '@/domain/itemFactory';
import { todayKey } from '@/lib/date';
import { useUiStore } from '@/store/useUiStore';
import type { Item, ItemStatus } from '@/types';

function habit(title: string, status: ItemStatus = 'todo'): Item {
  const key = todayKey();
  return {
    ...createItem({ kind: 'habit', title, start: key }),
    occurrences: status === 'done' ? { [key]: { status: 'done', completedAt: Date.now() } } : {},
  };
}

async function waitForText(host: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (host.textContent?.includes(text)) return;
  }
  throw new Error(`view never rendered "${text}"`);
}

async function waitForHabitToggle(host: HTMLElement, label: string): Promise<HTMLButtonElement> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (button) return button;
  }
  throw new Error(`habit toggle never became ${label}`);
}

async function mount(
  element: React.ReactElement,
): Promise<{ host: HTMLElement; unmount: () => Promise<void> }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
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

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function agendaHeading(host: HTMLElement): HTMLElement | undefined {
  return Array.from(host.querySelectorAll('h2')).find((heading) =>
    heading.textContent?.startsWith("Today's agenda"),
  );
}

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  useUiStore.getState().closeEditor();
});

afterAll(async () => {
  await db.delete();
});

describe('TodayView habit rendering', () => {
  it('renders a daily habit only in the Habits panel and counts only agenda items', async () => {
    await db.items.bulkPut([
      createItem({ kind: 'task', title: 'Write report', start: todayKey() }),
      habit('Journal'),
    ]);
    const mounted = await mount(<TodayView />);

    await waitForText(mounted.host, '0/1 done');

    const text = mounted.host.textContent ?? '';
    expect(countOccurrences(text, 'Journal')).toBe(1);
    expect(text).toContain('0/1 done');
    expect(agendaHeading(mounted.host)?.textContent).toBe("Today's agenda1");

    await mounted.unmount();
  });

  it('excludes a completed habit from the agenda label and ring count', async () => {
    await db.items.bulkPut([
      createItem({ kind: 'task', title: 'Done task', start: todayKey(), status: 'done' }),
      createItem({ kind: 'task', title: 'Open task', start: todayKey() }),
      habit('Journal', 'done'),
    ]);
    const mounted = await mount(<TodayView />);

    await waitForText(mounted.host, '1/2 done');

    const text = mounted.host.textContent ?? '';
    expect(countOccurrences(text, 'Journal')).toBe(1);
    expect(text).toContain('1/2 done');
    expect(text).toContain('✓');
    expect(agendaHeading(mounted.host)?.textContent).toBe("Today's agenda2");

    await mounted.unmount();
  });
});

describe('TodayView habit completion', () => {
  it('toggles the habit ring and updates the streak in place', async () => {
    await db.items.bulkPut([habit('Journal')]);
    const mounted = await mount(<TodayView />);

    const before = await waitForHabitToggle(mounted.host, 'Complete Journal for today');
    expect(before.getAttribute('aria-pressed')).toBe('false');
    expect(before.classList.contains('h-11')).toBe(true);
    expect(before.classList.contains('w-11')).toBe(true);
    expect(mounted.host.textContent).toContain('0 day streak');

    await act(async () => {
      before.click();
    });

    const after = await waitForHabitToggle(mounted.host, 'Undo Journal for today');
    expect(after.getAttribute('aria-pressed')).toBe('true');
    expect(mounted.host.textContent).toContain('✓');
    expect(mounted.host.textContent).toContain('1 day streak');

    const stored = (await db.items.toArray())[0];
    expect(stored.occurrences?.[todayKey()]?.status).toBe('done');

    await mounted.unmount();
  });

  it('reverts the ring when a completed habit is toggled off', async () => {
    await db.items.bulkPut([habit('Journal', 'done')]);
    const mounted = await mount(<TodayView />);

    const before = await waitForHabitToggle(mounted.host, 'Undo Journal for today');
    expect(before.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      before.click();
    });

    const after = await waitForHabitToggle(mounted.host, 'Complete Journal for today');
    expect(after.getAttribute('aria-pressed')).toBe('false');
    expect(mounted.host.textContent).not.toContain('✓');

    await mounted.unmount();
  });
});
