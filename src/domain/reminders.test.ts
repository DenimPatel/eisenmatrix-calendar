import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOOKBACK_MS } from '@/pwa/delivery';
import { createItem } from './itemFactory';
import {
  DEFAULT_LOOKBACK_MS,
  fireTimesForOccurrence,
  formatReminderLabel,
  pruneExpiredAbsolute,
  reconcileReminderMode,
  reminderFireTime,
  upcomingReminders,
  withSnooze,
} from './reminders';
import { expandOccurrences } from './recurrence';
import type { Item, OccurrenceStatus, Reminder } from '@/types';

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

describe('upcomingReminders fire-time window', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function tickWindow(now: Date): [Date, Date] {
    return [new Date(now.getTime() - LOOKBACK_MS), new Date(now.getTime() + 30_000)];
  }

  it('evaluates a negative offset that fires on a day before the occurrence', () => {
    vi.useFakeTimers();
    const item = createItem({
      kind: 'task',
      title: 'Standup',
      start: '2026-01-05T09:00',
      allDay: false,
    });
    item.reminders = [{ id: 'r', offsetMinutes: -1440 }];

    // The delivery tick at the fire time itself: the occurrence day (Jan 5) is
    // outside the floored window, so it must still be expanded and matched.
    vi.setSystemTime(new Date('2026-01-04T09:00:30'));
    const [from, to] = tickWindow(new Date());
    expect(upcomingReminders([item], from, to).map((r) => r.fireAt)).toEqual([
      new Date('2026-01-04T09:00').getTime(),
    ]);
  });

  it('evaluates a negative offset crossing midnight into the previous day', () => {
    vi.useFakeTimers();
    const item = createItem({
      kind: 'task',
      title: 'Standup',
      start: '2026-01-05T09:00',
      allDay: false,
    });
    item.reminders = [{ id: 'r', offsetMinutes: -600 }];

    vi.setSystemTime(new Date('2026-01-04T23:00:30'));
    const [from, to] = tickWindow(new Date());
    expect(upcomingReminders([item], from, to).map((r) => r.fireAt)).toEqual([
      new Date('2026-01-04T23:00').getTime(),
    ]);
  });

  it('keeps same-day offsets and timeOfDay timing, sorted by fireAt', () => {
    const before = createItem({
      kind: 'task',
      title: 'Before',
      start: '2026-01-05T09:00',
      allDay: false,
    });
    before.reminders = [{ id: 'b', offsetMinutes: -10 }];
    const at = createItem({ kind: 'task', title: 'At', start: '2026-01-05', allDay: true });
    at.reminders = [{ id: 't', timeOfDay: '09:00' }];

    const result = upcomingReminders(
      [before, at],
      new Date('2026-01-04T00:00:00'),
      new Date('2026-01-05T23:59:59'),
    );
    expect(result.map((r) => r.fireAt)).toEqual([
      new Date('2026-01-05T08:50').getTime(),
      new Date('2026-01-05T09:00').getTime(),
    ]);
  });
});

describe('upcomingReminders occurrence status', () => {
  const DAY_START = new Date('2026-10-18T00:00:00');
  const DAY_END = new Date('2026-10-18T23:59:59');
  const OCC_KEY = '2026-10-18';

  function dailyTask(reminder: Reminder): Item {
    const item = createItem({
      kind: 'task',
      title: 'Take medicine',
      start: '2026-10-18T09:00',
      allDay: false,
      recurrence: { freq: 'daily', interval: 1, weekStartsOn: 1, exceptions: [], overrides: {} },
    });
    item.reminders = [reminder];
    return item;
  }

  function schedule(item: Item): number[] {
    return upcomingReminders([item], DAY_START, DAY_END).map((r) => r.fireAt);
  }

  const relative: Reminder = { id: 'r1', offsetMinutes: 0 };
  const timeOfDay: Reminder = { id: 'r1', timeOfDay: '09:00' };

  for (const [label, reminder] of [
    ['relative offset', relative],
    ['time of day', timeOfDay],
  ] as const) {
    describe(label, () => {
      const matrix: Array<[OccurrenceStatus, boolean]> = [
        ['todo', true],
        ['doing', true],
        ['done', false],
        ['cancelled', false],
      ];

      it.each(matrix)('status %s schedules: %s', (status, expected) => {
        const item = dailyTask(reminder);
        item.occurrences[OCC_KEY] = { status, completedAt: null };
        const fire = new Date('2026-10-18T09:00').getTime();
        expect(schedule(item)).toEqual(expected ? [fire] : []);
      });

      it('suppresses a skipped occurrence', () => {
        const item = dailyTask(reminder);
        item.recurrence!.exceptions = [OCC_KEY];
        expect(schedule(item)).toEqual([]);
      });

      it('returns nothing once the occurrence is done or cancelled', () => {
        for (const status of ['done', 'cancelled'] as const) {
          const item = dailyTask(reminder);
          item.occurrences[OCC_KEY] = { status, completedAt: null };
          expect(schedule(item)).toEqual([]);
        }
      });
    });
  }
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

describe('fireTimesForOccurrence', () => {
  it('returns sorted, de-duplicated fire times for mixed reminder triggers', () => {
    const item = createItem({
      kind: 'event',
      title: 'Mixed',
      start: '2024-01-01T10:00',
      allDay: false,
    });
    item.reminders = [
      { id: 'abs', absolute: 1_000 },
      { id: 'off-a', offsetMinutes: -30 },
      { id: 'off-dup', offsetMinutes: -30 },
      { id: 'tod', timeOfDay: '08:00' },
      { id: 'none' },
    ];
    const [occ] = expandOccurrences(
      item,
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );

    expect(fireTimesForOccurrence(occ)).toEqual([
      1_000,
      new Date('2024-01-01T08:00').getTime(),
      new Date('2024-01-01T09:30').getTime(),
    ]);
  });

  it('returns an empty list when no reminder has a usable trigger', () => {
    const item = createItem({ kind: 'task', title: 'None', start: '2024-01-01', allDay: true });
    item.reminders = [{ id: 'a' }, { id: 'b' }];
    const [occ] = expandOccurrences(
      item,
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );

    expect(fireTimesForOccurrence(occ)).toEqual([]);
  });

  it('collapses reminders that resolve to the same instant to one entry', () => {
    const item = createItem({ kind: 'task', title: 'Same', start: '2024-01-01', allDay: true });
    item.reminders = [
      { id: 'tod', timeOfDay: '09:00' },
      { id: 'tod-2', timeOfDay: '09:00' },
    ];
    const [occ] = expandOccurrences(
      item,
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );

    expect(fireTimesForOccurrence(occ)).toEqual([new Date('2024-01-01T09:00').getTime()]);
  });
});

describe('reminderFireTime timeOfDay path', () => {
  it('anchors timeOfDay to the occurrence day, not the item series start', () => {
    const item = createItem({
      kind: 'event',
      title: 'Timed',
      start: '2024-01-01T10:00',
      allDay: false,
    });
    const [occ] = expandOccurrences(
      item,
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );

    expect(reminderFireTime(occ, { id: 'r', timeOfDay: '08:15' })).toBe(
      new Date('2024-01-01T08:15').getTime(),
    );
  });

  it('treats a missing hour or minute component as zero', () => {
    const item = createItem({ kind: 'task', title: 'Odd', start: '2024-01-01', allDay: true });
    const [occ] = expandOccurrences(
      item,
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );

    expect(reminderFireTime(occ, { id: 'r', timeOfDay: ':30' })).toBe(
      new Date('2024-01-01T00:30').getTime(),
    );
  });

  it('returns null when no trigger is present', () => {
    const item = createItem({ kind: 'task', title: 'None', start: '2024-01-01', allDay: true });
    const [occ] = expandOccurrences(
      item,
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );

    expect(reminderFireTime(occ, { id: 'r' })).toBeNull();
  });

  it('prefers an absolute time over any relative trigger', () => {
    const item = createItem({ kind: 'task', title: 'Abs', start: '2024-01-01', allDay: true });
    const [occ] = expandOccurrences(
      item,
      new Date('2024-01-01T00:00:00'),
      new Date('2024-01-01T23:59:59'),
    );

    expect(reminderFireTime(occ, { id: 'r', absolute: 5, offsetMinutes: -10 })).toBe(5);
  });
});

describe('formatReminderLabel', () => {
  it('renders an absolute reminder as a local date-time string', () => {
    const at = new Date('2024-03-09T14:45').getTime();
    expect(formatReminderLabel({ id: 'r', absolute: at })).toBe(new Date(at).toLocaleString());
  });

  it('renders a time-of-day reminder', () => {
    expect(formatReminderLabel({ id: 'r', timeOfDay: '08:30' })).toBe('At 08:30');
  });

  it('renders an at-start reminder', () => {
    expect(formatReminderLabel({ id: 'r', offsetMinutes: 0 })).toBe('At start');
  });

  it('renders day, hour and minute units with correct pluralisation and direction', () => {
    expect(formatReminderLabel({ id: 'r', offsetMinutes: 1440 })).toBe('After 1 day');
    expect(formatReminderLabel({ id: 'r', offsetMinutes: -1440 })).toBe('Before 1 day');
    expect(formatReminderLabel({ id: 'r', offsetMinutes: 2880 })).toBe('After 2 days');
    expect(formatReminderLabel({ id: 'r', offsetMinutes: 60 })).toBe('After 1 hour');
    expect(formatReminderLabel({ id: 'r', offsetMinutes: -60 })).toBe('Before 1 hour');
    expect(formatReminderLabel({ id: 'r', offsetMinutes: 120 })).toBe('After 2 hours');
    expect(formatReminderLabel({ id: 'r', offsetMinutes: 30 })).toBe('After 30 min');
    expect(formatReminderLabel({ id: 'r', offsetMinutes: -30 })).toBe('Before 30 min');
    expect(formatReminderLabel({ id: 'r', offsetMinutes: 90 })).toBe('After 90 min');
  });

  it('falls back to a generic label when no trigger is present', () => {
    expect(formatReminderLabel({ id: 'r' })).toBe('Reminder');
  });
});

describe('reconcileReminderMode', () => {
  it('turning All day off converts a timeOfDay reminder to an offset from the seeded start', () => {
    const result = reconcileReminderMode([{ id: 'r', timeOfDay: '09:00' }], false, '2026-07-20');
    expect(result.start).toBe('2026-07-20T09:00');
    expect(result.reminders).toEqual([{ id: 'r', offsetMinutes: 0 }]);
  });

  it('seeds a date-only start from the earliest timeOfDay and keeps the others relative', () => {
    const result = reconcileReminderMode(
      [
        { id: 'a', timeOfDay: '08:00' },
        { id: 'b', timeOfDay: '08:30' },
      ],
      false,
      '2026-07-20',
    );
    expect(result.start).toBe('2026-07-20T08:00');
    expect(result.reminders).toEqual([
      { id: 'a', offsetMinutes: 0 },
      { id: 'b', offsetMinutes: 30 },
    ]);
  });

  it('defaults a date-only start with no reminder to a sane 09:00', () => {
    expect(reconcileReminderMode([], false, '2026-07-20')).toEqual({
      start: '2026-07-20T09:00',
      reminders: [],
    });
  });

  it('turning All day on converts a same-day offset to a clock time', () => {
    // 09:00 start minus 10 minutes is 08:50, still on the start day.
    expect(
      reconcileReminderMode([{ id: 'r', offsetMinutes: -10 }], true, '2026-07-20T09:00'),
    ).toEqual({ start: '2026-07-20', reminders: [{ id: 'r', timeOfDay: '08:50' }] });
  });

  it('keeps a cross-day offset as an offset instead of dropping it', () => {
    // 09:00 start minus 10 hours lands on the previous day, so no honest clock time exists.
    expect(
      reconcileReminderMode([{ id: 'r', offsetMinutes: -600 }], true, '2026-07-20T09:00'),
    ).toEqual({ start: '2026-07-20', reminders: [{ id: 'r', offsetMinutes: -600 }] });
  });

  it('leaves absolute reminders untouched in both directions', () => {
    const absolute: Reminder = { id: 'abs', absolute: 1_000, label: 'Snoozed 10m' };
    expect(reconcileReminderMode([absolute], false, '2026-07-20').reminders).toEqual([absolute]);
    expect(reconcileReminderMode([absolute], true, '2026-07-20T09:00').reminders).toEqual([
      absolute,
    ]);
  });

  it('preserves the intended instant across off then on', () => {
    const off = reconcileReminderMode([{ id: 'r', timeOfDay: '09:00' }], false, '2026-07-20');
    const on = reconcileReminderMode(off.reminders, true, off.start);
    expect(on).toEqual({ start: '2026-07-20', reminders: [{ id: 'r', timeOfDay: '09:00' }] });
  });

  it('keeps the fire time the select value and label both describe', () => {
    const off = reconcileReminderMode([{ id: 'r', timeOfDay: '09:00' }], false, '2026-07-20');
    const [occ] = expandOccurrences(
      createItem({ kind: 'task', title: 'Water', start: off.start, allDay: false }),
      new Date('2026-07-20T00:00:00'),
      new Date('2026-07-20T23:59:59'),
    );
    // The select value (`0`) and the label ("At start") name the same 09:00 instant.
    expect(reminderFireTime(occ, off.reminders[0])).toBe(new Date('2026-07-20T09:00').getTime());
    expect(formatReminderLabel(off.reminders[0])).toBe('At start');
  });
});
