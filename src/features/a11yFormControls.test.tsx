// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ItemEditorSheet } from './item/ItemEditorSheet';
import { SettingsView } from './settings/SettingsView';
import { QuickAdd } from './quickadd/QuickAdd';
import { CommandPalette } from './command/CommandPalette';
import { NotesView } from './notes/NotesView';
import { ShoppingView } from './shopping/ShoppingView';
import { ListView } from './list/ListView';
import { db } from '@/db/schema';
import { useUiStore } from '@/store/useUiStore';
import { createItem } from '@/domain/itemFactory';
import type { Item } from '@/types';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The `label` rule of axe, reduced to a queryable check: every form control must resolve to
 * an accessible name. This mirrors the accessible-name computation for the subset of
 * mechanisms the app uses (aria-label, aria-labelledby, a sibling `label[for]`, a wrapping
 * `label`, then `title`), which is what `getByLabelText` matches on.
 */
const CONTROLS = 'input:not([type="hidden"]), select, textarea';

/** A label's own text, ignoring controls nested inside it (accname "name from content"). */
function labelText(label: Element): string {
  const clone = label.cloneNode(true) as Element;
  clone.querySelectorAll('input, select, textarea, button').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function accessibleName(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id))
      .filter((node): node is HTMLElement => node !== null)
      .map((node) => labelText(node))
      .join(' ')
      .trim();
    if (text) return text;
  }

  if (el.id) {
    const escaped = el.id.replace(/["\\]/g, '\\$&');
    const forLabel = el.ownerDocument.querySelector(`label[for="${escaped}"]`);
    if (forLabel) return labelText(forLabel);
  }

  const wrapping = el.closest('label');
  if (wrapping) return labelText(wrapping);

  return el.getAttribute('title')?.trim() ?? '';
}

/** testing-library's `getByLabelText`, reduced to the single-match lookup this suite needs. */
function getByLabelText(host: HTMLElement, text: string): Element {
  const matches = Array.from(host.querySelectorAll(CONTROLS)).filter(
    (el) => accessibleName(el) === text,
  );
  if (matches.length !== 1) {
    throw new Error(
      `getByLabelText(${JSON.stringify(text)}) matched ${matches.length} controls, expected 1`,
    );
  }
  return matches[0];
}

/** Controls axe's `label` rule would flag: no accessible name at all. */
function unnamedControls(host: HTMLElement): Element[] {
  return Array.from(host.querySelectorAll(CONTROLS)).filter((el) => accessibleName(el) === '');
}

async function flush(turns = 4): Promise<void> {
  for (let turn = 0; turn < turns; turn++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

interface Mounted {
  host: HTMLElement;
  unmount: () => Promise<void>;
}

async function mount(node: ReactNode): Promise<Mounted> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  await flush();
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

async function setInputValue(el: Element, value: string): Promise<void> {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickTab(host: HTMLElement, label: string): Promise<void> {
  const tab = Array.from(host.querySelectorAll('button[role="tab"]')).find(
    (el) => el.textContent === label,
  );
  expect(tab, `tab "${label}"`).toBeDefined();
  await act(async () => {
    (tab as HTMLButtonElement).click();
  });
}

function editorItem(): Item {
  const item = createItem({
    kind: 'task',
    title: 'Standup',
    start: '2026-07-13T09:00',
    end: '2026-07-13T09:30',
    allDay: false,
  });
  item.dueAt = '2026-07-13T09:00';
  item.checklist = [{ id: 'c1', text: 'Prepare notes', done: false }];
  item.reminders = [{ id: 'r1', offsetMinutes: -10 }];
  item.recurrence = {
    freq: 'weekly',
    interval: 1,
    weekStartsOn: 1,
    byWeekday: [1],
    exceptions: [],
    overrides: {},
  };
  return item;
}

beforeEach(async () => {
  await db.items.clear();
  await db.lists.clear();
  useUiStore.setState({
    editor: { open: false, item: null, occurrenceKey: null, splitMode: 'all' },
    quickAddOpen: false,
    commandOpen: false,
    toasts: [],
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

afterAll(async () => {
  await db.delete();
});

describe('accessible names for form controls', () => {
  it('names every control in the item editor', async () => {
    useUiStore.setState({
      editor: { open: true, item: editorItem(), occurrenceKey: null, splitMode: 'all' },
    });
    const { host, unmount } = await mount(<ItemEditorSheet />);

    expect(unnamedControls(host)).toEqual([]);
    for (const label of ['Title', 'Notes', 'Status', 'Urgency', 'Importance', 'List']) {
      expect(() => getByLabelText(host, label)).not.toThrow();
    }
    getByLabelText(host, 'Add tag');
    getByLabelText(host, 'Add subtask');
    getByLabelText(host, 'Add checklist item');

    await clickTab(host, 'Schedule');
    expect(unnamedControls(host)).toEqual([]);
    for (const label of ['Start date', 'Start time', 'Due', 'End']) {
      getByLabelText(host, label);
    }
    for (const label of ['Every', 'Frequency', 'Ends']) {
      expect(() => getByLabelText(host, label)).not.toThrow();
    }
    getByLabelText(host, 'Reminder offset');

    await unmount();
  });

  it('names the kind-specific fields for other item kinds', async () => {
    const bill = createItem({ kind: 'bill', title: 'Electricity', start: '2026-07-01' });
    useUiStore.setState({
      editor: { open: true, item: bill, occurrenceKey: null, splitMode: 'all' },
    });
    const { host, unmount } = await mount(<ItemEditorSheet />);

    expect(unnamedControls(host)).toEqual([]);
    for (const label of ['Amount', 'Currency', 'Payee', 'Account']) {
      expect(() => getByLabelText(host, label)).not.toThrow();
    }

    await unmount();
  });

  it('names every control in settings', async () => {
    const { host, unmount } = await mount(<SettingsView />);

    expect(unnamedControls(host)).toEqual([]);
    getByLabelText(host, 'Week starts on');
    getByLabelText(host, 'On import conflict');
    getByLabelText(host, 'Daily digest time');

    await unmount();
  });

  it('names every control in quick add', async () => {
    useUiStore.setState({ quickAddOpen: true });
    const { host, unmount } = await mount(<QuickAdd />);

    getByLabelText(host, 'Quick add');
    await setInputValue(host.querySelector('input')!, 'buy milk 2L #groceries');

    expect(unnamedControls(host)).toEqual([]);
    for (const label of ['Kind', 'Date', 'Time']) {
      expect(() => getByLabelText(host, label)).not.toThrow();
    }

    await unmount();
  });

  it('names the command palette search box', async () => {
    useUiStore.setState({ commandOpen: true });
    const { host, unmount } = await mount(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );

    expect(unnamedControls(host)).toEqual([]);
    getByLabelText(host, 'Search commands');

    await unmount();
  });

  it('names the notes, shopping and list capture controls', async () => {
    const notes = await mount(<NotesView />);
    expect(unnamedControls(notes.host)).toEqual([]);
    getByLabelText(notes.host, 'New note');
    await notes.unmount();

    const shopping = await mount(<ShoppingView />);
    expect(unnamedControls(shopping.host)).toEqual([]);
    getByLabelText(shopping.host, 'Add shopping item');
    getByLabelText(shopping.host, 'Filter by list');
    await shopping.unmount();

    const list = await mount(<ListView />);
    expect(unnamedControls(list.host)).toEqual([]);
    getByLabelText(list.host, 'Search items');
    getByLabelText(list.host, 'New list name');
    getByLabelText(list.host, 'Filter by kind');
    getByLabelText(list.host, 'Filter by status');
    await list.unmount();
  });
});
