// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ItemEditorSheet } from './ItemEditorSheet';
import { db } from '@/db/schema';
import { useUiStore } from '@/store/useUiStore';
import { createItem } from '@/domain/itemFactory';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountEditor() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<ItemEditorSheet />);
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
  useUiStore.setState({
    editor: { open: false, item: null, occurrenceKey: null, splitMode: 'all' },
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

afterAll(async () => {
  await db.delete();
});

describe('ItemEditorSheet', () => {
  it('focuses the title input on open', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    useUiStore.getState().openEditor(createItem({ kind: 'task', title: 'Buy milk' }));
    const mounted = await mountEditor();

    const titleInput = mounted.host.querySelector('input.input');
    expect(titleInput).not.toBeNull();
    expect((titleInput as HTMLInputElement).value).toBe('Buy milk');
    expect(document.activeElement).toBe(titleInput);
    expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Close panel');

    await mounted.unmount();
    opener.remove();
  });

  it('returns focus to the opener on close', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    useUiStore.getState().openEditor(createItem({ kind: 'task', title: 'Buy milk' }));
    const mounted = await mountEditor();
    expect(document.activeElement).toBe(mounted.host.querySelector('input.input'));

    await act(async () => {
      useUiStore.getState().closeEditor();
    });
    expect(document.activeElement).toBe(opener);

    await mounted.unmount();
    opener.remove();
  });
});
