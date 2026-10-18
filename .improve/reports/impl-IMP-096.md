# impl-IMP-096 — make habit streak derivation atomic with the occurrence toggle

## Files changed
- `src/domain/itemActions.ts`
- `src/domain/itemActions.test.ts`

## Approach
- Added `streakPatch(item)`: returns `{ data: { ...item.data, streak } }` for a habit when the
  derived streak differs from the stored one, else `null`. It is a pure function of the candidate
  item, so it can run inside the write transaction.
- `setStatus` now folds the derived streak into the same `patchItemAtomic` build callback for both
  branches (occurrence and whole-item). The build computes the post-write occurrences/status, then
  computes `habitStreak` from that candidate state and merges the streak into the same patch, so
  `updateAtomic` writes the occurrence map and the streak in one `put`. No repository change was
  needed — the existing `itemRepo.updateAtomic` (IMP-089) already provides the transaction seam.
- The no-op guard is preserved: the occurrence branch returns `null` when neither the occurrence
  state nor the legacy override changed, and the whole-item branch returns `null` when status and
  `completedAt` already match. A true no-op therefore still writes nothing and pushes no undo.
- `toggleDone` no longer re-reads the row and issues a second `patchItem`; it just calls
  `setStatus`, which keeps exactly one undo entry per real change (the entry still snapshots the
  pre-toggle row, so one undo restores both status and streak).

## Verification
- `toggleDone (habit) > derives the streak atomically so concurrent toggles match the final
  state`: fires `Promise.all([toggleDone(before, yesterday), toggleDone(before, today)])` from one
  stale snapshot, then asserts both keys persisted and `after.data.streak` equals
  `habitStreak(after)` (final state) with `current === 2` and two undo entries.
- `toggleDone (habit) > writes the occurrence and the derived streak in a single row write`: counts
  Dexie `creating`/`updating` hook calls around one habit toggle and asserts exactly one row write.
  Confirmed this test fails against the pre-change implementation (2 writes) and passes after
  (1 write), so the atomicity criterion is non-vacuous.
- Existing habit tests still pass unchanged: streak history entry + undo restore, single undo
  entry, stale-prop streak computation, and the `setStatus` sequential/concurrent/no-op tests.

## Commands / results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (46 files, 506 tests; baseline 504 + 2 new)
- `npm run format:check` — PASS (`prettier --write` on both changed files, unchanged)

## Uncertain
- The single-write hook test depends on Dexie firing `updating` for `put` on an existing row under
  fake-indexeddb; it passed here and failed on the old two-write path.
- `streakPatch` is now applied by `setStatus` for habits (not only by `toggleDone`), so any other
  habit status write keeps `data.streak` in sync as a side effect. No non-toggle habit status
  writer exists today; the existing no-op test still passes.
- Not addressed (separate item): IMP-097, the remaining `patchItem` read-then-write occurrence
  writers.
