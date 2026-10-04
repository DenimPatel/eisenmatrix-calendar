# impl-IMP-003 — Undo of a deleted parent restores descendants

## Files
- `src/db/repository.ts`: added `itemRepo.collectDescendants(id)` which reuses the exported
  cycle-safe `collectDescendantIds(id)` walker (IMP-002) and hydrates the ids via
  `bulkGet`, filtering out missing rows. Read-only; no schema change.
- `src/domain/itemActions.ts` (`deleteItem`): captures the descendant *items* before
  deletion, then the pushed undo closure calls `itemRepo.createMany([item, ...descendants])`
  instead of recreating only the parent. `removeWithChildren` is still used for the delete.
- `src/domain/itemActions.test.ts` (new): fake-indexeddb tests that seed
  parent → child → grandchild; after `deleteItem` the table is empty; invoking the pushed
  undo closure via `useUiStore.getState().undo()` restores the same item count and the same
  `(id, parentId)` relationship set as pre-delete. A second test asserts an unrelated item
  is untouched.

## Approach
Capture-before-delete keeps the undo closure self-contained (it holds the actual `Item`
snapshots, including `parentId`), so restoration preserves hierarchy exactly without a
second DB walk at undo time. Reuses IMP-002's walker; no new traversal logic.

## Acceptance criteria
1. Descendants captured before deletion — yes (`collectDescendants`).
2. Undo recreates parent + every descendant via `createMany` — yes.
3. Count and parent/child relationships match exactly — asserted by test.

## Commands + results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (12 files, 59 tests)

## Uncertainties
- None in scope. IMP-004 (bulk `deleteItems` cascade) remains separate and still uses
  `removeMany`; it can reuse `collectDescendants` if desired.
