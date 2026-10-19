# Discovered while implementing IMP-141

Unrelated to the IMP-141 fix; recorded for triage.

1. **`deleteItems` pluralization** — `src/domain/itemActions.ts`. With the honest
   descendant count, a single-row delete now reads "Deleted 1 items" / "Delete 1 items".
   The same awkwardness already exists in `createItemsPersisted` ("Create 1 items"), so no
   pluralization helper exists yet. Cosmetic.

2. **`undo(id)` reads the stack snapshot before awaiting `entry.run()`** —
   `src/store/useUiStore.ts`. Two `undo(id)` calls started in the same tick both capture the
   same `stack`, so the second write can restore the first removal. Undo runs are
   user-driven and effectively serial, so this is a latent-only concern; a functional
   `set((s) => …)` removal would remove the entry from the live stack instead. Out of scope
   for IMP-141.

3. **`pruneItemReminders` boot pass pushes no undo entry** — intentional (documented in
   `itemActions.ts`); noted only because it is the one `itemRepo` mutation in that file
   without history/undo, so it will not appear as a stack entry when auditing undo
   coverage.
