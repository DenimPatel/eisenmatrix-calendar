// @vitest-environment jsdom
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { GoalsView } from './GoalsView';
import { db } from '@/db/schema';
import { createItem } from '@/domain/itemFactory';
import { useUiStore } from '@/store/useUiStore';
import type { GoalItem } from '@/types';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function goal(title: string, current: number, target: number): GoalItem {
  const item = createItem({ kind: 'goal', title });
  if (item.kind !== 'goal') throw new Error('expected a goal');
  item.data = { metric: { type: 'numeric', current, target }, horizon: 'month' };
  return item;
}

async function mount(element: React.ReactElement) {
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

async function waitForText(host: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (host.textContent?.includes(text)) return;
  }
  throw new Error(`view never rendered "${text}"`);
}

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  useUiStore.getState().closeEditor();
});

afterEach(() => {
  document.body.innerHTML = '';
});

afterAll(async () => {
  await db.delete();
});

describe('GoalsView progress semantics', () => {
  it('exposes each goal ring as a named progressbar with its value', async () => {
    await db.items.bulkPut([goal('Ship v1', 3, 4)]);
    const mounted = await mount(<GoalsView />);

    await waitForText(mounted.host, '3/4');

    const bar = mounted.host.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute('aria-valuenow')).toBe('75');
    expect(bar!.getAttribute('aria-label')).toBe('Ship v1 progress: 75%');

    await mounted.unmount();
  });
});
