# IMP-082 — Implementation report

**Status:** implemented (all four gates pass; backlog state untouched, no commit)

## Change

| File | Change |
| --- | --- |
| `src/domain/recurrence.ts` | New exported pure helper `hasOccurrenceOnOrAfter(item, fromKey)` (`:337-361`). Walks `candidateDates` with the same `count`/`until` capping and count-consumption order as `expandOccurrences`, returning whether any candidate day falls on or after the key. Used to decide whether a "this and future" split has a tail at all. |
| `src/domain/itemActions.ts` | `updateRecurring`'s `future` branch: (a) refuses to split when `!hasOccurrenceOnOrAfter(stored, occKey)` — no head/tail write, one `info` toast ("Nothing to split — the series has no later occurrences"), returns `false`, so the persisted series is byte-identical to the unsplit render; (b) after building `tailPatched`, drops `tail.end` when the patched `end` precedes the patched `start`, so no persisted row has `end < start`. |
| `src/domain/recurrence.test.ts` | +3 tests in a new `hasOccurrenceOnOrAfter` describe. |
| `src/domain/itemActions.test.ts` | +2 tests in `updateRecurring (scope: future)`. |

No signature changes: `splitSeries` still returns `{ head, tail }`, so the IMP-023 property
sweep and every existing `splitSeries` unit test are untouched.

## Acceptance criteria

1. **No empty tail row** — `src/domain/itemActions.ts:370-376`. A split past a passed `until`
   or a consumed `count` returns `false` before `splitSeries` is called; nothing is written,
   no undo entry is pushed, and the info toast explains why. Covered by "writes no tail when
   the split lands past the series' last occurrence" (asserts `itemRepo.all()` equals the
   pre-call row, empty undo stack, the toast, and that every persisted recurring row still
   expands to ≥1 occurrence).
2. **Inverted tail range normalized** — `src/domain/itemActions.ts:392-396`. When a start-only
   edit leaves the shifted `end` behind the new `start`, `end` is dropped (`null`) before the
   write. Covered by "drops a tail end the patched start leaves behind", which also sweeps all
   persisted rows for `end >= start`.
3. **Mid-series split invariants hold** — the IMP-023 sweep
   ("reproduces the unsplit occurrence set exactly across the whole rule space", >2000 cases)
   and the timed/skipped-day sweep both still pass unchanged; `splitSeries` was not modified.
4. **Guard is a no-op for count/unbounded/mid-range until** — `hasOccurrenceOnOrAfter` returns
   `true` for an unbounded series, a count with remaining slots and an `until` beyond the split,
   so the normal path is unchanged; covered directly in the `hasOccurrenceOnOrAfter` unit tests
   and by all pre-existing future-scope tests.

## Verification

- Mutation checks (both guards are load-bearing): removing the empty-tail guard fails
  "writes no tail …" (`written` becomes `true`); removing the `end`-normalization line fails
  "drops a tail end …" (`tail.end` stays `2026-07-20T10:00`). Source restored after each.
- `npm run typecheck` clean · `npm run lint` clean · `npm run test` **43 files / 483 tests
  passed** (baseline 478; +5) · `npm run format:check` clean.

## Residual (out of scope)

`hasOccurrenceOnOrAfter` intentionally ignores `exceptions`, matching `occurrencesBeforeKey`
and the item's Notes ("the tail's wholesale copy of `exceptions`/`overrides` … stays out of
scope"). A split whose only remaining candidate days are all excepted still writes a tail that
expands to zero *visible* occurrences; logged in `discovered-IMP-082.md`.
