import { describe, expect, it } from 'vitest';
import { isActionableOccurrence, selectNextUp } from './nextUp';
import { createItem } from './itemFactory';
import type { Item, ItemKind, ItemStatus, Occurrence } from '@/types';

const DAY = '2026-10-18';

function occurrence(
  kind: ItemKind,
  start: string | null,
  status: ItemStatus = 'todo',
  title = `${kind} item`,
): Occurrence {
  const item: Item = { ...createItem({ kind, title, start }), status };
  return {
    item,
    occKey: DAY,
    date: new Date(2026, 9, 18),
    title,
    start,
    end: null,
    allDay: !start || !start.includes('T'),
    status,
    completedAt: null,
    isOverride: false,
  };
}

describe('selectNextUp', () => {
  it('prefers a timed task over an all-day note', () => {
    const note = occurrence('note', DAY, 'todo', 'An all-day note');
    const task = occurrence('task', `${DAY}T09:00`, 'todo', 'Timed task');
    const picked = selectNextUp([note, task], new Date(2026, 9, 18, 8, 0));
    expect(picked?.title).toBe('Timed task');
  });

  it('never promotes an all-day item while a timed occurrence is pending', () => {
    const allDay = occurrence('task', DAY, 'todo', 'All-day chore');
    const timed = occurrence('event', `${DAY}T17:30`, 'todo', 'Standup');
    expect(selectNextUp([allDay, timed], new Date(2026, 9, 18, 12, 0))?.title).toBe('Standup');
  });

  it('excludes notes even when they are the only occurrence', () => {
    expect(selectNextUp([occurrence('note', DAY)], new Date(2026, 9, 18, 9, 0))).toBeUndefined();
  });

  it('ignores done and cancelled occurrences', () => {
    const done = occurrence('task', `${DAY}T08:00`, 'done');
    const cancelled = occurrence('task', `${DAY}T08:30`, 'cancelled');
    const open = occurrence('task', `${DAY}T10:00`, 'todo', 'Still open');
    expect(selectNextUp([done, cancelled, open], new Date(2026, 9, 18, 7, 0))?.title).toBe(
      'Still open',
    );
  });

  it('picks the earliest upcoming timed occurrence', () => {
    const late = occurrence('task', `${DAY}T16:00`, 'todo', 'Late');
    const soon = occurrence('task', `${DAY}T11:00`, 'todo', 'Soon');
    expect(selectNextUp([late, soon], new Date(2026, 9, 18, 10, 0))?.title).toBe('Soon');
  });

  it('falls back to the most recently due timed occurrence when all are in the past', () => {
    const early = occurrence('task', `${DAY}T08:00`, 'todo', 'Early');
    const recent = occurrence('task', `${DAY}T09:30`, 'todo', 'Recent');
    expect(selectNextUp([early, recent], new Date(2026, 9, 18, 14, 0))?.title).toBe('Recent');
  });

  it('shows an all-day item without implying a time when nothing is timed', () => {
    const first = occurrence('task', DAY, 'todo', 'First chore');
    const second = occurrence('event', DAY, 'todo', 'Second');
    const picked = selectNextUp([second, first], new Date(2026, 9, 18, 9, 0));
    expect(picked?.title).toBe('First chore');
    expect(picked?.start).toBe(DAY);
    expect(picked?.start?.includes('T')).toBe(false);
  });

  it('is deterministic and does not mutate its input', () => {
    const input = [occurrence('task', `${DAY}T09:00`), occurrence('task', `${DAY}T07:00`)];
    const snapshot = input.map((occ) => occ.start);
    const picked = selectNextUp(input, new Date(2026, 9, 18, 6, 0));
    expect(picked?.start).toBe(`${DAY}T07:00`);
    expect(input.map((occ) => occ.start)).toEqual(snapshot);
  });
});

describe('isActionableOccurrence', () => {
  it('accepts open actionable kinds and rejects notes, done and cancelled', () => {
    expect(isActionableOccurrence(occurrence('task', `${DAY}T09:00`))).toBe(true);
    expect(isActionableOccurrence(occurrence('bill', DAY))).toBe(true);
    expect(isActionableOccurrence(occurrence('note', DAY))).toBe(false);
    expect(isActionableOccurrence(occurrence('task', DAY, 'done'))).toBe(false);
    expect(isActionableOccurrence(occurrence('task', DAY, 'cancelled'))).toBe(false);
  });
});
