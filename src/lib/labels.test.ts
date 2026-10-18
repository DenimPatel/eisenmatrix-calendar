import { describe, expect, it } from 'vitest';
import { WEEKDAY_LABELS, priorityBadgeClasses, statusClasses, weekdayLabels } from './labels';
import type { ItemStatus } from '@/types';

describe('weekdayLabels', () => {
  it('starts on Sunday when weekStartsOn is 0', () => {
    expect(weekdayLabels(0)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('starts on Monday when weekStartsOn is 1', () => {
    expect(weekdayLabels(1)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('always returns seven labels and never mutates the source order', () => {
    expect(weekdayLabels(0)).toHaveLength(7);
    expect(weekdayLabels(1)).toHaveLength(7);
    expect([...WEEKDAY_LABELS]).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});

describe('statusClasses', () => {
  const statuses: ItemStatus[] = ['done', 'doing', 'cancelled', 'todo'];

  it('returns a distinct class string for every status', () => {
    const classes = statuses.map(statusClasses);
    expect(new Set(classes).size).toBe(statuses.length);
  });

  it('carries an explicit dark-mode variant on the coloured statuses', () => {
    for (const status of ['done', 'doing', 'cancelled'] as ItemStatus[]) {
      expect(statusClasses(status)).toContain('dark:');
    }
  });

  it('styles todo with theme-aware semantic tokens instead of a dark: override', () => {
    // The default branch relies on bg-elevated/text-muted, which already flip with the
    // theme, so it intentionally has no `dark:` variant.
    const todo = statusClasses('todo');
    expect(todo).toContain('bg-elevated');
    expect(todo).toContain('text-muted');
    expect(todo).not.toContain('dark:');
  });

  it('styles the done status as a green completed chip', () => {
    expect(statusClasses('done')).toContain('emerald');
  });
});

describe('priorityBadgeClasses', () => {
  it('distinguishes high from low priority', () => {
    expect(priorityBadgeClasses('high')).not.toBe(priorityBadgeClasses('low'));
  });

  it('is dark-mode-safe for both priorities', () => {
    expect(priorityBadgeClasses('high')).toContain('dark:');
    expect(priorityBadgeClasses('low')).toContain('dark:');
  });
});
