// @vitest-environment jsdom
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoalsView } from './goals/GoalsView';
import { BillsView } from './bills/BillsView';
import { HabitsView } from './habits/HabitsView';
import { NotesView } from './notes/NotesView';
import { db } from '@/db/schema';
import { useUiStore } from '@/store/useUiStore';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(
  node: ReactNode,
): Promise<{ host: HTMLElement; unmount: () => Promise<void> }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  for (let turn = 0; turn < 8; turn++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
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

function headerOf(host: HTMLElement): HTMLElement {
  const h1 = host.querySelector('h1');
  expect(h1, 'view heading').not.toBeNull();
  const header = h1!.parentElement?.parentElement;
  expect(header, 'header container').not.toBeNull();
  return header as HTMLElement;
}

function cta(host: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button')).find((el) =>
    el.textContent?.trim().includes(label),
  );
  expect(button, `CTA "${label}"`).toBeDefined();
  return button as HTMLButtonElement;
}

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  useUiStore.setState({ toasts: [], undoStack: [] });
});

afterEach(() => {
  document.body.innerHTML = '';
});

afterAll(async () => {
  await db.delete();
});

describe('header CTA guards at narrow widths', () => {
  const views: Array<{ name: string; node: ReactNode; label: string }> = [
    { name: 'Goals', node: <GoalsView />, label: 'New goal' },
    { name: 'Bills', node: <BillsView />, label: 'New bill' },
    { name: 'Habits', node: <HabitsView />, label: 'New habit' },
    { name: 'Notes', node: <NotesView />, label: 'Add note' },
  ];

  for (const view of views) {
    it(`${view.name} header wraps instead of squeezing its CTA`, async () => {
      const mounted = await mount(view.node);

      const header = headerOf(mounted.host);
      expect(header.className).toContain('flex-wrap');
      expect(header.className).toContain('gap-3');

      await mounted.unmount();
    });

    it(`${view.name} CTA keeps its label on one line`, async () => {
      const mounted = await mount(view.node);

      const button = cta(mounted.host, view.label);
      expect(button.className).toContain('whitespace-nowrap');

      await mounted.unmount();
    });
  }
});
