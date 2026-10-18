import { formatISODateTime, hasTimeComponent } from '@/lib/date';
import type { ItemKind, Occurrence } from '@/types';

/** Kinds that carry no actionable outcome and must never headline the banner. */
const NON_ACTIONABLE_KINDS: ReadonlySet<ItemKind> = new Set<ItemKind>(['note']);

/** An occurrence is a candidate for "What's next" when it is open and actionable. */
export function isActionableOccurrence(occ: Occurrence): boolean {
  if (occ.status === 'done' || occ.status === 'cancelled') return false;
  return !NON_ACTIONABLE_KINDS.has(occ.item.kind);
}

/**
 * Pick the occurrence that should headline "What's next".
 *
 * A timed occurrence always wins over an all-day one; among timed occurrences the
 * earliest still-upcoming one is chosen, falling back to the most recently due when
 * they are all in the past. All-day occurrences are only considered when no timed
 * occurrence is pending, and they are returned without a time component so the
 * caller does not imply one.
 */
export function selectNextUp(occurrences: Occurrence[], now = new Date()): Occurrence | undefined {
  const pending = occurrences.filter(isActionableOccurrence);

  const timed = pending.filter((occ) => hasTimeComponent(occ.start));
  if (timed.length > 0) {
    const nowStamp = formatISODateTime(now);
    const upcoming = timed
      .filter((occ) => (occ.start as string) >= nowStamp)
      .sort((a, b) => (a.start as string).localeCompare(b.start as string));
    if (upcoming.length > 0) return upcoming[0];
    return [...timed].sort((a, b) => (b.start as string).localeCompare(a.start as string))[0];
  }

  const allDay = pending.filter((occ) => !hasTimeComponent(occ.start));
  return allDay.sort((a, b) => {
    const byStart = (a.start ?? a.occKey).localeCompare(b.start ?? b.occKey);
    return byStart !== 0 ? byStart : a.title.localeCompare(b.title);
  })[0];
}
