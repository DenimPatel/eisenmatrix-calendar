# IMP-057 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File                                | Change                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/Dialog.tsx`      | New optional `titleRef?: RefObject<HTMLHeadingElement \| null>` prop; the rendered title `<h2>` gets `ref={titleRef}`, `tabIndex={-1}` and `outline-none`. `ConfirmDialog` now creates `cancelRef`, attaches it to the Cancel button and passes it as `initialFocusRef`. |
| `src/features/shell/ShortcutSheet.tsx` | `headingRef` passed as both `titleRef` and `initialFocusRef`, so the sheet opens on its "Keyboard shortcuts" heading.                                  |
| `src/features/settings/SettingsView.tsx` | The "Import complete" dialog gets `importDoneRef` on the Done button and passes it as `initialFocusRef`.                                                     |

No change to `useFocusTrap`, `Sheet`, or the trap fallback: IMP-009's `initialFocusRef` is reused
exactly as designed, and `Button` was already a `forwardRef` component, so no plumbing was needed.

DOM order is untouched — the Close button is still the first node in every dialog, so its position in
the Tab ring and the `FOCUSABLE` query are unchanged. Only the *initial* focus target moved.
`tabIndex={-1}` keeps the heading out of the tab order (`FOCUSABLE` excludes `[tabindex="-1"]`), and
`outline-none` guarantees the programmatic focus paints nothing (criterion 5).

The two SettingsView dialogs are, at current line numbers, the "Import complete" `Dialog` (`:310`) and
the reset `ConfirmDialog` (`:325`); the spec's `:292`/`:307` are from an older revision.

## Acceptance criteria

1. `ShortcutSheet` opens on its heading — `src/features/shell/ShortcutSheet.test.tsx`
   (`opens with focus on the dialog heading, not the Close button`) and the `titleRef` case in
   `src/components/ui/Dialog.test.tsx`.
2. `ConfirmDialog` focuses Cancel — `src/components/ui/Dialog.test.tsx`
   (`focuses Cancel, not the destructive confirm button`, with `danger` + `confirmLabel="Delete
   everything"`). Enter on the focused Cancel cannot fire the destructive action.
3. SettingsView: the reset confirm inherits criterion 2; the import dialog focuses its Done button
   (`initialFocusRef={importDoneRef}`). See "Deviation" below.
4. Focus returns to the opener and Escape/Tab are unchanged — `returns focus to the opener on close`
   (both new files), `closes on Escape and returns focus to the opener`, and `keeps the Tab loop
   unchanged: last focusable wraps to Close`.
5. No visual change: only `tabIndex`/`ref`/`outline-none` were added; no size, colour, spacing or
   layout class changed. Confirmed in-browser (no console messages).

## Deviation from criterion 3 (deliberate)

The criterion says "the first field for the import dialog". The "Import complete" dialog has no
fields — its body is a single `<p>` report and its only control besides Close is the Done button
(`SettingsView.tsx:316`). Done is therefore the meaningful target and is what it now receives; there
is no form input in that dialog to focus.

## Tests added

Two new jsdom files, 8 tests, using the existing `createRoot` + `act` harness style from
`src/hooks/useFocusTrap.test.tsx` (`@testing-library/react` is not a dependency) and reusing its
`HTMLElement.prototype.offsetParent` shim so the Tab-wrap assertion is real rather than vacuous:

- `src/components/ui/Dialog.test.tsx` — heading initial focus, no-ref control case (still Close),
  Tab wrap last→first with `defaultPrevented`, focus restore, ConfirmDialog Cancel, Escape + restore.
- `src/features/shell/ShortcutSheet.test.tsx` — store-driven open focuses the `h2`, close restores
  focus to the opener.

Negative check: stashing only the three source files makes 7 of the 8 new tests fail; the sole
survivor is the "still starts on Close without an initial focus ref" control, which is the point of
that test.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (25 files, 188 tests passed) ·
`npm run build` (OK, `dist/sw.js` emitted, 18 precache entries, 604.45 KiB).
`npx prettier --check` clean on all five touched files.

## Browser verification (Playwright, `npm run preview`, port 4173)

The stale service worker served the previous bundle at first (the known issue from
`.improve/reports/discovered-IMP-009.md`); after `getRegistrations().unregister()` + clearing
`workbox-precache-v2` and a hard reload, the new bundle was live:

| Overlay                              | `document.activeElement` on open       | Escape → focus back to opener   |
| ------------------------------------ | -------------------------------------- | ------------------------------- |
| Shortcut sheet (`?` and header btn)  | `H2` "Keyboard shortcuts", `tabindex="-1"` | yes (header "Keyboard shortcuts" button) |
| Settings → Reset all data            | `BUTTON` "Cancel"                      | yes ("Reset all data")          |
| Settings → Import CSV (file chooser) | `BUTTON` "Done"                        | yes ("Import CSV")              |

Tab loop re-checked in-browser: from Done (last focusable) forward Tab is intercepted and lands on
the Close button (first focusable), so the ring is unchanged. Zero console messages.

## Notes for the verifier

- The trap still focuses on a 20 ms `setTimeout`, so sample `activeElement` ~50 ms after opening
  (see IMP-009's note).
- Nothing outside the three overlay files was touched; no persistence, domain or label changes.
