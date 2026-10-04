import { describe, expect, it } from 'vitest';
import { WEEKDAY_LABELS, weekdayLabels } from './labels';

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
