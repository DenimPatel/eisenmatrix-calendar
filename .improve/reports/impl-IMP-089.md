# impl-IMP-089 — atomic occurrence status writes

## Files changed
- `src/db/repository.ts`
- `src/domain/itemActions.ts`
- `src/domain/itemActions.test.ts`

## Approach
- Added `itemRepo.updateAtomic(id, build)`: a single `db.transaction('rw', db.items, ...)` reads
  the row, calls `build` on the normalized item, merges the returned patch and writes the row
  before the transaction commits. It returns `{ before, after }` or `undefined` when the row is
  missing or `build` returns `null` (true no-op). It does not call `update()` or any other method
  that opens a transaction, so no Dexie transaction is nested.
- Added `patchItemAtomic` in `itemActions.ts`, which uses `updateAtomic` and keeps the existing
  `patchItem` semantics: it appends `buildHistory` based on the transaction's `before` snapshot,
  pushes one undo entry that restores `before`, and honours the silent/undo-label options.
- `setStatus` now runs both branches through `patchItemAtomic`. The occurrence merge, legacy
  override cleanup, non-occurrence `completedAt` preservation and the no-op checks all execute
  inside the transaction against the current row, so two unawaited calls for different keys
  serialize and cannot write a stale map. A concurrent no-op returns `null` before `put`.
- Undo entries are pushed after each transaction commits, so the stack order matches the
  transaction order; two real changes produce exactly two entries and two undos restore the
  original map.

## Verification
- Added `setStatus (occurrences) > persists both keys when two status writes run concurrently`,
  firing `Promise.all([setStatus(stale, 'done', K1), setStatus(stale, 'done', K2)])` from one
  stale snapshot. It asserts both keys persist, the undo stack has two entries, the first undo
  leaves exactly one key and the second restores an empty occurrence map.
- Confirmed the new test fails against the previous implementation (K1 was lost) and passes with
  the transaction; the existing sequential-merge and no-op tests still pass.

## Commands / results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (42 files, 455 tests; baseline 454 + 1 new)
- `npm run build` — PASS (PWA precache generated)
- `npm run format:check` — PASS

## Uncertain
- The atomic path is limited to `setStatus`; other `patchItem`/`saveItem` callers keep their
  existing read-then-write semantics by design (small, targeted change).
- Undo ordering relies on IndexedDB serializing read-write transactions on the same store; the
  concurrent test verifies the resulting restore order under fake-indexeddb.
