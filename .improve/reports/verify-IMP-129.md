# verify-IMP-129 / IMP-130 — Shopping list Dialog + destructive-action undo

Reviewer: independent (did not author). Branch: `improve/auto-20261017` @ HEAD `c8447d9`.
Scope under review: uncommitted working-tree diff — `src/features/shopping/ShoppingView.tsx`,
`src/features/list/ListView.test.tsx` (modified), `src/features/shopping/ShoppingView.test.tsx`
(untracked new). Report under review: `.improve/reports/impl-IMP-129.md`.

## Summary

**VERDICT: PASS.** Both criteria sets are met and the implementation's core claim holds:
`bulkDelete` and `clearPurchased` are undoable end-to-end. A delete followed by
`⌘/Ctrl+Z` restores every deleted item with its original `id`, its transitive children
(`parentId` links intact) and its `history`; the toast exposes a discoverable `Undo`
button that performs the same restore. The new-list `Dialog` is focus-trapped, closes on
`Escape` only when topmost, rejects blank names, and renders as a bottom sheet on mobile.
All four gates pass. Findings are minor/non-blocking.

## Criteria check

### IMP-129 — Replace `window.prompt` with the app Dialog

| Criterion | Result | Evidence |
| --- | --- | --- |
| "List" opens app `Dialog` with a labelled input | PASS | `ShoppingView.tsx:222-249`; browser: `[role="dialog"]` "New shopping list" with `List name` label whose `for` == input id |
| Enter/OK creates the list and selects it | PASS | `addList` (`:103-121`); browser: created list, filter switched to it; unit test `ShoppingView.test.tsx:134-161` |
| Esc/Cancel is a no-op | PASS | `Escape` closes with no write (`:163-178`); browser confirmed dialog closed, option list unchanged |
| No `window.prompt` remains | PASS | `grep window.prompt src/` → only the test-description string |
| Tests cover both paths | PASS | create + escape tests present |

Extra checks requested: **empty-name validation** — `Create` disabled while blank and
whitespace-only Enter is a no-op (browser: `blankDisabled:true`, dialog stayed open,
no list created). **Focus trap** — `Tab` cycles input → Cancel → Close and never leaves
the dialog (browser). **Escape topmost-only** — with the shopping dialog open, `⌘K`
opened the command palette; `Escape` closed only the palette (1 dialog left), a second
`Escape` closed the shopping dialog. **Mobile layout** — at 375×667 the dialog is
bottom-anchored (`bottom == innerHeight`, top radii 16px, bottom radius 0), full width.
**Duplicate list names** — permitted: typing an existing name creates a second list
(browser). This matches the prior `window.prompt` behaviour and is not in the acceptance
criteria, so it is an observation, not a defect.

### IMP-130 — Undo for destructive bulk and shopping actions

Criterion 1 allows either `ConfirmDialog` *or* a toast with an `Undo` action. The
implementation chose the toast+undo path; both actions route through `deleteItems`
(`src/domain/itemActions.ts:159-175`), which removes the selection plus every transitive
descendant, pushes an undo entry that `bulkPut`s the captured rows, and emits
`toastWithUndo`.

| Criterion | Result | Evidence |
| --- | --- | --- |
| Both actions produce a toast with Undo | PASS | `ListView.tsx:103-106`; `ShoppingView.tsx:91-96`; browser toasts "Deleted 1 items / Undo", "Deleted 2 items / Undo" |
| Undo leaves data restorable / "cancel" leaves data untouched | PASS | `deleteItems` pushes undo before any other action; undo restores exact rows |
| Tests cover both actions | PASS | `ListView.test.tsx` new suite; `ShoppingView.test.tsx` clear-purchased suite; pre-existing `itemActions.test.ts:243-303` covers transitive descendants + undo |

## End-to-end undo (browser, 4173 preview, SW/caches reset)

Injected a parent task (with one `history` entry) + child task, then:

1. Lists → select parent → **Delete**. DB: parent **and** child gone (transitive);
   toast "Deleted 1 items / Undo".
2. **⌘Z**: DB restored both rows — `id`s unchanged, child's `parentId` still
   `verify-parent-1`, parent's `history` length 1; toast "Undone".
3. Delete again → click the toast **Undo** button → parent restored with history intact.
4. Shopping → **Clear purchased**: DB lost both purchased rows; toast
   "Deleted 2 items / Undo"; toast Undo restored both with **identical ids**
   (`sameIds:true`).

## Undo scope / limits (observations, non-blocking)

- The undo stack keeps only the last 25 entries (`useUiStore.ts:146`), so a 26th
  destructive action silently drops the oldest undo. Each entry holds a full in-memory
  snapshot of the deleted rows (selection + descendants), so a very large delete is
  bounded by memory, not correctness.
- The toast `Undo` and `⌘Z` both call the global `undo()`, which pops the *newest*
  entry. If another undoable action occurs before the toast is used, the toast's Undo
  acts on that newer action. This is the shared `toastWithUndo` behaviour (also used by
  single `deleteItem`), pre-existing and not introduced here.
- Cosmetic: the toast/undo label counts only the top-level selection
  ("Deleted 1 items" when 1 parent + N children were removed) and is not singularised.
- `clearPurchased`'s set is scoped to the active list and non-archived rows, so undo
  restores exactly what was visible/deleted.

## Gates

`npm run typecheck`, `npm run lint`, `npm run test` (59 files / 600 tests),
`npm run format:check` — all pass. `npm run build` succeeds. Preview server stopped
after verification; no source files modified by this review.

## Verdict

**PASS.** Criteria met; the undo claim is confirmed in the browser for both actions,
including ids, transitive children and history. Minor caveats above are pre-existing or
cosmetic and do not block.
