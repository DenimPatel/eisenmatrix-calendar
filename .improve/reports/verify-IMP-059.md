# Verify — IMP-059: Focus overlays in the mount commit, not 20 ms later

**Verifier:** independent, did not write the change
**Branch:** `improve/auto-20261017` (working tree, uncommitted)
**Date:** 2026-10-17
**VERDICT: PASS**

## Scope reviewed

`git diff` (source only):

```
src/hooks/useFocusTrap.ts        |  7 +++----
src/hooks/useFocusTrap.test.tsx  | 14 ++++++++++++++
```

- `useEffect` → `useLayoutEffect`.
- `window.setTimeout(focusInitial, 20)` → `focusInitial()`.
- Matching `window.clearTimeout(timer)` removed from cleanup.
- Focus-restore (`previouslyFocused?.focus?.()`), Tab handler, focusable query,
  filter, and deps `[active, initialFocus]` all untouched.
- No comments added, no new deps, no other source files touched.
- `.improve/FEATURES.md`, `.improve/PROGRESS.log`, `.improve/STATE.md` diffs are
  orchestration metadata (status/counters) and were already dirty before the
  implementation; they are not part of the code change. `impl-IMP-059.md` claims the
  same and the diff confirms it.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Initial focus applied in the mount commit, no timer | **Met** | `useLayoutEffect` + direct `focusInitial()` call (`useFocusTrap.ts:12,24`). Browser: MutationObserver fired on dialog insertion saw `document.activeElement` already the QuickAdd input (same commit, before paint); first macrotask observation at 5.3 ms with focus already set. |
| 2 | No timer survives unmount | **Met** | No `setTimeout`/`clearTimeout` remains anywhere in the hook (`grep`). No late focus steal: after open→Escape, focus stayed on the opener at close and still there 150 ms later. |
| 3 | Focus restore + Tab loop unchanged, existing tests pass | **Met** | Cleanup still removes the keydown listener and restores `previouslyFocused`. Real-browser Tab sequence stays inside the dialog and wraps both directions; focus restore verified for QuickAdd, Command palette, item editor and shortcut sheet. 343/343 tests pass (342 baseline + 1 new). |

## Gates

```
npm run typecheck   PASS  (no diagnostics)
npm run lint        PASS  (no output)
npm run test        PASS  33 files / 343 tests (run twice, incl. after mutation restore)
npm run build       PASS  tsc + vite build; PWA precache 18 entries; dist/sw.js generated
```

Mutation checks (temporary edits, restored byte-for-byte, `shasum` verified):

- Reinstating `useEffect` + `setTimeout(focusInitial, 20)` + `clearTimeout`: the new
  test **fails** with `expected null to be 'Primary'`, so the test genuinely pins the
  timer removal.
- Replacing `useLayoutEffect` with `useEffect` but keeping the direct call: the new test
  **still passes** (React `act` flushes passive effects). Non-blocking test-strength
  note: the unit test proves "no timer", not strictly "same commit". The implementation
  is nevertheless `useLayoutEffect`, and browser evidence independently proves
  same-commit focus.

## Browser verification

Server: `npm run preview` → `http://localhost:4173/eisenmatrix-calendar/` (built from
this working tree). Stale SW handled first: unregistered all service workers, deleted
the workbox precache, reloaded with a cache-busting query.

1. **`c` → same-tick focus.** With focus on `<body>`, pressed `c`; immediately queried
   focus: 1 dialog, `document.activeElement` = `INPUT` with QuickAdd placeholder.
   Typed `b` without clicking: input value became `"b"`, still focused.
2. **Same-commit proof.** Installed a `MutationObserver` on `document.body`; on first
   dialog insertion it read `activeElement` = the QuickAdd input (`inside: true`) at
   +5.4 ms — focus is set during the commit, not by a later timer/passive effect.
3. **Focus restore.** Focused the "New task" button, pressed `c` (input focused),
   pressed `Escape`: focus returned to the "New task" button, dialog gone; rechecked
   after 150 ms — no late focus change.
4. **Tab loop.** Real key presses inside QuickAdd:
   input → example chip ×3 → Cancel → **Close dialog** (wrap) → input (cycle repeats).
   `Shift+Tab` from the first element wraps backwards (Cancel → chips). Every step
   `inside: true`; no focus escaped the dialog.
5. **Other overlays (regression sweep).** Command palette (`⌘K`) focuses its query
   input and restores the opener on Escape; `n` opens the item editor with the title
   input focused; `?` focuses the "Keyboard shortcuts" heading. All inside `[role=dialog]`.
6. **390 × 844.** Pressed `c`: dialog visible, input focused, typed `q` → value `"q"`.
   Screenshot: `.improve/reports/verify-IMP-059-quickadd-390.png`.
7. **Console.** All console levels across the whole session: **0 messages, 0 errors,
   0 warnings**.

## Observations / residual risk (non-blocking)

- Remaining `setTimeout` occurrences are only test-wait helpers (`useFocusTrap.test`,
  `Dialog.test`, `QuickAdd.test`, `useKeyboardShortcuts.test`), not the focus path.
  Existing mount helpers still sleep 40 ms, which is now unnecessary but harmless.
- The new test duplicates the mount harness to avoid that 40 ms settle; a small shared
  helper would read better, but it is clear and correctly scoped.
- `useLayoutEffect` is SSR-unsafe by definition; this app is a client-only Vite SPA with
  no SSR entry point, so this is not a defect here.
- Pre-existing defects listed in `REPO_PROFILE.md` (e.g. overlays without an
  `initialFocusRef` still focus Close first, Escape stacking) behave the same before and
  after this change.

## Files produced

- `.improve/reports/verify-IMP-059.md` (this file)
- `.improve/reports/verify-IMP-059-quickadd-390.png` (390 px QuickAdd, focused input)

## Suggested health deltas

| Dimension | Current | Suggested | Rationale |
|---|---|---|---|
| Accessibility | 3 | 3 (hold; +1 candidate once IMP-027/IMP-033 land) | Removes real keystroke loss on overlay open; dialog naming gap still dominates. |
| UX/Interaction | 3 | 3 (hold) | Focus timing no longer observable; Escape stacking/duplicate habits remain open. |
| Tests/Tooling | 4 | 4 (hold) | +1 focused regression test (343 total); timing assertions still rely on 40 ms sleeps elsewhere. |
| Bugs/Correctness | 4 | 4 (hold) | Small robustness fix; no data-path change. |
