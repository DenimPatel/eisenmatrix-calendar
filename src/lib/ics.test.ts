import { describe, expect, it } from 'vitest';
import { itemsToICS, recurrenceToRRule } from './ics';
import { createItem } from '@/domain/itemFactory';
import type { RecurrenceRule } from '@/types';

describe('ics', () => {
  it('serialises weekly byWeekday rules', () => {
    const rule: RecurrenceRule = {
      freq: 'weekly',
      interval: 1,
      byWeekday: [1, 3, 5],
      weekStartsOn: 1,
      exceptions: [],
      overrides: {},
    };
    expect(recurrenceToRRule(rule)).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR');
  });

  it('exports events with alarms and escapes text', () => {
    const item = createItem({
      kind: 'event',
      title: 'Sync, daily; standup',
      start: '2024-05-01T09:00',
      allDay: false,
    });
    item.reminders = [{ id: 'r1', offsetMinutes: -30 }];
    item.recurrence = {
      freq: 'weekly',
      interval: 1,
      byWeekday: [3],
      weekStartsOn: 1,
      exceptions: [],
      overrides: {},
    };
    const ics = itemsToICS([item]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20240501T090000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=WE');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics).toContain('SUMMARY:Sync\\, daily\\; standup');
  });

  it('exports all-day items as VALUE=DATE and skips notes/shopping', () => {
    const task = createItem({ kind: 'task', title: 'Pay rent', start: '2024-05-05', allDay: true });
    const note = createItem({ kind: 'note', title: 'Idea' });
    const ics = itemsToICS([task, note]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20240505');
    expect(ics).not.toContain('Idea');
  });

  const weeklyRule: RecurrenceRule = {
    freq: 'weekly',
    interval: 1,
    byWeekday: [1],
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
  };

  it('emits a bare date UNTIL for date-only starts', () => {
    expect(recurrenceToRRule({ ...weeklyRule, until: '2024-06-30' }, true)).toBe(
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630',
    );
  });

  it('emits a UTC date-time UNTIL for timed starts', () => {
    expect(recurrenceToRRule({ ...weeklyRule, until: '2024-06-30' }, false)).toBe(
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630T235959Z',
    );
    expect(recurrenceToRRule({ ...weeklyRule, until: '2024-06-30' })).toBe(
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630T235959Z',
    );
  });

  it('omits UNTIL entirely when the rule has none', () => {
    const expected = 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO';
    expect(recurrenceToRRule(weeklyRule, true)).toBe(expected);
    expect(recurrenceToRRule(weeklyRule, false)).toBe(expected);
  });

  it('keeps RRULE UNTIL matching the emitted DTSTART value type', () => {
    const allDay = createItem({
      kind: 'task',
      title: 'Water plants',
      start: '2024-05-06',
      allDay: true,
    });
    allDay.recurrence = { ...weeklyRule, until: '2024-06-30' };
    const timed = createItem({
      kind: 'event',
      title: 'Standup',
      start: '2024-05-06T09:00',
      allDay: false,
    });
    timed.recurrence = { ...weeklyRule, until: '2024-06-30' };

    const ics = itemsToICS([allDay, timed]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20240506');
    expect(ics).toContain('DTSTART:20240506T090000');
    // Anchored on CRLF so a `UNTIL=20240630T235959Z` suffix cannot satisfy the date-only case.
    expect(ics).toContain('\r\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630\r\n');
    expect(ics).toContain('\r\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630T235959Z\r\n');
  });
});
