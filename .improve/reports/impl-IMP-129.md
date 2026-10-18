# impl-IMP-129 / IMP-130 — Shopping list Dialog + destructive-action undo

**Status:** done

## IMP-129 — Replace `window.prompt` for a new shopping list with the app Dialog

`src/features/shopping/ShoppingView.tsx`

- The "List" button no longer calls `window.prompt`. It opens the app `Dialog`
  (`src/components/ui/Dialog.tsx`) titled "New shopping list" with a `Field`-labelled
  input (`List name`, native `<label for>` association via `Field`) that is focused on
  open through `Dialog`'s `initialFocusRef`. The `Dialog` supplies `useFocusTrap`,
  Escape-to-close and the overlay stack, so the capture is focus-trapped and announced
  like every other capture in the app.
- Enter in the input and the footer "Create" button both call `addList`, which trims the
  name, creates the `shopping` list through `listRepo.create`, selects it
  (`setActiveListId`), clears the draft and closes the dialog. "Create" is disabled while
  the field is blank.
- Escape and "Cancel" close the dialog with no write; `openListDialog` clears any stale
  draft each time it is opened.
- No `window.prompt` remains in the source.

## IMP-130 — Confirm or undo for destructive bulk and shopping actions

Per the backlog guidance, the preferred safe pattern is undo via the existing undo stack
plus a toast (AGENTS.md: mutations go through `itemActions`), and a confirm Dialog is used
only where undo is infeasible. Both destructive actions already route through
`deleteItems` in `src/domain/itemActions.ts`, which deletes, pushes an undo entry onto the
store's undo stack, and emits a toast with an `Undo` action
(`toastWithUndo` → `useUiStore.undo`):

- `src/features/list/ListView.tsx` `bulkDelete` → `deleteItems(selectedItems)`.
- `src/features/shopping/ShoppingView.tsx` `clearPurchased` → `deleteItems(purchased)`.

The undo entry restores the selection *and every transitive descendant*
(`itemActions.test.ts` already covers `deleteItems` undo), and it is reachable both from
the toast's Undo button and the global `⌘/Ctrl+Z` undo shortcut. No production change was
needed here beyond locking the behaviour in with tests; no confirm Dialog was added
because undo is feasible for both actions (so no dialog is used where it is not needed).
`ItemEditorSheet` delete and the two bulk actions are the only destructive entry points,
and all are undoable; `Settings → Reset all data` already uses `ConfirmDialog`.

## Tests

`src/features/shopping/ShoppingView.test.tsx` (new):

1. "List" opens `[role="dialog"]` with a labelled input whose `for` matches the input id;
   `window.prompt` is never called.
2. Enter with a name creates the `shopping` list, closes the dialog and selects it in the
   filter (asserted against `listRepo.all()`).
3. Escape closes the dialog and writes nothing (no list named as typed).
4. `Clear purchased` deletes the purchased rows, leaves the unpurchased row, exposes an
   `Undo` toast, and the toast action restores the rows.
5. `Clear purchased` is disabled with nothing purchased and pushes no toast.

`src/features/list/ListView.test.tsx` — new `ListView bulk delete undo` suite: selecting a
row and pressing Delete removes it and leaves the sibling; the `Undo` toast restores the
deleted row (DB re-checked after undo).

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check` — all pass
(59 files, 600 tests).

## Browser verification

Built `dist/`, ran `npm run preview` on 4173, reset service-worker registrations and
caches, then reloaded via `about:blank`.

- Shopping → "List": the app Dialog opens with the "New shopping list" heading, a focused
  `List name` field and a disabled `Create`; typing `Hardware` and pressing Enter creates
  the list, closes the dialog and selects it in the "Filter by list" select.
- Escape closed the dialog with no list created.
- Added two shopping items, marked both purchased, `Clear purchased` removed them and
  showed the `Deleted 2 items` / `Undo` toast; the toast's Undo restored both rows
  (`2/2 purchased`), as did `⌘Z`.
- Lists view: selecting rows and Delete removed them and showed a `Deleted N items` /
  `Undo` toast; Undo restored the rows (including the shopping rows).

Screenshot: `.improve/artifacts/IMP-129/shopping-new-list-dialog.png`. Preview server
stopped afterwards.

## Notes

- No changes outside the item; no commit or push.
- `src/features/shopping/ShoppingView.test.tsx` is a new file; `ListView.test.tsx` and
  `ShoppingView.tsx` are the only modified files.
