# impl-IMP-134 — In-app Help entry point (quick-add syntax, shortcuts, export formats)

Baseline SHA: `3427cb7` (HEAD at start). Item: `.improve/FEATURES.md` IMP-134 /
`.improve/reports/discover3-features.md` F14; `AGENTS.md`.

## What changed

A single accessible **Help & syntax** dialog, mounted once in `App.tsx`, reachable from
four entry points. No feature was invented: every quick-add example and syntax token is
taken from the real parser in `src/domain/quickadd.ts`, and every documented example is
asserted against `parseQuickAdd` by a test.

| File | Change |
| --- | --- |
| `src/features/shell/helpContent.ts` (new) | Single source of help copy: `SHORTCUTS` (moved out of `ShortcutSheet`), `QUICK_ADD_EXAMPLES` (9 examples with the exact parsed fields they claim), `QUICK_ADD_SYNTAX` (token reference derived from the parser), `EXPORT_FORMATS` (JSON / CSV / ICS one-liners). |
| `src/features/shell/HelpDialog.tsx` (new) | `Dialog` (focus trap + `aria-modal` + Esc + body scroll lock) with four sections: quick-add examples, syntax, keyboard shortcuts, export formats. Semantic tokens only (`text-fg`, `text-muted`, `border-border`, `bg-elevated`, `text-accent`). Focus starts on the dialog heading. |
| `src/features/shell/ShortcutSheet.tsx` | Imports `SHORTCUTS` from `helpContent` and gains a footer **Quick-add syntax & help** button that closes the sheet and opens Help (builds on the existing sheet). |
| `src/store/useUiStore.ts` | New `helpOpen` + `setHelpOpen`, and `helpOpen` added to `OverlayState`/`isOverlayOpen` so global shortcuts stand down while Help is up. |
| `src/App.tsx` | Mounts `<HelpDialog />` beside the other overlays. |
| `src/features/shell/AppShell.tsx` | Visible header **Help & syntax** icon button (`HelpCircle`, `title="Help & syntax"`). |
| `src/features/command/CommandPalette.tsx` | New command **Help & syntax** (`hint: Quick add, shortcuts, export`) → `setHelpOpen(true)`. |
| `src/features/settings/SettingsView.tsx` | About card gains a **Quick-add syntax & help** button. |

## Verification

Gates (all pass): `npm run typecheck`, `npm run lint`, `npm run test` (66 files / 632
tests), `npm run format:check`, `npm run build`.

Tests added / extended:
- `src/features/shell/helpContent.test.ts` — **runs every documented example through
  `parseQuickAdd`** and asserts the fields the Help UI claims (`toMatchObject`), so a
  documented example cannot drift from the parser. Date-relative examples pin a fixed
  `now`.
- `src/features/shell/HelpDialog.test.tsx` — opens with focus on the heading, lists a
  documented example plus the shortcuts and export sections, returns focus to the opener
  on close, and the shortcut-sheet button opens Help and closes the sheet.
- `src/features/command/CommandPalette.test.tsx` — the **Help & syntax** command opens
  Help and closes the palette.
- `src/hooks/useKeyboardShortcuts.test.tsx` — `helpOpen` included in the `isOverlayOpen`
  flag table.

Browser check on `npm run preview` (4173), SW registrations and caches reset first, then a
real document load (`about:blank` → app URL):

- 1280 light, 1280 dark (top + scrolled to shortcuts/export), 390 light, 390 dark — dialog
  renders correctly in both themes and both widths; screenshots in
  `.improve/artifacts/IMP-134/` (`help-1280-light.png`, `help-1280-dark.png`,
  `help-1280-dark-bottom.png`, `help-390-light.png`, `help-390-dark.png`).
- Header Help button opens the dialog with focus on the `h2` heading; `Tab` cycling stays
  inside the dialog (focus trap), reaching the Close button.
- `Meta+K` → palette, typed `help` → the **Help & syntax** option was the sole match and
  clicking it opened the Help dialog (heading focused).
- `?` → shortcut sheet → **Quick-add syntax & help** opened Help and closed the sheet
  (exactly one dialog remained).
- **0 console errors** across the session. Preview server stopped after the check.

## Notes

- The item was already marked `DONE` in `FEATURES.md`; the Notes line was updated to point
  at this report.
- Not committed or pushed. No changes outside the repo.
