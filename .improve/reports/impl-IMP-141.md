# IMP-141 — Make a toast's Undo revert the action it labels

**Status:** done
**Category:** correctness / undo integrity
**Source:** `.improve/FEATURES.md` §IMP-141; `.improve/reports/discover4-followups.md` F1

## Change

**`src/store/useUiStore.ts`**

- `pushUndo(entry)` now returns the `id` of the entry it created (`UndoEntry.id` already
  existed; it was never surfaced).
- `undo(id?: string)`:
  - with an id, finds the matching entry, removes exactly that entry, then runs it; an id
    that is no longer on the stack (evicted by the 25-entry cap, or already undone) returns
    `false` without touching any other entry;
  - with no id, keeps the previous top-pop behavior used by `⌘Z`.

**`src/domain/itemActions.ts`**

- The local `pushUndo` wrapper returns the entry id.
- `toastWithUndo(message, undoId)` captures the id and its `onAction` calls `undo(undoId)`.
  A `false` result pushes a neutral "Undo expired" toast instead of reverting something else.
- `deleteItem` and `deleteItems` pass the id of the entry they just pushed.
- `deleteItems` now labels the entry and toast with `deleted.length` — the selection **plus
  every newly-collected descendant** — instead of `items.length` (top-level only). The
  `deleteItems([])` early return from IMP-061 is unchanged (no undo entry, no toast).

No visual redesign; "Saved"/error toast paths are untouched.

## Tests

**New `src/store/useUiStore.test.ts`** (5 cases): `pushUndo` returns a stable id; `undo(id)`
runs/removes only that entry; `undo()` (no id) pops the newest; a missing/already-undone id
is a no-op that does not fall back to the top; the 25-entry cap evicts the oldest id and
`undo(id)` for it returns `false` without running anything; empty stack returns `false`.

**`src/domain/itemActions.test.ts`**: new "toast Undo scoping" suite plus a
`deleteItems` count case.
- Delete A → `saveItem` edits B → invoke A's toast action → A is restored and B keeps the
  edit; the edit entry is the only one left on the stack.
- Same setup, `undo()` with no id → the newer edit reverts and the delete stays applied.
- Evicted entry: 25 filler entries push A's delete entry off the cap → the toast action
  leaves storage and the stack untouched and adds an "Undo expired" toast.
- `deleteItems([parent])` with two descendants reports `Delete 3 items` / `Deleted 3 items`.

Falsification check: reverting `toastWithUndo` to the global `undo()` makes the scoping test
restore A *and* revert B (B becomes "Beta"), so the suite pins the fix.

## Verification (all pass)

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 75 files / 760 tests passed
- `npm run format:check` — all files formatted
- `npm run build` — built, `dist/sw.js` generated

Not committed (per instruction). No backlog/state files edited.

## Files changed

- `src/store/useUiStore.ts`
- `src/domain/itemActions.ts`
- `src/store/useUiStore.test.ts` (new)
- `src/domain/itemActions.test.ts`
