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
});
