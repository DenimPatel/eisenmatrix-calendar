import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickadd';

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
});
