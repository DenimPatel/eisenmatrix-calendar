import type { Occurrence } from '@/types';

type PaymentOccurrence = Pick<Occurrence, 'item' | 'occKey'>;

export function sumRecordedPayments(occurrences: PaymentOccurrence[]): number {
  return occurrences.reduce((sum, { item, occKey }) => {
    if (item.kind !== 'bill') return sum;
    return sum + (item.data.payments?.[occKey]?.amount ?? 0);
  }, 0);
}
