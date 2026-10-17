import { describe, expect, it } from 'vitest';
import {
  QUADRANTS,
  QUADRANT_IDS,
  itemsInQuadrant,
  priorityScore,
  quadrantOf,
  type QuadrantId,
} from './eisenhower';
import { createItem } from './itemFactory';
import type { Item, Priority } from '@/types';

const CASES: Array<{ urgency: Priority; importance: Priority; quadrant: QuadrantId }> = [
  { urgency: 'high', importance: 'high', quadrant: 'q1' },
  { urgency: 'low', importance: 'high', quadrant: 'q2' },
  { urgency: 'high', importance: 'low', quadrant: 'q3' },
  { urgency: 'low', importance: 'low', quadrant: 'q4' },
];

function makeItem(urgency: Priority, importance: Priority, title: string): Item {
  return createItem({ kind: 'task', title, urgency, importance });
}

describe('quadrantOf', () => {
  it.each(CASES)(
    'maps urgency=$urgency importance=$importance to $quadrant',
    ({ urgency, importance, quadrant }) => {
      expect(quadrantOf({ urgency, importance })).toBe(quadrant);
    },
  );

  it('maps an item with default priorities to q4', () => {
    const item = createItem({ kind: 'task' });

    expect(item.urgency).toBe('low');
    expect(item.importance).toBe('low');
    expect(quadrantOf(item)).toBe('q4');
  });

  it('agrees with the quadrant metadata used by the matrix', () => {
    for (const id of QUADRANT_IDS) {
      expect(quadrantOf(QUADRANTS[id])).toBe(id);
    }
  });
});

describe('priorityScore', () => {
  it('ranks the four quadrants in Eisenhower order with distinct scores', () => {
    const scores = QUADRANT_IDS.map((id) => priorityScore(QUADRANTS[id]));

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(new Set(scores).size).toBe(QUADRANT_IDS.length);
    expect(scores[0]).toBeGreaterThan(scores[scores.length - 1]);
  });

  it('increases strictly with urgency at each importance level', () => {
    for (const importance of ['high', 'low'] as const) {
      expect(priorityScore({ urgency: 'high', importance })).toBeGreaterThan(
        priorityScore({ urgency: 'low', importance }),
      );
    }
  });

  it('increases strictly with importance at each urgency level', () => {
    for (const urgency of ['high', 'low'] as const) {
      expect(priorityScore({ urgency, importance: 'high' })).toBeGreaterThan(
        priorityScore({ urgency, importance: 'low' }),
      );
    }
  });
});

describe('itemsInQuadrant', () => {
  const items = [
    makeItem('high', 'high', 'q1 first'),
    makeItem('low', 'high', 'q2 first'),
    makeItem('high', 'low', 'q3 first'),
    makeItem('low', 'low', 'q4 first'),
    makeItem('high', 'high', 'q1 second'),
    makeItem('low', 'high', 'q2 second'),
    makeItem('high', 'low', 'q3 second'),
  ];

  it.each(QUADRANT_IDS)('returns only %s items in input order', (quadrant) => {
    const result = itemsInQuadrant(items, quadrant);

    expect(result.every((item) => quadrantOf(item) === quadrant)).toBe(true);
    expect(result.map((item) => item.id)).toEqual(
      items.filter((item) => quadrantOf(item) === quadrant).map((item) => item.id),
    );
  });

  it('partitions every item into exactly one quadrant', () => {
    const partitioned = QUADRANT_IDS.flatMap((quadrant) => itemsInQuadrant(items, quadrant));

    expect(partitioned).toHaveLength(items.length);
    expect(partitioned.map((item) => item.id)).toEqual(
      expect.arrayContaining(items.map((item) => item.id)),
    );
    expect(new Set(partitioned.map((item) => item.id))).toEqual(
      new Set(items.map((item) => item.id)),
    );
  });

  it('returns an empty array when no item belongs to the quadrant', () => {
    expect(itemsInQuadrant([makeItem('high', 'high', 'urgent')], 'q4')).toEqual([]);
  });
});
