import { formatTime } from '@/lib/date';

/**
 * Card time label: the resolved occurrence start when the caller supplies one,
 * otherwise the series anchor `item.start`.
 */
export function resolveCardTime(
  occurrenceStart: string | null | undefined,
  itemStart: string | null,
): string {
  return formatTime(occurrenceStart ?? itemStart);
}
