// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ShoppingView } from './ShoppingView';
import { db } from '@/db/schema';
import { itemRepo, listRepo } from '@/db/repository';
import { createItem } from '@/domain/itemFactory';
import { useUiStore } from '@/store/useUiStore';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** jsdom has no layout, so `offsetParent` is always null; the focus trap filters on it. */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.isConnected ? this : null;
    },
  });
});

interface Mounted {
  host: HTMLElement;
  root: Root;
}

async function mountShopping(): Promise<Mounted> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<ShoppingView />);
  });
  return { host, root };
}

async function unmount({ host, root }: Mounted): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

/** Data arrives through a Dexie live query, so the first render is empty and fills in later. */
async function waitFor(check: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (check()) return;
  }
  throw new Error(message);
}

async function waitForText(host: HTMLElement, text: string): Promise<void> {
  await waitFor(() => (host.textContent ?? '').includes(text), `text "${text}" did not render`);
}

function buttonByText(host: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

function listFilter(host: HTMLElement): HTMLSelectElement {
  const select = Array.from(host.querySelectorAll('select')).find(
    (el) => el.getAttribute('aria-label') === 'Filter by list',
  );
  expect(select).toBeDefined();
  return select as HTMLSelectElement;
}

function dialogInput(host: HTMLElement): HTMLInputElement {
  const dialog = host.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  const input = dialog!.querySelector('input');
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

async function pressEscape(): Promise<void> {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
}

/** React tracks the input value, so a plain `.value =` assignment is not seen by onChange. */
async function typeInto(input: HTMLInputElement, text: string): Promise<void> {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(async () => {
  await db.items.clear();
  await db.lists.clear();
  useUiStore.setState({ toasts: [], undoStack: [] });
});

afterAll(async () => {
  await db.delete();
});

describe('ShoppingView new list dialog', () => {
  it('opens the app Dialog with a labelled input instead of window.prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');
    const mounted = await mountShopping();

    expect(mounted.host.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      buttonByText(mounted.host, 'List')!.click();
    });

    const dialog = mounted.host.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const input = dialogInput(mounted.host);
    const label = dialog!.querySelector('label');
    expect(label?.textContent?.trim()).toBe('List name');
    expect(label?.getAttribute('for')).toBe(input.id);
    expect(promptSpy).not.toHaveBeenCalled();

    await unmount(mounted);
    promptSpy.mockRestore();
  });

  it('creates the list and selects it when Enter is pressed', async () => {
    const mounted = await mountShopping();
    await waitFor(() => listFilter(mounted.host).value === 'all', 'filter did not render');

    await act(async () => {
      buttonByText(mounted.host, 'List')!.click();
    });
    const input = dialogInput(mounted.host);
    await typeInto(input, 'Hardware');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await waitFor(
      () => mounted.host.querySelector('[role="dialog"]') === null,
      'dialog did not close',
    );

    const lists = await listRepo.all();
    const created = lists.find((l) => l.name === 'Hardware');
    expect(created).toBeDefined();
    expect(created!.kind).toBe('shopping');
    await waitFor(
      () => listFilter(mounted.host).value === created!.id,
      'new list was not selected',
    );

    await unmount(mounted);
  });

  it('is a no-op on Escape: no list is created and the dialog closes', async () => {
    const mounted = await mountShopping();
    await waitFor(() => listFilter(mounted.host).value === 'all', 'filter did not render');

    await act(async () => {
      buttonByText(mounted.host, 'List')!.click();
    });
    const input = dialogInput(mounted.host);
    await typeInto(input, 'Discarded');
    await pressEscape();

    expect(mounted.host.querySelector('[role="dialog"]')).toBeNull();
    expect((await listRepo.all()).some((l) => l.name === 'Discarded')).toBe(false);

    await unmount(mounted);
  });
});

describe('ShoppingView clear purchased undo', () => {
  it('offers Undo after clearing purchased items and restores them', async () => {
    await itemRepo.create(
      createItem({
        kind: 'shopping',
        title: 'Milk',
        data: { quantity: 1, purchased: true },
      }),
    );
    await itemRepo.create(
      createItem({
        kind: 'shopping',
        title: 'Bread',
        data: { quantity: 1, purchased: true },
      }),
    );
    await itemRepo.create(
      createItem({
        kind: 'shopping',
        title: 'Eggs',
        data: { quantity: 1, purchased: false },
      }),
    );

    const mounted = await mountShopping();
    await waitForText(mounted.host, 'Milk');

    await act(async () => {
      buttonByText(mounted.host, 'Clear purchased')!.click();
    });
    await waitFor(
      () => mounted.host.textContent?.includes('Milk') === false,
      'purchased items were not cleared',
    );
    expect((await itemRepo.all()).map((i) => i.title).sort()).toEqual(['Eggs']);

    const toast = useUiStore.getState().toasts.find((t) => t.actionLabel === 'Undo');
    expect(toast).toBeDefined();
    await act(async () => {
      await toast!.onAction?.();
    });

    await waitForText(mounted.host, 'Milk');
    expect((await itemRepo.all()).map((i) => i.title).sort()).toEqual(['Bread', 'Eggs', 'Milk']);

    await unmount(mounted);
  });

  it('leaves data untouched when there is nothing purchased', async () => {
    await itemRepo.create(
      createItem({
        kind: 'shopping',
        title: 'Eggs',
        data: { quantity: 1, purchased: false },
      }),
    );

    const mounted = await mountShopping();
    await waitForText(mounted.host, 'Eggs');

    const clear = buttonByText(mounted.host, 'Clear purchased');
    expect(clear?.disabled).toBe(true);
    expect(useUiStore.getState().toasts).toEqual([]);

    await unmount(mounted);
  });
});
