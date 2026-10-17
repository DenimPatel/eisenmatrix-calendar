// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HabitsView } from './habits/HabitsView';
import { GoalsView } from './goals/GoalsView';
import { BillsView } from './bills/BillsView';
import { ShoppingView } from './shopping/ShoppingView';
import { NotesView } from './notes/NotesView';
import { TodayView } from './today/TodayView';
import { db } from '@/db/schema';
import { createItem } from '@/domain/itemFactory';
import { todayKey } from '@/lib/date';
import { useUiStore } from '@/store/useUiStore';
import { ITEM_KINDS, type Item } from '@/types';

function rawItem(kind: Item['kind']): Item {
  const { data: _data, ...raw } = createItem({ kind, title: `Raw ${kind}`, start: todayKey() });
  return raw as Item;
}

async function seedRawRows(): Promise<void> {
  await db.items.bulkPut(ITEM_KINDS.map(rawItem));
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

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  useUiStore.getState().closeEditor();
});

afterAll(async () => {
  await db.delete();
});

const VIEWS = [
  { name: 'habits', title: 'Raw habit', render: () => <HabitsView /> },
  { name: 'goals', title: 'Raw goal', render: () => <GoalsView /> },
  { name: 'bills', title: 'Raw bill', render: () => <BillsView /> },
  { name: 'shopping', title: 'Raw shopping', render: () => <ShoppingView /> },
  { name: 'notes', title: 'Raw note', render: () => <NotesView /> },
  { name: 'today', title: 'Raw task', render: () => <TodayView /> },
];

describe('views with raw no-data rows', () => {
  it.each(VIEWS)('renders $name without throwing', async ({ title, render }) => {
    await seedRawRows();
    const mounted = await mount(render());

    await waitForText(mounted.host, title);
    expect(mounted.host.textContent).toContain(title);
    if (title === 'Raw task') expect(mounted.host.textContent).toContain('Raw event');

    await mounted.unmount();
  });
});
