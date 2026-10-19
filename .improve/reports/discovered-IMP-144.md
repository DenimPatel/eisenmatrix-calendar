# Discovered while implementing IMP-144 (unrelated findings)

## 1. The per-occurrence state map is still unvalidated (low, adjacent)

`asOccurrences` (`src/lib/itemValidation.ts`) still accepts any plain object and casts it to
`Item['occurrences']` without checking the `OccurrenceState` entries
(`{ status: OccurrenceStatus; completedAt: number | null; notes?: string }`). A payload with
`occurrences: {"2026-03-09": {"status": 5}}` imports cleanly; `occurrenceState` in
`src/domain/recurrence.ts` then surfaces a non-string `status` on the `Occurrence`, which flows
into status labels/rendering. This is the same class of gap IMP-144 closed for `recurrence.
overrides`, but it is a distinct map and does not reach the `useOccurrences` `localeCompare`
crash (the crash came from `overrides.start`). Out of scope for IMP-144; no item currently
covers the `occurrences` map. Consider extending the same per-field coercion to it.

## 2. `asObjectArray` accepts untyped reminder/checklist entries (informational)

`reminders` and `checklist` are coerced only to "array of plain objects"; their inner fields are
never type-checked. This predates IMP-144 and is covered by the IMP-038/111 item-level coercion
scope, so no change was made. Noted only because it is the same "trusted-shape" pattern.
