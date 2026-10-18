import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '@/domain/quickadd';
import { QUICK_ADD_EXAMPLES } from './helpContent';

describe('documented quick-add examples', () => {
  it('documents at least one example', () => {
    expect(QUICK_ADD_EXAMPLES.length).toBeGreaterThan(0);
  });

  for (const example of QUICK_ADD_EXAMPLES) {
    it(`parses "${example.input}" as documented`, () => {
      const now = example.now ? new Date(example.now) : new Date();
      expect(parseQuickAdd(example.input, now)).toMatchObject(example.expected);
    });
  }
});
