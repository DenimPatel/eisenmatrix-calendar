# Verify IMP-079 — One Escape closes only the topmost overlay

**Verdict: PASS**
**Branch:** `improve/auto-20261017` (HEAD `0a185e4` + working tree)
**Reviewer:** independent verification; no implementation files modified, nothing committed.

## Diff reviewed

- `src/store/useUiStore.ts`: `overlayStack: string[]`, `registerOverlay`, `unregisterOverlay`,
  `isTopOverlay(id)`.
- `src/hooks/useOverlayLayer.ts` (new): per-instance `useId`, register while `active`,
  unregister on cleanup, stable `isTop()` reading the live store.
- `src/components/ui/Dialog.tsx`, `Sheet.tsx`: Escape calls `onClose` only when `isTopOverlay()`.
- `src/components/ui/Dialog.test.tsx`: two stacked cases (Dialog+Dialog, Dialog+Sheet).
- Metadata: `FEATURES.md` status IN-PROGRESS. CHANGELOG/PROGRESS entries are IMP-081
  bookkeeping, unrelated to this diff.

No dependency, lockfile, styling, or comment churn. Scope matches the spec.

## Acceptance criteria

| AC | Result | Evidence |
| --- | --- | --- |
| 1. One Escape closes only the top layer; other stays open, focus returns into it | PASS | jsdom: `dialogTitles` goes `['Quick add','Command palette']` → `['Quick add']` → `[]`; `activeText()` `Command palette` → `Quick add`. Preview: editor+palette → Escape leaves only `Untitled`; active element is the `What is it?` title input. |
| 2. Single-overlay Escape unchanged | PASS | Existing `ConfirmDialog`, `QuickAdd`, `CommandPalette` Escape tests pass unchanged. Preview: `?` → Escape closes the shortcut sheet; `n` → Escape closes the editor. |
| 3. Store tracks the most recently opened overlay | PASS | `overlayStack` order equals open order; top is `stack[stack.length-1]`. Re-open appends again; no duplicates (`includes` guard). |
| 4. ⌘K from a text field still works; stacking reachable | PASS | `useKeyboardShortcuts` untouched; preview: focus in editor title, ⌘K opens palette (2 dialogs). |

## Cleanup / lifecycle checks

- **Unmount/close:** stack empties after the final Escape (`['_r_9_']` → `[]` in dev);
  re-opening the editor after close re-registers exactly one entry (`len 1`, `unique 1`).
  `ItemEditorSheet` unmounts while closed, so it also exercises unmount cleanup.
- **StrictMode:** dev build (`npm run dev`, React.StrictMode) with editor+palette open shows
  `overlayStack.length === 2`, `unique === 2` — no double registration. The `includes` guard
  also makes a duplicate entry impossible.
- **Stale entries:** no stale entries after close/re-open; unregister filters by instance id.
- **Known non-AC issue (disclosed in `discovered-IMP-079.md`):** closing the top layer runs
  its effect cleanup and sets `document.body.style.overflow = ''` while the lower modal is
  still open (reproduced: editor remains, `overflow === ''`). Pre-existing pattern, newly
  reachable because of this fix; correctly deferred, needs a ref-counted scroll lock.
- **Minor ordering edge (not disclosed):** `ShortcutSheet` renders *after* `CommandPalette`
  in `App.tsx`. Opening `?` then ⌘K registers the palette as top while the shortcut sheet
  paints above it (verified with `elementFromPoint`; palette focused underneath). Escape then
  closes the visually lower palette first. The implementation report's claim that registration
  order "matches DOM paint order" is therefore not universally true. Escaping still closes one
  layer per press and the required editor+palette stack is correct.
- **Re-opening the same overlay:** verified in dev and preview; no jump-ahead or stale entry.

## Gates

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test` — 42 files / **445 tests** pass (baseline 443; +2 new). Non-vacuous:
  deleting the `isTopOverlay()` guards in a temp copy makes both new stacked tests fail
  (`['Quick add']` vs `[]`, `['Editor']` vs `[]`).
- `npm run build` — pass; `dist/sw.js`, 18 precache entries.
- `npm run format:check` — pass.
- Dialog-over-Sheet stack is covered by the second new jsdom case.

## Browser check (preview, SW/caches reset)

- `n` → editor open, focus in "What is it?"; `⌘K` → editor + palette; first Escape closes
  palette, editor remains, focus back in the title input; second Escape closes the editor.
- Plain single dialog (`?` sheet): one Escape closes it.
- Console: **0 errors, 0 warnings** on the preview origin.
- Screenshots: `.improve/artifacts/IMP-079/01-editor-plus-palette.png`,
  `02-single-shortcut-dialog.png`, `03-after-first-escape-editor-remains.png`,
  `04-shortcuts-sheet-over-palette-mismatch.png`.

## Suggested health delta

**UX/Interaction +1** (predictable, one-layer-at-a-time dismissal with focus restoration) and
**Accessibility +1** (focus lands back inside the surviving overlay; single-overlay behavior
unchanged), with the scroll-lock follow-up logged.
