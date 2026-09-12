import { useMemo } from 'react';
import { expandOccurrences } from '@/domain/recurrence';
import type { Item, Occurrence } from '@/types';

export function useOccurrences(items: Item[], from: Date, to: Date): Occurrence[] {
  const fromTime = from.getTime();
  const toTime = to.getTime();
  return useMemo(() => {
    const fromDate = new Date(fromTime);
    const toDate = new Date(toTime);
    return items
      .flatMap((item) => expandOccurrences(item, fromDate, toDate))
      .sort((a, b) => {
        const aTime = a.start ?? a.occKey;
        const bTime = b.start ?? b.occKey;
        return aTime.localeCompare(bTime);
      });
  }, [items, fromTime, toTime]);
}
