# Discovered findings — IMP-055 (occurrence-scoped delete)

Out-of-scope observations made while implementing IMP-055. Nothing here was fixed; none of it
is a regression from this change.

## 1. `EditorState.splitMode` is write-only state

`src/store/useUiStore.ts:24,106` — `openEditor(item, occurrenceKey, splitMode)` accepts a
`splitMode` and `closeEditor` resets it, but no reader exists: `ItemEditorSheet` keeps its own
local `scope` state (`:113`) and `useKeyboardShortcuts.test.tsx` only constructs the field. Two
sources of truth for the same concept is a standing source of confusion, and the store copy can
silently disagree with the editor's. Either read it in the sheet (single source of truth) or drop
it from `EditorState`.

## 2. `restoreItem` has no UI consumer — archived items are unrecoverable in-app

`src/domain/itemActions.ts:146` exports `restoreItem` (`archivedAt: null`), but only
`archiveItem` is wired (from `ListView`). Nothing lists archived items or offers an un-archive
control, so a user who archives cannot bring the item back except by restoring a backup. Same
class of dead seam as the `skipOccurrence` one IMP-055 closed.

## 3. Deletion is only reachable from the editor sheet

`deleteItem` has exactly one non-test caller (`ItemEditorSheet`). `ItemCard`, the bulk-select
views and the command palette offer no delete, and therefore no per-occurrence skip either: for a
recurring item, occurrence removal is only reachable by opening one occurrence in the editor.
Worth a backlog item for a card-level action menu (delete this occurrence / delete the series),
now that `skipOccurrence` has a wired caller to reuse.

## 4. Bulk delete has no scope at all

`deleteItems` (multi-select) always deletes whole rows. For a recurring item selected in a bulk
action there is no occurrence-level escape hatch; the recovery path is ⌘Z (undo) only. Left as
-is — separate feature, and IMP-002/003/004 territory.

## 5. Pre-existing formatting drift in `ItemEditorSheet.tsx`

The `@/lib/date` import was wrapped across lines although it fits exactly 100 columns, so
`prettier --write` collapses it. Restored to the committed form to keep this diff free of
unrelated churn; the drift predates IMP-055. Not covered by `npm run lint`, so no gate catches it.