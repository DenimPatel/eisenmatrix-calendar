# impl-IMP-076 — setStatus merges into the persisted occurrence map

## Files changed
- `src/domain/itemActions.ts`
- `src/domain/itemActions.test.ts`

## Approach
- `setStatus` now re-reads the row (`itemRepo.get(item.id)`) before computing the patch and
  applies `occurrenceStateFor` / `withoutOverrideStatus` to that persisted row. The write is
  therefore a merge into the current map, not the caller's render snapshot; a sibling
  occurrence written after the snapshot survives.
- The non-occurrence branch also compares against the persisted row. `completedAt` for
  `done` preserves an existing timestamp, and a write with the same status and
  `completedAt` returns before `patchItem`, so it writes nothing and pushes no undo entry.
- `toggleDone` was already re-reading after `setStatus` for the streak and passing
  `trackUndo: false`; that path is unchanged and now inherits the authoritative occurrence
  write, keeping one undo entry for the whole toggle.
- Added tests: two `setStatus` calls for different keys from one captured stale item persist
  both and two undos restore both; a repeated status write against an already-done persisted
  occurrence leaves the row, history and undo stack untouched.

## Commands / results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (33 files, 375 tests)

## Uncertain
- Preserving `stored.completedAt` when re-marking a non-occurrence item `done` is required
  by AC4's `same completedAt` comparison and matches the occurrence branch, but it changes
  the previous behavior of refreshing `completedAt` on a redundant `done` write.
