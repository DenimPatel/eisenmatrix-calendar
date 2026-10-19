# impl-IMP-139 — Preserve per-occurrence state across a "this and future" split

Status: DONE.

## Change

`src/domain/recurrence.ts` (`splitSeries`): the tail was built with `occurrences: {}` while
the head spread the *whole* source map. Now the source `occurrences` map is partitioned at
the split key `K` (occurrence keys are local `YYYY-MM-DD`, so a plain string compare orders
them): the head keeps only keys `< K`, the tail keeps only keys `>= K` with identical
values. No other behavior changed; the IMP-023/IMP-037/IMP-113 count/until/byWeekday and
tail-anchor fixes are untouched.

The action path needed no change: `updateRecurring(…, 'future', …)` already persists the
`splitSeries` head verbatim and spreads `...tail` (now carrying the partition) before the
`tailPatch`. The editor patch does not carry `occurrences`, so the partition survives.

## Tests

- `src/domain/recurrence.test.ts`: the vacuous `tail.occurrences === {}` assertion (which
  only marked an occurrence *before* the split) is replaced by a real partition assertion
  with post-split `done` state; added a test that re-expands head+tail and asserts the
  resolved status of every occurrence matches the unsplit series.
- `src/domain/itemActions.test.ts`: added a case through `updateRecurring(…, 'future', …)`
  with `done`/`cancelled` states on both sides of the split, asserting the head keeps only
  pre-split keys, the tail carries its states, and re-expansion reproduces every status.

Mutation sensitivity: reverting the tail partition fails 3 tests; reverting the head
partition fails 2 tests.

## Gates

`npm run typecheck`, `npm run lint`, `npm run test` (74 files / 739 tests),
`npm run format:check`, `npm run build` — all green.

## Files changed

- `src/domain/recurrence.ts`
- `src/domain/recurrence.test.ts`
- `src/domain/itemActions.test.ts`
