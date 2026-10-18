# impl-IMP-097 — serialize the remaining occurrence edit writers

## Files changed
- `src/domain/itemActions.ts`
- `src/domain/itemActions.test.ts`

## Approach
The remaining read-then-write paths from `discovered-IMP-089.md` now run their read-modify-write
inside `itemRepo.updateAtomic`'s transaction (IMP-089's seam); no repository change was needed.

- `patchItem` now reads the row, appends `buildHistory`, merges and writes in one transaction and
  derives the undo snapshot from the transactional `before`. This covers `updateRecurring` scope
  `all`, `archiveItem`, `restoreItem`, `setPriority` and `updateOccurrence`, whose pre-computed
  patch is now applied to the latest row instead of a stale one.
- `saveItem`'s edit branch uses `updateAtomic`, so its history append and undo snapshot come from
  the row the transaction reads. The create branch is unchanged.
- `skipOccurrence` and `updateRecurring` scope `occurrence` were moved onto `patchItemAtomic`: the
  exceptions list / override map is now built inside the transaction from the stored row, so two
  concurrent edits of different occurrences serialize and neither drops the other's key. Their
  no-op guards (missing rule, already-skipped key, empty patch) and silent/undo semantics are
  preserved; `skipOccurrence` still toasts only after a real write.

The `future` split branch was left unchanged: it is a multi-row `createMany` of a head plus a new
tail, not a read-then-`patchItem` path, and is outside the hazard described in the item's Intent.

## Verification
- `skipOccurrence > keeps both skipped keys when two skips run concurrently`: `Promise.all` of two
  skips of different occurrences from one stale snapshot; asserts both keys persist and the two
  undos peel them back one at a time.
- `updateRecurring (scope: occurrence) > keeps both overrides when two occurrence edits run
  concurrently`: two unawaited edits of different occurrences; asserts both overrides persist and
  two undos restore them in order.
- Non-vacuous: both new tests were run against `git show HEAD:src/domain/itemActions.ts` (pre-change)
  and both failed with a lost key/override, then passed against the changed tree. 10/10-style
  determinism follows from the IMP-089 concurrency test's stable behaviour under fake-indexeddb.
- Sequential behaviour unchanged: all existing `saveItem`, `skipOccurrence` and `updateRecurring`
  (occurrence/future/all) tests, including history, undo labels/count and no-op tests, still pass.

## Commands / results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (46 files, 508 tests; baseline 506 + 2 new)
- `npm run format:check` — PASS (`prettier --write` on both changed files, unchanged)

## Uncertain
- `updateRecurring` scope `future` (the head+tail `createMany`) remains non-atomic; concurrent
  splits are unreachable today and would need a new multi-row repository primitive.
- Undo ordering relies on IndexedDB serializing read-write transactions on `items`; the new tests
  exercise that ordering and were stable in this run.
