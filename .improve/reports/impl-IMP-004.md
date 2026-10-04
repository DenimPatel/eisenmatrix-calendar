# impl-IMP-004 — Cascade delete in bulk `deleteItems`

## Files
- `src/domain/itemActions.ts` (`deleteItems`, `:115-131`): collects the descendant items of
  every selected item with `itemRepo.collectDescendants` (IMP-003's hydrated wrapper over
  IMP-002's cycle-safe `collectDescendantIds`), seeds a dedupe `Set` with the selection ids,
  deletes the union with a single `itemRepo.removeMany([...ids])`, and pushes an undo closure
  that restores the captured selection + descendants via `createMany`. Capture-before-delete
  matches `deleteItem`; no new traversal logic and no repository change.
- `src/domain/itemActions.test.ts`: added a `deleteItems` describe block (3 tests) reusing the
  existing `task()` / `relationships()` helpers.
- `.improve/FEATURES.md`: IMP-004 marked DONE.

## Approach
`deleteItem` already had the capture pattern from IMP-003 (`collectDescendants` →
`removeWithChildren` → undo `createMany([item, ...descendants])`); `deleteItems` now mirrors it
for a set. Seeding the dedupe `Set` with the selected ids handles a selection that contains both
a parent and its child (the child is reachable as both a selection member and the parent's
descendant) so nothing is deleted twice or restored twice. Deleting the union in one
`removeMany` keeps bulk delete atomic from the caller's perspective and avoids a new
`removeManyWithChildren` repository method — the spec's note ("reuse the descendant-aware
repository method") is satisfied by `collectDescendants`.

## Acceptance criteria
1. Each selected item **and** all transitive descendants deleted — yes; union of selection ids
   and every `collectDescendants` result is passed to `removeMany`. Test 1 asserts a
   parent → child → grandchild fixture empties completely.
2. Undo closure restores every deleted item (selection + descendants) — yes; the closure closes
   over the deduped `deleted` array. Tests 2 and 3 compare post-undo count and the full
   `(id, parentId)` relationship set against the pre-delete snapshot.
3. Non-selected sibling items untouched — yes; test 2 keeps an unrelated item unselected,
   asserts it survives the delete, and asserts it is still present after undo.

## Verification
- Regression check: reverting `deleteItems` to the pre-fix body makes exactly the 3 new tests
  fail (`3 failed | 2 passed`), so they are not vacuous.
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (12 files, 62 tests; was 59)
- `npm run build` — PASS (injectManifest → `dist/sw.js`, 18 precache entries)

## Notes / uncertainties
- `ShoppingView.clearPurchased` also calls `deleteItems`; its cascade behavior is now correct
  too (shopping items normally have no children, so no visible change).
- `ListView.tsx` needed no change: the defect was in `deleteItems`, and the bulk action already
  clears the selection afterwards.
- Out-of-scope observations are in `.improve/reports/discovered-IMP-004.md`.
- Not committed (per run instructions).