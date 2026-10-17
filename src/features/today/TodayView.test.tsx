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
    occurrences:
      status === 'done' ? { [key]: { status: 'done', completedAt: Date.now() } } : {},
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
