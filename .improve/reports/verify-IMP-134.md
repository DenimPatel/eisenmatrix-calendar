# verify-IMP-134 — Independent review of the in-app Help entry point

Reviewer: skeptical, independent. Source not modified. Item IMP-134, impl report
`.improve/reports/impl-IMP-134.md`. Baseline `3427cb7`.

## Verdict

**PASS with one content defect.** The Help dialog, its four entry points, overlay gating,
topmost-only Escape, focus trap/return and scroll lock all behave as documented. Gates and
the browser check pass. One documented syntax token is false: `6 cans` does not parse.

## Criteria checks

### 1. Diff matches the report's file table
`git status` shows exactly the 10 modified/added files listed (plus `FEATURES.md`). No
unexpected source changes. `HelpDialog` is mounted once in `App.tsx:133`.

### 2. Shortcuts match `useKeyboardShortcuts`
`SHORTCUTS` in `helpContent.ts` vs `src/hooks/useKeyboardShortcuts.ts`:

| Sheet row | Hook |
| --- | --- |
| ⌘/Ctrl + K → Open command palette | meta+k → `setCommandOpen(true)` (L28) ✓ |
| C → Quick add | `c` && !meta → `setQuickAddOpen(true)` (L54) ✓ |
| N → New task | `n` && !meta → `openEditor(createItem task)` (L59) ✓ |
| / → Search everything | `/` → `setCommandOpen(true)` (L49) ✓ |
| 1 – 9 → Jump to a view | `NAV_ITEMS` shortcuts `'1'..'9'` (nav.ts:23-31) ✓ |
| ⌘/Ctrl + Z → Undo last action | meta+z → `undo()` (L33) ✓ |
| ? → Show this sheet | `?` → `setShortcutsOpen(true)` (L44) ✓ |
| Esc → Close panels | `Dialog` Esc → `onClose` ✓ |

No drift. The `?` key opens the **shortcut sheet**, not Help; the sheet footer then opens
Help. This matches the report and the shortcut-sheet copy.

### 3. Export format notes match `src/lib/csv.ts` / `ics.ts` / `backup.ts`
- JSON — "every item and list … replace or merge": `buildBackup` serialises `items` + `lists`
  (backup.ts:15); `SettingsView` import strategies are skip/overwrite/duplicate, i.e. merge or
  overwrite. Accurate.
- CSV — "items table … Re-importable": `itemsToCSV` / `csvToItems` both exist and are wired to
  export/import buttons in `SettingsView` (L102, L144). Accurate.
- ICS — "calendar feed … Export only — use JSON to restore": `itemsToICS` is export-only; no ICS
  importer exists (`parseBackup` handles JSON, `csvToItems` handles CSV). Accurate.

### 4. Examples parse as described (independently re-parsed)
A throwaway harness (`parseQuickAdd` imported directly, fixed `now = 2024-06-10T12:00`) was run
over all 9 `QUICK_ADD_EXAMPLES` and every `QUICK_ADD_SYNTAX` token; harness deleted afterwards.
All 9 examples parse exactly as their summaries claim:

| Input | Parsed | Summary claim |
| --- | --- | --- |
| pay electricity $120 every month on the 5th !urgent | bill, $120, USD, urgency high, monthly byMonthDay [5] | ✓ |
| buy milk 2L #groceries | shopping, qty 2, unit l, tag groceries, listName Groceries | ✓ |
| gym mon/wed/fri 7am | weekly byWeekday [1,3,5], time 07:00 | ✓ |
| standup tue and thu | weekly byWeekday [2,4] | ✓ |
| call mom tomorrow | task, start 2024-06-11, allDay | ✓ |
| submit report on the 5th | task, start 2024-07-05, allDay | ✓ |
| meeting 2024-03-04 2:30pm | task, start 2024-03-04T14:30 | ✓ |
| habit: meditate every 3 days | habit, daily interval 3 | ✓ |
| plan trip !important #travel | task, importance high, tag travel | ✓ |

Syntax tokens verified: all parse as labelled **except `6 cans`** (see defect). `task:`…
`note:` force kinds; `buy …` → shopping; `#tag`; `!urgent/!high/!important/!low`; `$120`,
`120 usd`, `50 eur`, `40 gbp` (USD/EUR/GBP); `2L` (l), `3 kg`, `1 pack`; `every day`,
`every 3 weeks`, `monthly`, `annually`; `mon/wed/fri`, `tue and thu`;
`every month on the 5th`; every date token (`today`/`tomorrow`/`tonight`/`next week`/
`in 3 days`/`next fri`/`2024-03-04`); every time token (`7am`/`2:30pm`/`14:30`).

### 5. Escape topmost-only + scroll lock
`Dialog` (HelpDialog's base) calls `useOverlayLayer(open)` and only closes when
`isTopOverlay()` (Dialog.tsx:52-61); `useBodyScrollLock(open)` is applied (Dialog.tsx:50).
Browser: opening Help set `body.style.overflow = "hidden"`; Escape closed it and restored
`""`. Opening Help from the sheet yields exactly one dialog (sheet closes first).

### 6. Focus return
`useFocusTrap` records `previouslyFocused` and re-focuses it on cleanup
(useFocusTrap.ts:15,46). Browser: after Escape, `document.activeElement` is the header Help
button (`title="Help & syntax"`). Unit test `HelpDialog.test.tsx` also asserts this.

### 7. Overlay gating (shortcuts disabled while open)
`helpOpen` was added to `OverlayState`/`isOverlayOpen` (useUiStore.ts:93) and
`useKeyboardShortcuts` returns early when `overlayOpen` (L42). Browser: with Help open,
pressing `c` and `?` left exactly one dialog open — neither Quick add nor the shortcut sheet
appeared. `useKeyboardShortcuts.test.tsx` covers `helpOpen` in the flag table.

### 8. No duplication drift
`ShortcutSheet.tsx` imports `SHORTCUTS` from `./helpContent`; the inline array was removed.
Single source of truth confirmed. `HelpDialog` renders the same `SHORTCUTS`.

## Gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test` | 66 files / 632 tests pass |
| `npm run format:check` | pass |
| `npm run build` | pass (sw.js generated) |

## Browser check (preview 4173)

Reset SW registrations + caches, then `about:blank` → app URL (real document load). Server
stopped after the check.

- Header Help button → dialog open, `h2` "Help & syntax" focused, body scroll locked.
- `c` and `?` while open → no second dialog (gating).
- Escape → closed, focus back on header button, scroll lock released.
- `?` → shortcut sheet → footer "Quick-add syntax & help" → exactly one dialog (Help).
- Meta+K → palette → typed `help` → sole option "Help & syntax" → opened Help, palette closed.
- Tab from heading → Close button, stays inside dialog (focus trap).
- **0 console errors / 0 warnings.**

Artifacts `.improve/artifacts/IMP-134/*.png` exist as listed in the report.

## Defect

**`QUICK_ADD_SYNTAX` row "Quantity and unit" (`helpContent.ts:119`) documents `6 cans`, but the
parser does not recognise it.** The unit regex (quickadd.ts:151) matches `can` only as a whole
word (`\b` after `can`), so the plural `cans` never matches. Independently parsed,
`x 6 cans` yields `quantity: undefined`, `unit: undefined`, and the title keeps the literal
"X 6 cans". The other three tokens in that row (`2L`, `3 kg`, `1 pack`) do parse. The
report's claim that "every quick-add example and syntax token is taken from the real parser"
(line 9-11) is therefore not fully true. No test covers `QUICK_ADD_SYNTAX`, so the defect is
uncaught. Impact is cosmetic (misleading help copy); fix by dropping `cans`/using `can`, or
extend the regex.

## Notes

- All other report claims verified true: file table, tests added, gates, artifacts, entry
  points, focus/scroll/gating behavior, and 0 console errors.
- Not committed or pushed by the implementer; nothing outside the repo.
