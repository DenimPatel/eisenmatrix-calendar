import { describe, expect, it } from 'vitest';
import { createItem } from './itemFactory';
import { reminderFireTime, upcomingReminders } from './reminders';
import { expandOccurrences } from './recurrence';
import type { Reminder } from '@/types';

describe('reminders', () => {
  it('computes relative offsets before the start', () => {
    const item = createItem({
      kind: 'event',
      title: 'Meeting',
      start: '2024-01-01T10:00',
      allDay: false,
    });
    const [occ] = expandOccurrences(
      item,
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );
    const reminder: Reminder = { id: 'r1', offsetMinutes: -30 };
    expect(reminderFireTime(occ, reminder)).toBe(new Date('2024-01-01T09:30').getTime());
  });

  it('supports absolute time-of-day for all-day items', () => {
    const item = createItem({ kind: 'task', title: 'All day', start: '2024-01-01', allDay: true });
    const [occ] = expandOccurrences(
      item,
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );
    const reminder: Reminder = { id: 'r1', timeOfDay: '08:00' };
    expect(reminderFireTime(occ, reminder)).toBe(new Date('2024-01-01T08:00').getTime());
  });

  it('collects upcoming reminders chronologically and de-duplicates none', () => {
    const a = createItem({ kind: 'event', title: 'A', start: '2024-01-01T10:00', allDay: false });
    a.reminders = [{ id: 'a1', offsetMinutes: -15 }];
    const b = createItem({ kind: 'event', title: 'B', start: '2024-01-01T11:00', allDay: false });
    b.reminders = [
      { id: 'b1', offsetMinutes: -5 },
      { id: 'b2', offsetMinutes: -30 },
    ];

    const result = upcomingReminders(
      [a, b],
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );
    expect(result.map((r) => r.fireAt)).toEqual([
      new Date('2024-01-01T09:45').getTime(),
      new Date('2024-01-01T10:30').getTime(),
      new Date('2024-01-01T10:55').getTime(),
    ]);
  });

  it('skips archived items', () => {
    const item = createItem({ kind: 'task', title: 'X', start: '2024-01-01T10:00', allDay: false });
    item.reminders = [{ id: 'r', offsetMinutes: 0 }];
    item.archivedAt = Date.now();
    const result = upcomingReminders(
      [item],
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );
    expect(result).toHaveLength(0);
  });
});
