// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ListView } from './ListView';
import { db } from '@/db/schema';
import { useUiStore } from '@/store/useUiStore';

interface Mounted {
  host: HTMLElement;
  root: Root;
}

async function mountList(): Promise<Mounted> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<ListView />);
  });
  return { host, root };
}

async function unmount({ host, root }: Mounted): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

function columnHeader(host: HTMLElement, label: string): HTMLElement {
  const header = Array.from(host.querySelectorAll<HTMLElement>('[role="columnheader"]')).find(
    (el) => el.textContent?.trim() === label,
  );
  expect(header).toBeDefined();
  expect(header!.closest('[role="table"]')).not.toBeNull();
  expect(header!.closest('[role="row"]')).not.toBeNull();
  return header!;
}

function sortState(host: HTMLElement, label: string): string | null {
  return columnHeader(host, label).getAttribute('aria-sort');
}

function sortButton(host: HTMLElement, label: string): HTMLButtonElement {
  const button = columnHeader(host, label).querySelector('button');
  expect(button).not.toBeNull();
  return button as HTMLButtonElement;
}

beforeEach(async () => {
  await db.items.clear();
  await db.lists.clear();
  useUiStore.setState({ toasts: [], undoStack: [] });
});

afterAll(async () => {
  await db.delete();
});

describe('ListView sortable headers', () => {
  it('marks the active columnheader ascending or descending and the others non-sort', async () => {
    const mounted = await mountList();

    expect(sortState(mounted.host, 'Date')).toBe('ascending');
    expect(sortState(mounted.host, 'Item')).toBe('none');
    expect(sortState(mounted.host, 'Priority')).toBe('none');
    expect(sortState(mounted.host, 'List')).toBeNull();

    await act(async () => {
      sortButton(mounted.host, 'Item').click();
    });

    expect(sortState(mounted.host, 'Item')).toBe('ascending');
    expect(sortState(mounted.host, 'Date')).toBe('none');

    await act(async () => {
      sortButton(mounted.host, 'Item').click();
    });

    expect(sortState(mounted.host, 'Item')).toBe('descending');

    await act(async () => {
      sortButton(mounted.host, 'Date').click();
    });

    expect(sortState(mounted.host, 'Date')).toBe('ascending');
    expect(sortState(mounted.host, 'Item')).toBe('none');
    expect(sortState(mounted.host, 'List')).toBeNull();
    await unmount(mounted);
  });
});
