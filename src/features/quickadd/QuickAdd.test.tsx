// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuickAdd } from './QuickAdd';
import { db } from '@/db/schema';
import { useUiStore } from '@/store/useUiStore';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountQuickAdd() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<QuickAdd />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
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
  await db.lists.clear();
  useUiStore.setState({ quickAddOpen: false, commandOpen: false });
});

afterEach(() => {
  document.body.innerHTML = '';
});

afterAll(async () => {
  await db.delete();
});

describe('QuickAdd', () => {
  it('focuses the quick add textbox on open', async () => {
    useUiStore.setState({ quickAddOpen: true });
    const mounted = await mountQuickAdd();

    const input = mounted.host.querySelector('input');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Close dialog');

    await mounted.unmount();
  });

  it('keeps parsed quantity when the kind is changed and changed back', async () => {
    useUiStore.setState({ quickAddOpen: true });
    const mounted = await mountQuickAdd();

    const input = mounted.host.querySelector('input') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setValue.call(input, 'buy milk 2L #groceries');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const select = mounted.host.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'bill';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      select.value = 'shopping';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const add = Array.from(mounted.host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Add',
    ) as HTMLButtonElement;
    await act(async () => {
      add.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const items = await db.items.toArray();
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.kind).toBe('shopping');
    if (item.kind !== 'shopping') return;
    expect(item.data.quantity).toBe(2);
    expect(item.data.unit).toBe('l');

    await mounted.unmount();
  });

  it('commits a changed kind with its own data and no shopping fields', async () => {
    useUiStore.setState({ quickAddOpen: true });
    const mounted = await mountQuickAdd();

    const input = mounted.host.querySelector('input') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setValue.call(input, 'buy milk 2L #groceries');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const select = mounted.host.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'bill';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const add = Array.from(mounted.host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Add',
    ) as HTMLButtonElement;
    await act(async () => {
      add.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const items = await db.items.toArray();
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.kind).toBe('bill');
    if (item.kind !== 'bill') return;
    expect(item.data).toMatchObject({ amount: 0, currency: 'USD', payee: 'Milk' });
    expect(item.data).not.toHaveProperty('quantity');
    expect(item.data).not.toHaveProperty('unit');

    await mounted.unmount();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    useUiStore.setState({ quickAddOpen: true });
    const mounted = await mountQuickAdd();
    expect(document.activeElement).toBe(mounted.host.querySelector('input'));

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(useUiStore.getState().quickAddOpen).toBe(false);
    expect(document.activeElement).toBe(opener);

    await mounted.unmount();
    opener.remove();
  });

  it('never narrows the time override input below the AM/PM affordance', async () => {
    useUiStore.setState({ quickAddOpen: true });
    const mounted = await mountQuickAdd();

    const input = mounted.host.querySelector('input') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setValue.call(input, 'buy milk');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const time = mounted.host.querySelector<HTMLInputElement>('input[type="time"]');
    expect(time).not.toBeNull();
    // Widths narrower than `w-32` clip the native `12:00 AM` value plus its clock affordance.
    const tooNarrow = [...time!.className.matchAll(/\bw-(\d+)\b/g)].some(
      (match) => Number(match[1]) < 32,
    );
    expect(tooNarrow).toBe(false);

    await mounted.unmount();
  });
});
