// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemEditorSheet } from './ItemEditorSheet';
import { db } from '@/db/schema';
import { itemRepo } from '@/db/repository';
import { useUiStore } from '@/store/useUiStore';
import { createItem } from '@/domain/itemFactory';
import { expandOccurrences, resolveOccurrenceStatus } from '@/domain/recurrence';
import { itemCompletionStats } from '@/domain/stats';
import { hasTimeComponent, parseLocalDate } from '@/lib/date';
import type { Item } from '@/types';

vi.mock('@/domain/recurrence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/recurrence')>();
  return { ...actual, expandOccurrences: vi.fn(actual.expandOccurrences) };
});

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

function recurringItem(): Item {
  const item = createItem({
    kind: 'task',
    title: 'Standup',
    start: '2026-07-13T09:00',
    allDay: false,
  });
  item.recurrence = {
    freq: 'weekly',
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
  };
  return item;
}

function allDaySeries(): Item {
  const item = createItem({
    kind: 'event',
    title: 'Conference',
    start: '2026-07-13',
    end: '2026-07-13',
    allDay: true,
  });
  item.recurrence = {
    freq: 'daily',
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
  };
  return item;
}

function dailyTimedSeries(): Item {
  const item = createItem({
    kind: 'task',
    title: 'Review',
    start: '2026-09-28T09:00',
    end: '2026-09-28T10:00',
    allDay: false,
  });
  item.recurrence = {
    freq: 'daily',
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
  };
  return item;
}

async function editInput(el: Element, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function editSelect(el: Element, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function clickButton(host: HTMLElement, label: string) {
  const button = [...host.querySelectorAll('button')].find((b) => b.textContent === label);
  expect(button, `button "${label}"`).toBeDefined();
  await act(async () => {
    button!.click();
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll('button')].find((b) => b.textContent === label);
  expect(found, `button "${label}"`).toBeDefined();
  return found as HTMLButtonElement;
}

function confirmation(host: HTMLElement): HTMLElement {
  const dialog = host.querySelector('[role="alertdialog"]');
  expect(dialog).not.toBeNull();
  return dialog as HTMLElement;
}

/** Every occurrence key the series expands to inside a wide window. */
function expandedKeys(item: Item): string[] {
  return expandOccurrences(
    item,
    new Date('2026-07-01T00:00:00'),
    new Date('2026-08-31T00:00:00'),
  ).map((occ) => occ.occKey);
}

/** Whether a control is inert because it sits in a disabled `fieldset`. */
function isFieldDisabled(el: Element): boolean {
  return (el as HTMLInputElement).disabled || !!el.closest('fieldset[disabled]');
}

beforeEach(async () => {
  await db.items.clear();
  useUiStore.setState({
    editor: { open: false, item: null, occurrenceKey: null, splitMode: 'all' },
    toasts: [],
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

  it('renders the details defaults for an item stored without data', async () => {
    const raw = {
      ...createItem({ kind: 'habit', title: 'Stretch' }),
      data: undefined,
    } as unknown as Item;
    await itemRepo.create(raw);
    useUiStore.getState().openEditor(raw);
    const mounted = await mountEditor();

    expect(mounted.host.textContent).toContain('Target count');
    const target = mounted.host.querySelector('input[type="number"]') as HTMLInputElement;
    expect(target.value).toBe('1');

    await mounted.unmount();
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

  it('scopes a "this occurrence" save to the override, leaving the series intact', async () => {
    const item = recurringItem();
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    await editInput(mounted.host.querySelector('input.input')!, 'Standup (retro)');
    // Urgency is a series-only field: the second select in the details tab.
    await editSelect(mounted.host.querySelectorAll('select')[1], 'high');
    await clickButton(mounted.host, 'Save');

    const saved = (await itemRepo.get(item.id))!;
    expect(saved.title).toBe('Standup');
    expect(saved.urgency).toBe('low');
    expect(saved.start).toBe('2026-07-13T09:00');
    expect(saved.recurrence?.overrides).toEqual({
      '2026-07-20': { title: 'Standup (retro)' },
    });

    await mounted.unmount();
  });

  it('seeds the schedule from the resolved occurrence, override included', async () => {
    const item = dailyTimedSeries();
    item.recurrence!.overrides['2026-10-04'] = { start: '2026-10-05T14:45' };
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-10-04');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'Schedule');
    const date = mounted.host.querySelector('input[type="date"]') as HTMLInputElement;
    const time = mounted.host.querySelector('input[type="time"]') as HTMLInputElement;
    expect(date.value).toBe('2026-10-05');
    expect(time.value).toBe('14:45');

    await clickButton(mounted.host, 'Save');

    const saved = (await itemRepo.get(item.id))!;
    expect(saved.start).toBe('2026-09-28T09:00');
    expect(saved.recurrence?.overrides['2026-10-04']).toEqual({ start: '2026-10-05T14:45' });
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual([
      'Nothing to update for this occurrence',
    ]);

    await mounted.unmount();
  });

  it('writes a changed occurrence time on the occurrence date and not the series date', async () => {
    const item = dailyTimedSeries();
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-10-04');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'Schedule');
    await editInput(mounted.host.querySelector('input[type="time"]')!, '14:45');
    await clickButton(mounted.host, 'Save');

    const saved = (await itemRepo.get(item.id))!;
    expect(saved.recurrence?.overrides['2026-10-04']).toEqual({ start: '2026-10-04T14:45' });
    expect(saved.start).toBe('2026-09-28T09:00');
    const day = new Date('2026-10-04T00:00:00');
    expect(expandOccurrences(saved, day, day)[0]).toMatchObject({
      start: '2026-10-04T14:45',
    });

    await mounted.unmount();
  });

  it('does not leak the seeded occurrence range into an all-occurrences save', async () => {
    const item = dailyTimedSeries();
    item.recurrence!.overrides['2026-10-04'] = { start: '2026-10-05T14:45' };
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-10-04');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'All occurrences');
    await clickButton(mounted.host, 'Schedule');
    const date = mounted.host.querySelector('input[type="date"]') as HTMLInputElement;
    expect(date.value).toBe('2026-09-28');

    await clickButton(mounted.host, 'Details');
    await editInput(mounted.host.querySelector('input.input')!, 'Review (weekly)');
    await clickButton(mounted.host, 'Save');

    const saved = (await itemRepo.get(item.id))!;
    expect(saved.title).toBe('Review (weekly)');
    expect(saved.start).toBe('2026-09-28T09:00');
    expect(saved.end).toBe('2026-09-28T10:00');
    expect(saved.recurrence?.overrides['2026-10-04']).toEqual({ start: '2026-10-05T14:45' });

    await mounted.unmount();
  });

  it('keeps a non-recurring multi-day range when opened with an occurrence key', async () => {
    const item = createItem({
      kind: 'event',
      title: 'Trip',
      start: '2026-10-20',
      end: '2026-10-22T00:00',
      allDay: true,
    });
    expect(item.recurrence).toBeNull();
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-10-20');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'Schedule');
    const date = mounted.host.querySelector('input[type="date"]') as HTMLInputElement;
    const end = mounted.host.querySelectorAll(
      'input[type="datetime-local"]',
    )[1] as HTMLInputElement;
    expect(date.value).toBe('2026-10-20');
    expect(end.value).toBe('2026-10-22T00:00');

    await clickButton(mounted.host, 'Save');

    const saved = (await itemRepo.get(item.id))!;
    expect(saved.start).toBe('2026-10-20');
    expect(saved.end).toBe('2026-10-22T00:00');
    expect(saved.allDay).toBe(true);
    expect(saved.history).toEqual([]);

    await mounted.unmount();
  });

  it('keeps a schedule edit made before switching to this-and-future', async () => {
    const item = dailyTimedSeries();
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-10-04');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'Schedule');
    await editInput(mounted.host.querySelector('input[type="time"]')!, '14:45');
    await clickButton(mounted.host, 'This and future');
    // Switching scope must not reset the time the user just changed back to the series value.
    expect((mounted.host.querySelector('input[type="time"]') as HTMLInputElement).value).toBe(
      '14:45',
    );
    await clickButton(mounted.host, 'Save');

    const tail = (await itemRepo.all()).find((row) => row.id !== item.id)!;
    expect(tail.start).toBe('2026-10-04T14:45');
    const splitDay = new Date('2026-10-04T00:00:00');
    expect(expandOccurrences(tail, splitDay, splitDay)[0]).toMatchObject({
      start: '2026-10-04T14:45',
    });
    // The head keeps the untouched series time for the occurrences before the split.
    const head = (await itemRepo.get(item.id))!;
    const before = new Date('2026-10-03T00:00:00');
    expect(expandOccurrences(head, before, before)[0]).toMatchObject({ start: '2026-10-03T09:00' });

    await mounted.unmount();
  });

  it('still writes the series when the save is scoped to all occurrences', async () => {
    const item = recurringItem();
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'All occurrences');
    await editInput(mounted.host.querySelector('input.input')!, 'Standup (retro)');
    await editSelect(mounted.host.querySelectorAll('select')[1], 'high');
    await clickButton(mounted.host, 'Save');

    const saved = (await itemRepo.get(item.id))!;
    expect(saved.title).toBe('Standup (retro)');
    expect(saved.urgency).toBe('high');
    expect(saved.recurrence?.overrides).toEqual({});

    await mounted.unmount();
  });

  it('disables the series-only fields for a single occurrence instead of dropping them', async () => {
    const item = recurringItem();
    item.tags = ['work'];
    item.reminders = [{ id: 'r1', offsetMinutes: -10 }];
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    const urgency = mounted.host.querySelectorAll('select')[1] as HTMLSelectElement;
    const tagInput = mounted.host.querySelector('input[placeholder="Add tag…"]')!;
    expect(urgency.disabled).toBe(true);
    expect(isFieldDisabled(tagInput)).toBe(true);
    expect(mounted.host.textContent).toContain('Applies to the whole series');

    await clickButton(mounted.host, 'Schedule');
    expect(isFieldDisabled(mounted.host.querySelector('input[type="datetime-local"]')!)).toBe(true);

    // Even a forced change cannot reach the series while this scope is selected.
    await editSelect(urgency, 'high');
    await clickButton(mounted.host, 'Save');

    const saved = (await itemRepo.get(item.id))!;
    expect(saved.urgency).toBe('low');
    expect(saved.tags).toEqual(['work']);
    expect(saved.reminders).toEqual([{ id: 'r1', offsetMinutes: -10 }]);
    expect(saved.recurrence?.overrides).toEqual({});
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual([
      'Nothing to update for this occurrence',
    ]);

    await mounted.unmount();
  });

  it('disables the subtasks input and child checkboxes for one occurrence only', async () => {
    const item = recurringItem();
    await itemRepo.create(item);
    const child = createItem({ kind: 'task', title: 'Write notes', parentId: item.id });
    await itemRepo.create(child);
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    const addSubtask = () =>
      mounted.host.querySelector<HTMLInputElement>('input[aria-label="Add subtask"]')!;
    const childBox = () =>
      mounted.host.querySelector<HTMLInputElement>('input[aria-label="Write notes"]')!;
    expect(addSubtask()).not.toBeNull();
    expect(childBox()).not.toBeNull();
    expect(isFieldDisabled(addSubtask())).toBe(true);
    expect(isFieldDisabled(childBox())).toBe(true);
    expect(mounted.host.textContent).toContain('Subtasks · Applies to the whole series');

    // Enter in the (disabled) add input must not create a child while scoped to one occurrence.
    const input = addSubtask();
    await act(async () => {
      input.value = 'Sneaky child';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(await itemRepo.children(item.id)).toHaveLength(1);

    await clickButton(mounted.host, 'This and future');
    expect(isFieldDisabled(addSubtask())).toBe(false);
    expect(isFieldDisabled(childBox())).toBe(false);

    await clickButton(mounted.host, 'All occurrences');
    expect(isFieldDisabled(addSubtask())).toBe(false);
    expect(isFieldDisabled(childBox())).toBe(false);

    await mounted.unmount();
  });

  it('stores an occurrence-scoped status where the card checkbox reads it', async () => {
    const item = recurringItem();
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    // Status select is per-occurrence and stays editable.
    await editSelect(mounted.host.querySelectorAll('select')[0], 'done');
    await clickButton(mounted.host, 'Save');

    const saved = (await itemRepo.get(item.id))!;
    expect(saved.status).toBe('todo');
    expect(saved.occurrences['2026-07-20']).toMatchObject({ status: 'done' });
    expect(saved.recurrence?.overrides).toEqual({});
    expect(resolveOccurrenceStatus(saved, '2026-07-20').status).toBe('done');
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(['Occurrence updated']);

    await mounted.unmount();
  });

  it('skips only the open occurrence when the delete control is scoped to it', async () => {
    const item = recurringItem();
    await itemRepo.create(item);
    const before = expandedKeys((await itemRepo.get(item.id))!);
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    expect(button(mounted.host, 'Skip this occurrence')).toBeDefined();
    await clickButton(mounted.host, 'Skip this occurrence');

    const confirm = confirmation(mounted.host);
    expect(confirm.textContent).toContain('Only the occurrence on 2026-07-20 is skipped');
    expect(confirm.textContent).not.toContain('whole series');
    await clickButton(confirm, 'Skip occurrence');

    const after = (await itemRepo.get(item.id))!;
    expect(after.recurrence?.exceptions).toEqual(['2026-07-20']);
    expect(expandedKeys(after)).toEqual(before.filter((key) => key !== '2026-07-20'));
    expect(after.title).toBe('Standup');
    expect(useUiStore.getState().editor.open).toBe(false);

    await mounted.unmount();
  });

  it('cancels the skip without writing anything', async () => {
    const item = recurringItem();
    await itemRepo.create(item);
    const before = (await itemRepo.get(item.id))!;
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'Skip this occurrence');
    await clickButton(confirmation(mounted.host), 'Keep it');

    expect(await itemRepo.get(item.id)).toEqual(before);
    expect(useUiStore.getState().editor.open).toBe(true);

    await mounted.unmount();
  });

  it('still deletes the whole series in the all-occurrences scope', async () => {
    const item = recurringItem();
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'All occurrences');
    expect(button(mounted.host, 'Delete')).toBeDefined();
    await clickButton(mounted.host, 'Delete');

    const confirm = confirmation(mounted.host);
    expect(confirm.textContent).toContain('deletes “Standup” and its subtasks');
    await clickButton(confirm, 'Delete series');

    expect(await itemRepo.get(item.id)).toBeUndefined();
    expect(useUiStore.getState().editor.open).toBe(false);

    await mounted.unmount();
  });

  it('offers no delete in the this-and-future scope instead of dropping the series', async () => {
    const item = recurringItem();
    await itemRepo.create(item);
    const before = (await itemRepo.get(item.id))!;
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'This and future');

    expect(mounted.host.textContent).toContain('Delete is unavailable for “This and future”');
    expect(button(mounted.host, 'Delete').disabled).toBe(true);
    expect(mounted.host.querySelector('[role="alertdialog"]')).toBeNull();
    expect(await itemRepo.get(item.id)).toEqual(before);

    await mounted.unmount();
  });

  it('keeps the range ordered when All day is switched off for one occurrence', async () => {
    const item = allDaySeries();
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item, '2026-07-20');
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'Schedule');
    const allDay = mounted.host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(allDay.checked).toBe(true);
    await act(async () => {
      allDay.click();
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    await clickButton(mounted.host, 'Save');

    const saved = (await itemRepo.get(item.id))!;
    const day = new Date('2026-07-20T00:00:00');
    const [occ] = expandOccurrences(saved, day, day);
    expect(occ.allDay).toBe(false);
    expect(hasTimeComponent(occ.end)).toBe(true);
    expect(parseLocalDate(occ.end!)!.getTime()).toBeGreaterThanOrEqual(
      parseLocalDate(occ.start)!.getTime(),
    );
    // The rest of the series keeps its all-day range.
    const sibling = new Date('2026-07-21T00:00:00');
    expect(expandOccurrences(saved, sibling, sibling)[0]).toMatchObject({
      start: '2026-07-21',
      end: '2026-07-21',
      allDay: true,
    });

    await mounted.unmount();
  });

  it('computes analytics only while the Analytics tab is open, with identical output', async () => {
    const item = recurringItem();
    await itemRepo.create(item);
    // No occurrence key, so the draft is a clone of the series and the expected window is exact.
    useUiStore.getState().openEditor(item);
    const mounted = await mountEditor();
    const spy = vi.mocked(expandOccurrences);
    spy.mockClear();

    await editInput(mounted.host.querySelector('input.input')!, 'Standup renamed');
    expect(spy).not.toHaveBeenCalled();

    await clickButton(mounted.host, 'Analytics');
    expect(spy).toHaveBeenCalled();

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 120);
    const stats = itemCompletionStats(item, from, to);
    const recent = expandOccurrences(item, from, to)
      .reverse()
      .slice(0, 12)
      .map((occ) => occ.occKey);

    const text = mounted.host.textContent ?? '';
    expect(text).toContain(`${stats.rate}%`);
    expect(text).toContain(`${stats.done} of ${stats.total} in last 120 days`);
    for (const occKey of recent) expect(text).toContain(occKey);

    await mounted.unmount();
  });
});

/** Widths narrower than `w-32` clip the native `12:00 AM` value plus its clock affordance. */
function hasTooNarrowTimeWidth(input: HTMLInputElement): boolean {
  return [...input.className.matchAll(/\bw-(\d+)\b/g)].some((match) => Number(match[1]) < 32);
}

describe('ItemEditorSheet time inputs', () => {
  it('sizes the Start-time input to fit the AM/PM indicator', async () => {
    const item = dailyTimedSeries();
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item);
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'Schedule');
    const time = mounted.host.querySelector<HTMLInputElement>('input[type="time"]');
    expect(time).not.toBeNull();
    expect(time!.getAttribute('aria-label')).toBe('Start time');
    // `w-28` clipped the native AM/PM indicator; the control needs a wider box.
    expect(time!.className).not.toContain('w-28');
    expect(time!.className).toMatch(/\bw-3[2-9]\b/);
    expect(hasTooNarrowTimeWidth(time!)).toBe(false);

    await mounted.unmount();
  });

  it('never narrows a time input, including the all-day reminder time', async () => {
    const item = createItem({
      kind: 'task',
      title: 'Standup',
      start: '2026-07-13',
      allDay: true,
    });
    item.reminders = [{ id: 'r1', timeOfDay: '09:00' }];
    await itemRepo.create(item);
    useUiStore.getState().openEditor(item);
    const mounted = await mountEditor();

    await clickButton(mounted.host, 'Schedule');
    const inputs = [...mounted.host.querySelectorAll<HTMLInputElement>('input[type="time"]')];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(hasTooNarrowTimeWidth(input)).toBe(false);

    await mounted.unmount();
  });
});
