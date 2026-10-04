# IMP-009 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File                            | Change                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/hooks/useFocusTrap.ts`     | `useFocusTrap(active, initialFocus?)` now takes an optional `RefObject<HTMLElement \| null>`. The delayed initial-focus step became `focusInitial`, preferring `initialFocus.current` when it is still inside the container and falling back to the previous behaviour (first focusable, else the container). Effect deps are `[active, initialFocus]`; the ref identity is stable so the trap does not re-arm. |
| `src/components/ui/Dialog.tsx`  | New optional `initialFocusRef` prop, forwarded to `useFocusTrap`.                                                                                                                                                                        |
| `src/components/ui/Sheet.tsx`   | Same optional `initialFocusRef` prop.                                                                                                                                                                                                   |
| `src/features/quickadd/QuickAdd.tsx` | `inputRef` replaces `autoFocus` on the textbox and is passed as `Dialog`'s `initialFocusRef`.                                                                                                                                      |
| `src/features/command/CommandPalette.tsx` | `queryRef` replaces `autoFocus` on the combobox and is passed as `initialFocusRef`.                                                                                                                                          |
| `src/features/item/ItemEditorSheet.tsx`   | `titleRef` replaces `autoFocus` on the Title input and is passed as `Sheet`'s `initialFocusRef`.                                                             |

No DOM reordering: the Close button stays first in the DOM, so its position in the Tab ring and the
existing `FOCUSABLE` query are untouched. This is the `initialFocusRef` option the spec's note asked
for, implemented as a ref rather than a selector so it does not depend on ids or DOM order.

`autoFocus` had to go, not just be supplemented. React applies `autoFocus` during commit, *before*
the trap's effect runs, so `previouslyFocused` was captured as the overlay's own input; the cleanup
`previouslyFocused?.focus?.()` then fired on an unmounted node and focus fell to `<body>`. Dropping
it makes focus restore work for the first time (see criterion 4 and the negative check below).

`ConfirmDialog`, `SettingsView` and `ShortcutSheet` pass no `initialFocusRef` and keep the previous
first-focusable behaviour; that is the intended default, not a regression.

## Acceptance criteria

1. QuickAdd focuses its textbox on open — `src/features/quickadd/QuickAdd.test.tsx`
   (`focuses the quick add textbox on open`).
2. CommandPalette focuses its combobox on open — `src/features/command/CommandPalette.test.tsx`
   (`focuses the search combobox on open`).
3. ItemEditorSheet focuses the Title input on open —
   `src/features/item/ItemEditorSheet.test.tsx` (`focuses the title input on open`).
4. Escape closes and focus returns to the opener — the `returns focus to the opener…` test in each of
   the three files above. Tab trapping is untouched by the change and is covered directly in
   `src/hooks/useFocusTrap.test.tsx` (`keeps Tab trapped inside the container`: last → first wrap,
   `defaultPrevented`, then Shift+Tab first → last).

## Tests added

Four new jsdom files, 10 tests:

- `src/hooks/useFocusTrap.test.tsx` — hook-level: fallback with no ref, preferred ref wins, Tab wrap
  both directions, focus restore. jsdom has no layout so `offsetParent` is always `null`, which makes
  the trap's visibility filter empty; the file installs a `HTMLElement.prototype.offsetParent`
  prototype shim so the Tab test is real rather than vacuous.
- `src/features/quickadd/QuickAdd.test.tsx`, `src/features/command/CommandPalette.test.tsx`
  (wrapped in `MemoryRouter` for `useNavigate`), `src/features/item/ItemEditorSheet.test.tsx` —
  overlay-level focus assertions, following the `createRoot` + `act` harness style already used by
  `src/features/notes/NotesView.test.tsx` (`@testing-library/react` is not a dependency).

Negative check: reverting only the `preferred ??` line in `useFocusTrap` (keeping everything else)
makes 9 of the 10 tests fail; only the Tab-wrap test survives, as expected since it does not depend
on the new option.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (20 files, 128 tests passed) ·
`npm run build` (OK, `dist/sw.js` emitted, 18 precache entries, 602.97 KiB).
`npx prettier --check` clean on all ten touched files.

## Browser verification (Playwright, `npm run preview`, port 4173)

Desktop (1280×720) and mobile (390×844), after clearing the service-worker precache (see
`.improve/reports/discovered-IMP-009.md` — a stale SW initially served the previous bundle):

| Overlay                    | `document.activeElement` on open     | Escape → focus back to opener |
| -------------------------- | ------------------------------------ | ----------------------------- |
| QuickAdd (`c`)             | textbox (`pay electricity…` ph)      | yes                           |
| CommandPalette (`⌘K`)     | `role="combobox"` input              | yes                           |
| ItemEditorSheet (card click) | Title input, value `Daily reading` | yes (`backToOpener: true`)   |

Tab wrap re-checked in-browser on QuickAdd: forward Tab from the last focusable is
`defaultPrevented` and lands on the Close button (first focusable), Shift+Tab from the first lands
back on the last. No console messages. All four results identical at 390px.

## Notes for the verifier

- The trap's initial focus is still on a 20ms `setTimeout` (unchanged), so there is a sub-frame
  window where focus sits on `<body>`. Previously `autoFocus` made that window invisible for these
  three overlays; if you test focus *synchronously* in the same tick as opening, wait ~50ms. Vitest
  tests use `setTimeout(…, 40)`.
- Nothing outside the overlay components was touched; no persistence, domain or label changes.