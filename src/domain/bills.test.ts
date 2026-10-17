import { describe, expect, it } from 'vitest';
import { sumRecordedPayments } from './bills';
import { createItem } from './itemFactory';
import type { BillItem } from '@/types';

const OCC_KEY = '2026-10-01';

function bill(amount: number, payment?: number): BillItem {
  return createItem({
    kind: 'bill',
    start: OCC_KEY,
    data: {
      amount,
      payments: payment === undefined ? {} : { [OCC_KEY]: { paidAt: Date.now(), amount: payment } },
    },
  }) as BillItem;
}

describe('sumRecordedPayments', () => {
  it('sums each recorded payment amount and ignores bills without payments', () => {
    const electricity = bill(100, 42.5);
    const internet = bill(60, 65);
    const water = bill(30);

    const occurrences = [electricity, internet, water].map((item) => ({ item, occKey: OCC_KEY }));

    expect(sumRecordedPayments(occurrences)).toBe(107.5);
  });

  it('does not use the currently edited bill amount', () => {
    const rent = bill(1000, 750);
    const edited = {
      ...rent,
      data: { ...rent.data, amount: 1200 },
    };

    expect(sumRecordedPayments([{ item: edited, occKey: OCC_KEY }])).toBe(750);
  });
});
