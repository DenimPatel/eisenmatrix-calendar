import { describe, expect, it } from 'vitest';
import {
  formatISODate,
  formatISODateTime,
  parseLocalDate,
  startOfWeek,
  clampDayOfMonth,
  firstDayOfISOWeek,
  calendarDaysBetween,
} from './date';

describe('date utils', () => {
  it('formats using local time, never UTC', () => {
    // 23:30 local on Jan 1 would roll to Jan 2 in UTC for negative offsets.
    const d = new Date(2024, 0, 1, 23, 30);
    expect(formatISODate(d)).toBe('2024-01-01');
    expect(formatISODateTime(d)).toBe('2024-01-01T23:30');
  });

  it('round-trips date and datetime strings', () => {
    expect(formatISODate(parseLocalDate('2024-03-09')!)).toBe('2024-03-09');
    const dt = parseLocalDate('2024-03-09T14:45')!;
    expect(formatISODateTime(dt)).toBe('2024-03-09T14:45');
  });

  it('starts weeks on Monday by default', () => {
    // 2024-01-03 is a Wednesday
    expect(formatISODate(startOfWeek(new Date(2024, 0, 3)))).toBe('2024-01-01');
    // Sunday belongs to the week that started the previous Monday
    expect(formatISODate(startOfWeek(new Date(2024, 0, 7)))).toBe('2024-01-01');
  });

  it('clamps day-of-month to valid month lengths', () => {
    expect(clampDayOfMonth(2024, 1, 31)).toBe(29); // Feb 2024 leap year
    expect(clampDayOfMonth(2023, 1, 31)).toBe(28);
    expect(clampDayOfMonth(2024, 3, 31)).toBe(30); // April
    expect(clampDayOfMonth(2024, 1, -1)).toBe(29); // last day
  });

  it('computes ISO week starts', () => {
    // Week 1 of 2024 starts Monday 2024-01-01
    expect(formatISODate(firstDayOfISOWeek(2024, 1))).toBe('2024-01-01');
  });

  it('computes calendar day deltas across DST', () => {
    expect(calendarDaysBetween(new Date(2024, 2, 8), new Date(2024, 2, 12))).toBe(4);
  });
});
