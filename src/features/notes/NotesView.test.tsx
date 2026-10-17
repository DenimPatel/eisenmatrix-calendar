// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NotesView } from './NotesView';
import { db } from '@/db/schema';
import { itemRepo } from '@/db/repository';
import { useUiStore } from '@/store/useUiStore';
import { NOTE_TITLE_MAX } from '@/domain/quickadd';
import { createItem } from '@/domain/itemFactory';
import type { Item } from '@/types';

interface Mounted {
  host: HTMLElement;
  root: Root;
}

async function mountNotes(): Promise<Mounted> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<NotesView />);
  });
  return { host, root };
}

async function unmount({ host, root }: Mounted): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

async function type(host: HTMLElement, text: string): Promise<void> {
  const textarea = host.querySelector('textarea');
  expect(textarea).not.toBeNull();
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(textarea, text);
    textarea!.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function addNote(host: HTMLElement): Promise<void> {
  const button = Array.from(host.querySelectorAll('button')).find((el) =>
    el.textContent?.includes('Add note'),
  );
  expect(button).toBeDefined();
  await act(async () => {
    button!.click();
  });
}

/** The item is written through Dexie, so the write lands asynchronously. */
async function waitForNote(): Promise<Item> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const note = (await itemRepo.all()).find((i) => i.kind === 'note');
    if (note) return note;
  }
  throw new Error('note was never persisted');
}

beforeEach(async () => {
  await db.items.clear();
  useUiStore.setState({ toasts: [], undoStack: [] });
});

afterAll(async () => {
  await db.delete();
});

async function waitForPin(host: HTMLElement, pressed: string): Promise<HTMLButtonElement> {
  for (let attempt = 0; attempt < 200; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Toggle pin"]');
    if (button?.getAttribute('aria-pressed') === pressed) return button;
  }
  throw new Error(`pin never became ${pressed}`);
}

describe('NotesView pin toggle', () => {
  it('reflects the current pin state with aria-pressed and updates after toggling', async () => {
    await itemRepo.create(createItem({ kind: 'note', title: 'Pinned thought' }));
    const mounted = await mountNotes();

    const before = await waitForPin(mounted.host, 'false');
    await act(async () => {
      before.click();
    });

    const after = await waitForPin(mounted.host, 'true');
    expect(after).not.toBe(before);
    await unmount(mounted);
  });
});

describe('NotesView quick add', () => {
  it('stores a 200-character single line without dropping characters', async () => {
    const text = 'n'.repeat(200);
    const mounted = await mountNotes();
    await type(mounted.host, text);
    await addNote(mounted.host);

    const note = await waitForNote();
    expect(note.title).toHaveLength(NOTE_TITLE_MAX);
    expect(note.title + note.notes).toBe(text);
    await unmount(mounted);
  });

  it('maps a multi-line draft to title and body', async () => {
    const mounted = await mountNotes();
    await type(mounted.host, 'Groceries\nmilk\neggs');
    await addNote(mounted.host);

    const note = await waitForNote();
    expect(note.title).toBe('Groceries');
    expect(note.notes).toBe('milk\neggs');
    await unmount(mounted);
  });

  it('clears the draft after adding so the note cannot be added twice', async () => {
    const mounted = await mountNotes();
    await type(mounted.host, 'single entry');
    await addNote(mounted.host);
    await waitForNote();

    expect(mounted.host.querySelector('textarea')!.value).toBe('');
    expect(await itemRepo.all()).toHaveLength(1);
    await unmount(mounted);
  });
});
