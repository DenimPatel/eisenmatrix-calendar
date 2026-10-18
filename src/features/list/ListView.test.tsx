// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ListView } from './ListView';
import { db } from '@/db/schema';
import { itemRepo } from '@/db/repository';
import { createItem } from '@/domain/itemFactory';
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

/** Items arrive through a Dexie live query, so the first body row lands asynchronously. */
async function waitForRow(host: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (bodyRows(host).some((row) => row.textContent?.includes(text))) return;
  }
  throw new Error(`row containing "${text}" did not render`);
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

function gridTokens(el: Element): string[] {
  const tokens = Array.from(el.classList)
    .map((c) => c.match(/^((?:[a-z-]+:)*)grid-cols-\[(.+)\]$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => `${m[1]}${m[2]}`);
  expect(tokens.length, `expected responsive grid-cols tokens on ${el.className}`).toBeGreaterThan(
    0,
  );
  return tokens;
}

function bodyRows(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>('[role="row"]')).filter((row) =>
    row.querySelector('[role="cell"]'),
  );
}

describe('ListView status/date columns', () => {
  it('gives the status pill and the date their own matching tracks', async () => {
    await itemRepo.create(
      createItem({ kind: 'task', title: 'Ship the release', status: 'doing', start: '2026-10-18' }),
    );

    const mounted = await mountList();
    await waitForRow(mounted.host, 'Ship the release');
    const header = mounted.host.querySelector<HTMLElement>('[role="rowgroup"] [role="row"]')!;
    const rows = bodyRows(mounted.host);
    expect(rows.length).toBeGreaterThan(0);

    const headers = Array.from(header.querySelectorAll('[role="columnheader"]'));
    expect(headers.map((h) => h.textContent?.trim())).toEqual([
      '',
      'Item',
      'List',
      'Priority',
      'Status',
      'Date',
    ]);

    const cells = Array.from(rows[0].querySelectorAll<HTMLElement>('[role="cell"]'));
    expect(cells).toHaveLength(headers.length);
    expect(gridTokens(header)).toEqual(gridTokens(rows[0]));

    const statusCell = cells.find((c) => c.textContent?.includes('In Progress'));
    const dateCell = cells.find((c) => c.textContent?.includes('2026-10-18'));
    expect(statusCell).toBeDefined();
    expect(dateCell).toBeDefined();
    expect(statusCell).not.toBe(dateCell);
    expect(statusCell!.querySelector('span')?.className).toContain('whitespace-nowrap');
    expect(dateCell!.className).toContain('whitespace-nowrap');

    await unmount(mounted);
  });
});
