# IMP-055 — Occurrence-scoped Delete should skip, not delete the series

## Status

Implemented. `npm run typecheck`, `npm run lint`, `npm run test` (310 tests, 31 files) and
`npm run build` all pass. Not committed; `FEATURES.md` left at `TODO`.

## What changed

### `src/domain/itemActions.ts` — `skipOccurrence`

Now wired-safe and idempotent:

- Bases the rule on the **persisted** row (`itemRepo.get`) instead of the caller's prop, mirroring
  the existing guard in `updateRecurring` (`:281`). The editor hands over a draft; skipping one
  occurrence must not persist an unsaved series-wide rule that only became editable after the user
  switched scope back to "This occurrence".
- Returns early when the key is already in `exceptions` (no duplicate key, no empty undo entry,
  no second toast). The `new Set(...)` de-duplication is no longer needed as a side effect.
- Unchanged otherwise: writes `{ recurrence: { ...rule, exceptions: [...exceptions, occKey] } }`
  through `patchItem` (so history + a single undo entry are still recorded) and toasts
  "Occurrence skipped".

### `src/features/item/ItemEditorSheet.tsx` — the destructive control follows the scope

| Context | Control | Action | Confirmation copy |
| --- | --- | --- | --- |
| Recurring + occurrence key + scope `occurrence` | "Skip this occurrence" (`SkipForward` icon) | `skipOccurrence(draft, occKey)` | "Only the occurrence on 2026‑07‑20 is skipped. Every other occurrence of “X” stays, and this can be undone." |
| Scope `all`, or non-recurring / no occurrence key | "Delete" (`Trash2`) | `deleteItem(draft)` (unchanged) | "This deletes “X” and its subtasks, including every other occurrence. It can be undone afterwards." |
| Recurring + occurrence key + scope `future` | "Delete", **disabled** | none | Banner: "Delete is unavailable for “This and future”. Choose “All occurrences” to delete the whole series, or “This occurrence” to skip just this one." |

Details:

- `handleDelete` now branches exactly the way `handleSave` does (`:180`): occurrence scope skips,
  everything else deletes the series. The `draft.recurrence && occKey` guard means a non-recurring
  item can never take the skip path (where `skipOccurrence` would no-op and silently close).
- Both destructive actions go through a confirmation step first (`confirmDelete` state), so the
  UI can never claim a series deletion while only skipping one occurrence. The copy is scoped, not
  generic: the skip variant never mentions the series, the delete variant always does.
- The confirmation renders **inside** the sheet body (a `role="alertdialog"` block below the
  scope banner) rather than as a nested `Dialog`. A nested `Dialog` would be a second
  `aria-modal` layer over the sheet, and both overlays register a document-level Escape handler —
  one Escape press would close the editor *and* the dialog. `ConfirmDialog` is left untouched and
  still used by `SettingsView`.
- `setConfirmDelete(false)` on scope change and on editor (re)open, so a pending confirmation
  cannot survive a scope switch and mislabel its own action.
- The existing occurrence-scope hint now states that "Delete skips this occurrence only", which is
  where a user reads the scope before touching the footer.

### Behavioural notes

- Skipping adds the key to `recurrence.exceptions`, which `expandOccurrences` already skips
  (`src/domain/recurrence.ts:261`), so the occurrence disappears from every view (matrix,
  calendar, today, list, goal/habit rollups) while the series row and its other occurrences are
  untouched. The write is reversible: one undo entry restores the whole row.
- Scope `future` is deliberately **not** implemented as a delete (that is IMP-037's territory).
  The control is disabled with explicit copy rather than deleting the whole series, which would
  have destroyed the past occurrences the user did not select.

## Not regressed

- IMP-002/003/004: `deleteItem` is untouched — still `removeWithChildren` + descendant-restoring
  undo. Its two unit tests and both new `all`-scope editor tests pass.
- IMP-016: occurrence-scoped edits still go through `updateRecurring`'s `occurrence` branch; the
  scope hint paragraph and the disabled series-only fields are unchanged, and `skipOccurrence`
  independently re-reads the stored row rather than writing draft data.

## Tests added

`src/domain/itemActions.test.ts` — `describe('skipOccurrence')`:

1. adds the key to `exceptions`, leaves every series field untouched, drops only that day from
   expansion while the sibling occurrence expands identically, toasts "Occurrence skipped";
2. does not write an unsaved draft rule (`freq: 'monthly'` stays `weekly`);
3. one undo entry restores the row byte-for-byte;
4. a repeat skip and a non-recurring item write nothing and push no undo entry.

`src/features/item/ItemEditorSheet.test.tsx` (jsdom):

1. occurrence scope: the control reads "Skip this occurrence", the confirmation states the skip
   (and never says "whole series"), and after confirming only that key disappears from the
   expanded series while the row and its title survive;
2. "Keep it" cancels with no write and the editor still open;
3. `all` scope: the control reads "Delete", the copy names the series, and the row is gone;
4. `future` scope: the control is disabled, the banner explains why, no confirmation opens and
   nothing is written.

## Verification

```
npm run typecheck && npm run lint && npm run test && npm run build
```
→ clean: 31 test files / 310 tests, PWA `injectManifest` precache 18 entries, `dist/sw.js`
emitted. Browser verification (Playwright: weekly item → open one occurrence → skip) is left to
the verifier; the jsdom editor tests cover the same interaction path.