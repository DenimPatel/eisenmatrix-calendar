import { describe, expect, it } from 'vitest';
import {
  parseQuickAdd,
  quickAddDataFor,
  quickAddToItem,
  splitNoteDraft,
  NOTE_TITLE_MAX,
} from './quickadd';
import { expandOccurrences } from './recurrence';

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

  it('consumes a bare "every" once a weekday recurrence is established', () => {
    const now = new Date('2024-06-10T12:00:00');
    const result = parseQuickAdd('gym every fri', now);
    expect(result.title).toBe('Gym');
    expect(result.recurrence?.freq).toBe('weekly');
    expect(result.recurrence?.byWeekday).toEqual([5]);
  });

  it('consumes a second weekday group while retaining a non-hint lone weekday', () => {
    const now = new Date('2024-06-10T12:00:00');
    const result = parseQuickAdd('sun the tomatoes fri', now);
    expect(result.title).toBe('Sun the tomatoes');
    expect(result.title).not.toMatch(/\bfri\b/i);
    expect(result.start).toBe('2024-06-14');
    expect(result.recurrence).toBeNull();
  });

  it('leaves a lone weekday in the title and date when it is not a hint', () => {
    const now = new Date('2024-06-10T12:00:00');
    const sun = parseQuickAdd('sun the tomatoes', now);
    expect(sun.title).toBe('Sun the tomatoes');
    expect(sun.start).toBe('2024-06-10');
    expect(sun.recurrence).toBeNull();

    const sat = parseQuickAdd('sat the interview', now);
    expect(sat.title).toBe('Sat the interview');
    expect(sat.start).toBe('2024-06-10');

    const wed = parseQuickAdd('we wed in June', now);
    expect(wed.title).toBe('We wed in June');
    expect(wed.start).toBe('2024-06-10');
  });

  it('consumes a lone weekday hint when it ends the input or follows a trigger', () => {
    const now = new Date('2024-06-10T12:00:00');
    for (const input of ['call on fri', 'call at fri', 'call start fri']) {
      const result = parseQuickAdd(input, now);
      expect(result.title).not.toMatch(/\bfri\b/i);
      expect(result.start).toBe('2024-06-14');
      expect(result.recurrence).toBeNull();
    }
  });

  it('consumes a lone weekday hint before a trailing time or relative date', () => {
    const now = new Date('2024-06-10T12:00:00');
    expect(parseQuickAdd('gym fri 7am', now)).toMatchObject({
      title: 'Gym',
      start: '2024-06-14T07:00',
      recurrence: null,
    });
    expect(parseQuickAdd('gym fri at 7am', now)).toMatchObject({
      start: '2024-06-14T07:00',
      recurrence: null,
    });
    expect(parseQuickAdd('gym fri tomorrow', now)).toMatchObject({
      title: 'Gym',
      start: '2024-06-14',
      recurrence: null,
    });
    expect(parseQuickAdd('gym fri next week', now)).toMatchObject({
      title: 'Gym',
      start: '2024-06-14',
      recurrence: null,
    });
  });

  it('consumes a lone weekday hint before trailing punctuation', () => {
    const now = new Date('2024-06-10T12:00:00');
    for (const input of ['gym fri!', 'gym fri.', 'gym fri,']) {
      const result = parseQuickAdd(input, now);
      expect(result.title).not.toMatch(/\bfri\b/i);
      expect(result.start).toBe('2024-06-14');
      expect(result.recurrence).toBeNull();
    }
  });

  it('attaches a tagged weekday to an "every week" rule', () => {
    const now = new Date('2024-06-10T12:00:00');
    const result = parseQuickAdd('gym every week #fitness fri', now);
    expect(result.title).toBe('Gym');
    expect(result.tags).toContain('fitness');
    expect(result.start).toBe('2024-06-10');
    expect(result.recurrence?.freq).toBe('weekly');
    expect(result.recurrence?.byWeekday).toEqual([5]);

    const timed = parseQuickAdd('gym every week #fitness fri 7am', now);
    expect(timed.title).toBe('Gym');
    expect(timed.start).toBe('2024-06-10T07:00');
    expect(timed.recurrence?.byWeekday).toEqual([5]);
  });

  it('keeps the verified IMP-010 and IMP-011 corpus unchanged', () => {
    const now = new Date('2024-06-10T12:00:00');
    expect(parseQuickAdd('gym fri', now)).toMatchObject({
      title: 'Gym',
      start: '2024-06-14',
      recurrence: null,
    });
    expect(parseQuickAdd('call mon', now)).toMatchObject({
      title: 'Call',
      start: '2024-06-17',
      recurrence: null,
    });
    expect(parseQuickAdd('mon/wed/fri', now)).toMatchObject({
      title: '',
      start: '2024-06-10',
      recurrence: { freq: 'weekly', byWeekday: [1, 3, 5] },
    });
    expect(parseQuickAdd('next fri', now)).toMatchObject({
      title: '',
      start: '2024-06-14',
      recurrence: null,
    });
    expect(parseQuickAdd('party on the 5th', now)).toMatchObject({
      title: 'Party',
      start: '2024-07-05',
      recurrence: null,
    });
    expect(parseQuickAdd('pay rent every month on the 5th', now)).toMatchObject({
      title: 'Pay rent',
      start: '2024-06-10',
      recurrence: { freq: 'monthly', byMonthDay: [5] },
    });
  });
});

describe('quickAddToItem', () => {
  it('defaults a habit to a daily rule so it recurs from today', () => {
    const item = quickAddToItem(parseQuickAdd('habit: meditate', new Date('2024-06-10T12:00:00')));
    expect(item.kind).toBe('habit');
    expect(item.recurrence?.freq).toBe('daily');
    expect(item.recurrence?.interval).toBe(1);
  });

  it('keeps an explicit recurrence from the input', () => {
    const item = quickAddToItem(parseQuickAdd('habit: stretch every 3 days'));
    expect(item.recurrence?.freq).toBe('daily');
    expect(item.recurrence?.interval).toBe(3);
  });

  it('expands a quick-added habit across the coming week', () => {
    const now = new Date('2024-06-10T12:00:00');
    const item = quickAddToItem(parseQuickAdd('habit: meditate', now));
    const occurrences = expandOccurrences(
      item,
      new Date('2024-06-10T00:00:00'),
      new Date('2024-06-16T23:59:59'),
    ).map((o) => o.occKey);
    expect(occurrences).toEqual([
      '2024-06-10',
      '2024-06-11',
      '2024-06-12',
      '2024-06-13',
      '2024-06-14',
      '2024-06-15',
      '2024-06-16',
    ]);
  });

  it('leaves other kinds without a recurrence', () => {
    expect(quickAddToItem(parseQuickAdd('write report')).recurrence).toBeNull();
  });
});

describe('quickAddDataFor', () => {
  it('carries parsed shopping fields and drops them for kinds that do not use them', () => {
    const parsed = parseQuickAdd('buy milk 2L #groceries');
    const shopping = quickAddDataFor('shopping', parsed);
    expect(shopping).toMatchObject({ quantity: 2, unit: 'l', purchased: false });
    expect(shopping).not.toHaveProperty('amount');
    expect(quickAddDataFor('task', parsed)).toEqual({});
  });

  it('carries parsed bill fields and drops them for kinds that do not use them', () => {
    const parsed = parseQuickAdd('pay electricity $120');
    expect(quickAddDataFor('bill', parsed)).toMatchObject({
      amount: 120,
      currency: 'USD',
      payee: 'Pay electricity',
    });
    const shopping = quickAddDataFor('shopping', parsed);
    expect(shopping).toMatchObject({ quantity: 1, purchased: false });
    expect(shopping).not.toHaveProperty('amount');
    expect(shopping).not.toHaveProperty('currency');
  });

  it('restores the parsed values after a kind round-trip', () => {
    const parsed = parseQuickAdd('buy milk 2L #groceries');
    expect(quickAddDataFor('bill', parsed)).toMatchObject({ amount: 0, currency: 'USD' });
    expect(quickAddDataFor('shopping', parsed)).toMatchObject({ quantity: 2, unit: 'l' });
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
