import { describe, expect, it } from 'vitest';
import { createItem } from './itemFactory';
import {
  DEFAULT_LOOKBACK_MS,
  pruneExpiredAbsolute,
  reminderFireTime,
  upcomingReminders,
  withSnooze,
} from './reminders';
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

describe('pruneExpiredAbsolute', () => {
  const NOW = new Date('2026-07-20T10:00:00').getTime();

  it('drops expired absolutes, keeps the pending one, and never touches relative reminders', () => {
    const reminders: Reminder[] = [
      { id: 'offset', offsetMinutes: -10 },
      { id: 'past', absolute: NOW - 60_000, label: 'Snoozed 10m' },
      { id: 'tod', timeOfDay: '09:00' },
      { id: 'future', absolute: NOW + 600_000, label: 'Snoozed 10m' },
    ];

    expect(pruneExpiredAbsolute(reminders, NOW).map((r) => r.id)).toEqual([
      'offset',
      'tod',
      'future',
    ]);
  });

  it('leaves a list with no absolutes untouched', () => {
    const reminders: Reminder[] = [
      { id: 'a', offsetMinutes: 0 },
      { id: 'b', timeOfDay: '08:00' },
    ];
    expect(pruneExpiredAbsolute(reminders, NOW)).toEqual(reminders);
    expect(pruneExpiredAbsolute([], NOW)).toEqual([]);
  });

  it('leaves one pending absolute after sequential snoozes', () => {
    // The user keeps snoozing, so every press lands after the previous snooze fired.
    let reminders: Reminder[] = [{ id: 'rel', offsetMinutes: -10 }];
    let clock = NOW;
    for (let press = 1; press <= 5; press += 1) {
      clock += 600_000;
      reminders = pruneExpiredAbsolute(
        [...reminders, { id: `s${press}`, absolute: clock + 600_000 }],
        clock,
      );
      expect(reminders.map((r) => r.id)).toEqual(['rel', `s${press}`]);
    }

    // Once the last snooze is older than any tick can reach, the next pass reclaims it.
    expect(pruneExpiredAbsolute(reminders, NOW + DEFAULT_LOOKBACK_MS).map((r) => r.id)).toEqual([
      'rel',
    ]);
  });

  it('collapses a stack of snoozes that were never fired to the soonest one', () => {
    const reminders: Reminder[] = [
      { id: 's1', absolute: NOW + 600_000 },
      { id: 's2', absolute: NOW + 1_200_000 },
      { id: 's3', absolute: NOW + 1_800_000 },
    ];

    expect(pruneExpiredAbsolute(reminders, NOW).map((r) => r.id)).toEqual(['s1']);
  });

  it('keeps a snooze that is past but still inside the delivery lookback', () => {
    const reminders: Reminder[] = [{ id: 'missed', absolute: NOW - 5 * 60_000 }];

    // Inside the window: a tick could still deliver it, so the pass must leave it alone.
    expect(pruneExpiredAbsolute(reminders, NOW, DEFAULT_LOOKBACK_MS)).toEqual(reminders);
    // No lookback: outside it, so prunable.
    expect(pruneExpiredAbsolute(reminders, NOW)).toEqual([]);
  });

  it('keeps a due snooze and a pending one side by side, and only ages them out', () => {
    // A 10m snooze fired at T+10m and a 60m snooze was taken then; the item is loaded at T+20m.
    const due: Reminder = { id: 'fired', absolute: NOW - 10 * 60_000, label: 'Snoozed 10m' };
    const pending: Reminder = { id: 'owed', absolute: NOW + 50 * 60_000, label: 'Snoozed 60m' };
    const rel: Reminder = { id: 'rel', offsetMinutes: -10 };

    // The fired row is inside the window and may still be undelivered, so it is kept, and the
    // pending row the user is still owed outranks nothing — both survive the pass.
    const kept = pruneExpiredAbsolute([due, rel, pending], NOW, DEFAULT_LOOKBACK_MS);
    expect(kept).toEqual([due, rel, pending]);

    // Neither is deleted while it can fire: the pending one is now the soonest future row, so
    // only the due one ages out of the window.
    const later = NOW + DEFAULT_LOOKBACK_MS;
    expect(pruneExpiredAbsolute([due, rel, pending], later, DEFAULT_LOOKBACK_MS)).toEqual([
      rel,
      pending,
    ]);
  });

  it('never lets an already-fired row outrank a pending snooze', () => {
    // The reported regression: 10m snooze → it fires → 60m snooze → reload at +20m. Ranking by
    // "soonest row still above the cutoff" keeps the fired one and destroys the 60m request,
    // which no later tick can rescue.
    const reminders: Reminder[] = [
      { id: 'fired', absolute: NOW - 10 * 60_000, label: 'Snoozed 10m' },
      { id: 'owed', absolute: NOW + 50 * 60_000, label: 'Snoozed 60m' },
    ];

    const survivors = pruneExpiredAbsolute(reminders, NOW, DEFAULT_LOOKBACK_MS);
    expect(survivors.some((r) => r.id === 'owed')).toBe(true);
    // The fired row is sooner, so an implementation that keeps a single absolute by soonness
    // drops `owed` instead — that is the shape this test exists to pin.
    expect(survivors.filter((r) => typeof r.absolute === 'number')).toHaveLength(2);
  });
});

describe('withSnooze', () => {
  const NOW = new Date('2026-07-20T10:00:00').getTime();

  it('supersedes the previous absolute instead of appending, keeping relative rows', () => {
    let reminders: Reminder[] = [{ id: 'rel', offsetMinutes: -10 }];
    for (let press = 1; press <= 12; press += 1) {
      reminders = withSnooze(reminders, {
        id: `s${press}`,
        absolute: NOW + press * 60_000,
        label: `Snoozed 10m`,
      });
      // 12 presses used to leave 12 rows for the next load to collapse.
      expect(reminders.map((r) => r.id)).toEqual(['rel', `s${press}`]);
    }
  });

  it('drops an absolute the user had not fired yet, so a new press wins', () => {
    const pending: Reminder = { id: 'old', absolute: NOW + 10 * 60_000 };
    const next: Reminder = { id: 'new', absolute: NOW + 60 * 60_000 };
    expect(withSnooze([{ id: 'tod', timeOfDay: '08:00' }, pending], next)).toEqual([
      { id: 'tod', timeOfDay: '08:00' },
      next,
    ]);
  });
});
