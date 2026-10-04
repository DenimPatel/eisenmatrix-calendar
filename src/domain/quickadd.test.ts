import { describe, expect, it } from 'vitest';
import { parseQuickAdd, splitNoteDraft, NOTE_TITLE_MAX } from './quickadd';

describe('parseQuickAdd', () => {
  it('parses a recurring bill with amount, day and urgency', () => {
    const result = parseQuickAdd('pay electricity $120 every month on the 5th !urgent');
    expect(result.kind).toBe('bill');
    expect(result.amount).toBe(120);
    expect(result.currency).toBe('USD');
    expect(result.urgency).toBe('high');
    expect(result.recurrence?.freq).toBe('monthly');
    expect(result.recurrence?.byMonthDay).toEqual([5]);
    expect(result.title.toLowerCase()).toContain('electricity');
    expect(result.chips.map((c) => c.field)).toContain('amount');
  });

  it('parses a shopping item with quantity and tag', () => {
    const result = parseQuickAdd('buy milk 2L #groceries');
    expect(result.kind).toBe('shopping');
    expect(result.quantity).toBe(2);
    expect(result.unit).toBe('l');
    expect(result.tags).toContain('groceries');
    expect(result.title).toBe('Milk');
    expect(result.listName).toBe('Groceries');
  });

  it('parses a weekday habit/event with time', () => {
    const result = parseQuickAdd('gym mon/wed/fri 7am');
    expect(result.recurrence?.freq).toBe('weekly');
    expect(result.recurrence?.byWeekday).toEqual([1, 3, 5]);
    expect(result.time).toBe('07:00');
    expect(result.allDay).toBe(false);
    expect(result.start).toMatch(/T07:00$/);
    expect(result.title).toBe('Gym');
  });

  it('defaults to a task with today and all-day', () => {
    const result = parseQuickAdd('write report');
    expect(result.kind).toBe('task');
    expect(result.title).toBe('Write report');
    expect(result.allDay).toBe(true);
    expect(result.recurrence).toBeNull();
  });

  it('parses relative dates', () => {
    const now = new Date('2024-06-10T12:00:00');
    expect(parseQuickAdd('call mom tomorrow', now).start).toBe('2024-06-11');
    expect(parseQuickAdd('review in 3 days', now).start).toBe('2024-06-13');
  });

  it('parses explicit dates and am/pm', () => {
    const result = parseQuickAdd('meeting 2024-03-04 2:30pm');
    expect(result.start).toBe('2024-03-04T14:30');
    expect(result.allDay).toBe(false);
  });

  it('schedules a lone weekday on the next occurrence of that weekday', () => {
    const now = new Date('2024-06-10T12:00:00'); // Monday
    const fri = parseQuickAdd('gym fri', now);
    expect(fri.title).toBe('Gym');
    expect(fri.start).toBe('2024-06-14');
    expect(fri.recurrence).toBeNull();

    const mon = parseQuickAdd('call mon', now);
    expect(mon.title).toBe('Call');
    expect(mon.start).toBe('2024-06-17');
    expect(mon.recurrence).toBeNull();
  });

  it('keeps a lone weekday as a weekly rule when "every" is present', () => {
    const now = new Date('2024-06-10T12:00:00');
    const result = parseQuickAdd('gym every week fri 7am', now);
    expect(result.title).toBe('Gym');
    expect(result.start).toBe('2024-06-10T07:00');
    expect(result.recurrence?.freq).toBe('weekly');
    expect(result.recurrence?.byWeekday).toEqual([5]);
  });

  it('schedules a bare "on the 5th" on the next 5th and keeps the text out of the title', () => {
    const now = new Date('2024-06-10T12:00:00');
    const result = parseQuickAdd('party on the 5th', now);
    expect(result.title).toBe('Party');
    expect(result.start).toBe('2024-07-05');
    expect(result.recurrence).toBeNull();

    const fromMay = parseQuickAdd('party on the 31st', new Date('2024-04-20T12:00:00'));
    expect(fromMay.start).toBe('2024-04-30');
  });

  it('applies "on the 5th" as byMonthDay for monthly rules', () => {
    const now = new Date('2024-06-10T12:00:00');
    const result = parseQuickAdd('pay rent every month on the 5th', now);
    expect(result.title).toBe('Pay rent');
    expect(result.start).toBe('2024-06-10');
    expect(result.recurrence?.freq).toBe('monthly');
    expect(result.recurrence?.byMonthDay).toEqual([5]);
  });

  it('keeps "on the 5th" in the title when an explicit date wins', () => {
    const result = parseQuickAdd('party on the 5th 2024-03-04', new Date('2024-06-10T12:00:00'));
    expect(result.start).toBe('2024-03-04');
    expect(result.title).toBe('Party on the 5th');
  });

  it('keeps multiple weekdays as a weekly rule without a "next" residue', () => {
    const now = new Date('2024-06-10T12:00:00');
    const result = parseQuickAdd('standup tue and thu', now);
    expect(result.title).toBe('Standup');
    expect(result.start).toBe('2024-06-10');
    expect(result.recurrence?.freq).toBe('weekly');
    expect(result.recurrence?.byWeekday).toEqual([2, 4]);

    const explicit = parseQuickAdd('gym next fri', now);
    expect(explicit.title).toBe('Gym');
    expect(explicit.start).toBe('2024-06-14');
    expect(explicit.recurrence).toBeNull();
  });
});

describe('splitNoteDraft', () => {
  it('never drops characters from a long single line', () => {
    const text = 'x'.repeat(200);
    const { title, notes } = splitNoteDraft(text);
    expect(title).toHaveLength(NOTE_TITLE_MAX);
    expect(notes).toHaveLength(200 - NOTE_TITLE_MAX);
    expect(title + notes).toBe(text);
  });

  it('keeps a short single line entirely in the title', () => {
    expect(splitNoteDraft('buy milk')).toEqual({ title: 'buy milk', notes: '' });
  });

  it('does not truncate a line sitting exactly on the cap', () => {
    const text = 'y'.repeat(NOTE_TITLE_MAX);
    const { title, notes } = splitNoteDraft(text);
    expect(title).toBe(text);
    expect(notes).toBe('');
  });

  it('maps the first line to the title and the rest to the body', () => {
    expect(splitNoteDraft('Shopping\nmilk\neggs')).toEqual({
      title: 'Shopping',
      notes: 'milk\neggs',
    });
  });

  it('preserves every character when the first line overflows the cap', () => {
    const head = 'z'.repeat(120);
    const draft = splitNoteDraft(`${head}\ntail`);
    expect(draft.title).toBe(head.slice(0, NOTE_TITLE_MAX));
    expect(draft.notes).toBe(`${head.slice(NOTE_TITLE_MAX)}\ntail`);
    expect(`${head}\ntail`.slice(draft.title.length)).toBe(draft.notes);
  });

  it('keeps blank lines inside the body', () => {
    expect(splitNoteDraft('a\n\nb')).toEqual({ title: 'a', notes: '\nb' });
  });

  it('handles empty input', () => {
    expect(splitNoteDraft('')).toEqual({ title: '', notes: '' });
  });
});
