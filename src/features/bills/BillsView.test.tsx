// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BillsView } from './BillsView';
import { db } from '@/db/schema';
import { itemRepo } from '@/db/repository';
import { createItem } from '@/domain/itemFactory';
import { todayKey } from '@/lib/date';
import { useUiStore } from '@/store/useUiStore';

interface Mounted {
  host: HTMLElement;
  root: Root;
}

async function mountBills(): Promise<Mounted> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<BillsView />);
  });
  return { host, root };
}

async function unmount({ host, root }: Mounted): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

async function waitForPaidToggle(host: HTMLElement, label: string): Promise<HTMLButtonElement> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (button) return button;
  }
  throw new Error(`bill toggle never became ${label}`);
}

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  useUiStore.setState({ toasts: [], undoStack: [] });
});

afterAll(async () => {
  await db.delete();
});

describe('BillsView paid toggle', () => {
  it('exposes aria-pressed reflecting the occurrence payment and updates after toggling', async () => {
    await itemRepo.create(
      createItem({
        kind: 'bill',
        title: 'Rent',
        start: todayKey(),
        data: { amount: 100, payee: 'Landlord' },
      }),
    );
    const mounted = await mountBills();

    const before = await waitForPaidToggle(mounted.host, 'Mark paid');
    expect(before.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      before.click();
    });

    const after = await waitForPaidToggle(mounted.host, 'Mark unpaid');
    expect(after.getAttribute('aria-pressed')).toBe('true');
    await unmount(mounted);
  });
});
