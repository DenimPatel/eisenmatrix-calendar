# impl-IMP-116 — Preserve a recurring item's wall-clock end across DST

**Status:** done

## Change

`src/domain/recurrence.ts`

- Replaced `durationMs` (real elapsed ms between two local wall-clock instants) with
  `wallClockLengthMinutes`: the series length as wall-clock minutes, i.e.
  `differenceInCalendarDays(end, start) * 1440 + (endClock − startClock)`. A date-only endpoint
  counts as midnight (no time-component guard), so an inconsistent series — date-only start with
  a timed end — matches the previous real-elapsed behaviour outside DST. Returns `null` for a
  non-forward range, preserving the old fallback of substituting the start.
- `deriveOccurrenceEnd` now adds those wall-clock minutes to the *resolved* occurrence start
  via local date-part construction (`new Date(y, m, d, h, min + minutes)`), so the clock time
  is stable across a DST transition in both directions. Adding wall-clock minutes (rather than
  real ms) also keeps the series' *length* semantics when an override moves an occurrence's
  start time.

Non-DST days are unchanged (wall-clock minutes equal real elapsed time there); all-day and
date-only ranges keep the existing `formatISODate(start)` path.

## Tests

`src/domain/recurrence.dst.test.ts` (new). Pins `process.env.TZ = 'America/New_York'` for the
file (Node re-reads `TZ` per Date operation; original value restored in `afterAll`). Cases:

1. Weekly series `2026-03-01T01:00`–`04:00` crossing spring-forward → every occurrence ends `T04:00`.
2. Series starting on the transition day `2026-03-08T01:00`–`04:00` → every occurrence ends `T04:00`.
3. Fall-back direction (`2026-10-25`) keeps `T04:00`.
4. Non-DST timed series and all-day series unchanged.
5. `recurrence.test.ts`: date-only start + timed end + timed override derives the end from
   midnight (`2026-01-07T04:30`), matching HEAD in non-DST zones.

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check` — all pass
(47 files, 531 tests). Also green under `TZ=UTC` and `TZ=Asia/Kolkata`.

## Notes

- The vitest config has no `TZ` support, so the zone is set inside the test file rather than
  in config; `afterAll` restores it, deleting `process.env.TZ` when it was originally undefined.
- Verifier follow-up (verify-IMP-116 Issue 1): the initial time-component guard changed
  date-only-start/timed-end behaviour; it was removed so only genuine DST handling changes.
- No unrelated problems found.
