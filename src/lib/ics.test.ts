import { describe, expect, it } from 'vitest';
import { foldLine, itemsToICS, recurrenceToRRule } from './ics';
import { createItem } from '@/domain/itemFactory';
import type { Item, RecurrenceRule } from '@/types';

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

  it('does not throw for an event whose data is missing', () => {
    const item = {
      ...createItem({ kind: 'event', title: 'No data', start: '2024-05-01' }),
      data: undefined,
    } as unknown as Item;

    expect(() => itemsToICS([item])).not.toThrow();
    expect(itemsToICS([item])).toContain('SUMMARY:No data');
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

  describe('RFC 5545 line folding', () => {
    const utf8 = new TextEncoder();
    const octets = (value: string): number => utf8.encode(value).length;
    const physicalLines = (ics: string): string[] => ics.split('\r\n');

    /** Collect `NAME:` plus its continuation lines, strip continuations' leading space. */
    const unfold = (ics: string, name: string): string => {
      const lines = physicalLines(ics);
      const start = lines.findIndex((line) => line.startsWith(`${name}:`));
      const collected: string[] = [];
      for (let i = start; i < lines.length; i += 1) {
        if (i > start && !lines[i].startsWith(' ')) break;
        collected.push(lines[i].slice(i === start ? 0 : 1));
      }
      return collected.join('');
    };

    it('folds a 200-character title and unfolds back byte-for-byte', () => {
      const title = 'Q'.repeat(200);
      const ics = itemsToICS([createItem({ kind: 'event', title, start: '2024-05-01T09:00' })]);

      expect(physicalLines(ics).filter((line) => line.startsWith(' ')).length).toBeGreaterThan(1);
      for (const line of physicalLines(ics)) {
        expect(octets(line)).toBeLessThanOrEqual(75);
      }
      expect(unfold(ics, 'SUMMARY')).toBe(`SUMMARY:${title}`);
    });

    it('folds multi-byte titles on octet boundaries without breaking characters', () => {
      const title = 'café 🎯 '.repeat(20);
      const ics = itemsToICS([
        createItem({ kind: 'event', title, notes: title, start: '2024-05-01T09:00' }),
      ]);
      const strict = new TextDecoder('utf-8', { fatal: true });

      for (const line of physicalLines(ics)) {
        expect(octets(line)).toBeLessThanOrEqual(75);
        expect(strict.decode(utf8.encode(line))).toBe(line);
      }
      const continuations = physicalLines(ics).filter((line) => line.startsWith(' '));
      expect(continuations.length).toBeGreaterThan(0);
      // Octet-based, not character-based: a filled continuation carries fewer
      // characters than the 75-char limit but still spans the octet budget.
      expect(continuations.some((line) => octets(line) === 75)).toBe(true);
      expect(continuations.every((line) => [...line].length < 75)).toBe(true);
      expect(unfold(ics, 'SUMMARY')).toBe(`SUMMARY:${title}`);
      expect(unfold(ics, 'DESCRIPTION')).toBe(`DESCRIPTION:${title}`);
    });

    it('leaves lines of 75 octets or fewer unfolded', () => {
      const exact = `SUMMARY:${'a'.repeat(67)}`;
      expect(octets(exact)).toBe(75);
      expect(foldLine(exact)).toEqual([exact]);
      expect(foldLine('')).toEqual(['']);

      const over = `SUMMARY:${'a'.repeat(68)}`;
      expect(octets(over)).toBe(76);
      expect(foldLine(over)).toEqual([exact, ' a']);
      for (const line of foldLine(over)) {
        expect(octets(line)).toBeLessThanOrEqual(75);
      }

      const short = itemsToICS([
        createItem({ kind: 'event', title: 'Short', start: '2024-05-01T09:00' }),
      ]);
      expect(short).toContain('SUMMARY:Short\r\n');
      expect(short).not.toContain('\r\n ');
    });
  });
});
