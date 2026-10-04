# discovered-IMP-004 — out-of-scope findings

Findings noticed while implementing IMP-004; not fixed here to stay in scope.

- `deleteItems([])` (empty selection) still pushes a no-op `Delete 0 items` undo entry and a
  `Deleted 0 items` toast, clobbering the user's previous undo entry.
  `ShoppingView.clearPurchased` (`src/features/shopping/ShoppingView.tsx:87-92`) calls it with a
  possibly empty array whenever nothing is purchased, so pressing the button with an empty
  cart destroys undo history for an unrelated prior action. An early `if (!items.length) return;`
  would fix it; left alone to keep this change to the cascade behavior only.
- Cascade collection is one `collectDescendants` walk per selected item (N queries for N
  selections). Fine at this scale and it reuses the indexed `parentId` lookup, but a
  repository-level `removeManyWithChildren(ids)` doing a single seeded BFS would be O(1) queries.
  Not worth it while bulk selections are hand-picked items.
- Bulk delete in `ListView` still clears the selection but never surfaces the new
  descendants cascade in copy ("Delete N items" counts only the selected rows, not the rows
  actually removed). Purely cosmetic.
- `src/domain/itemActions.test.ts` (and other files, per `verify-IMP-003.md:164-173`) is not
  `prettier --check` clean at HEAD; a repo-wide `npm run format` sweep is still pending. My
  added test code is Prettier-clean; I left the pre-existing `relationships` helper untouched
  so this diff stays scoped.