# Verify — IMP-009 — Focus the primary input in overlays, not the Close button

- **Item:** `### IMP-009` (`.improve/FEATURES.md:172-182`)
- **Implementation report:** `.improve/reports/impl-IMP-009.md`
- **Reviewed commit state:** uncommitted working-tree change on `main` (HEAD `695d756`)
- **Verdict:** **PASS** (4/4 acceptance criteria met; 4 non-blocking advisories, 0 defects)
- **Reviewer:** independent reviewer (did not author the change)
- **Date:** 2026-10-04

---

## 1. Change surface

| File                                         | Change                                                                                                                                                                             | LOC       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `src/hooks/useFocusTrap.ts`                  | `focusFirst` → `focusInitial`; optional `initialFocus?: RefObject<HTMLElement \| null>`; prefer it when `container.contains(preferred)`; dep `[active]` → `[active, initialFocus]` | +11 / −6  |
| `src/components/ui/Dialog.tsx`               | new optional `initialFocusRef` prop, forwarded to the trap                                                                                                                         | +5 / −1   |
| `src/components/ui/Sheet.tsx`                | new optional `initialFocusRef` prop, forwarded to the trap                                                                                                                         | +5 / −1   |
| `src/features/quickadd/QuickAdd.tsx`         | `+ const inputRef`, `+ initialFocusRef={inputRef}`                                                                                                                                 | +2        |
| `src/features/command/CommandPalette.tsx`    | `+ initialFocusRef={inputRef}`                                                                                                                                                     | +1        |
| `src/features/item/ItemEditorSheet.tsx`      | `− autoFocus`, `+ initialFocusRef={titleRef}`                                                                                                                                      | 0 net     |
| 4 new `*.test.tsx`                           | `useFocusTrap`, `QuickAdd`, `CommandPalette`, `ItemEditorSheet`                                                                                                                    | +10 tests |
| `.improve/PROGRESS.log`, `.improve/STATE.md` | process bookkeeping only                                                                                                                                                           | +2        |

Scope is minimal and matches the backlog's stated file list exactly
(`FEATURES.md:175` names Sheet, Dialog, useFocusTrap, QuickAdd, CommandPalette,
ItemEditorSheet). No DOM reordering (explicitly avoided per the Notes at
`FEATURES.md:182`), no dependency additions, no `package.json` change, no styling
change, no unrelated refactors.

### Scope creep / unrelated changes / hygiene

- **Unrelated source changes: none.** `git status` shows only the 7 files above.
- **Bookkeeping drift (not IMP-009):** `.improve/PROGRESS.log:17` and
  `.improve/STATE.md:10` were edited to record **IMP-008** (commit `695d756`), not
  IMP-009. IMP-009 has no PROGRESS line — consistent with the observed convention
  (the log entry is written at commit time, once a SHA exists). Not a defect.
- **`FEATURES.md` still says `Status: TODO` for IMP-009** while IMP-006/007/008/049
  are `DONE`. Consistent with the same convention (status flips on commit). Not a
  defect.
- **Debug leftovers: none.** `rg "console\.(log|debug|warn|error)|debugger|TODO|FIXME|@ts-ignore|eslint-disable"`
  over all 10 touched/new files → no matches.
- **Secrets: none.** `git diff | rg -ni "key|secret|token|password|api[_-]?key"` matches
  only `event.key` in the (unchanged) keydown handler.
- **Unrelated untracked noise:** `.kilo/` (Agent Manager worktree + its own
  `.gitignore`). Not part of IMP-009; left untouched.

### Convention compliance (`.improve/REPO_PROFILE.md`)

- No direct `localStorage`, no Dexie outside `src/db/` — N/A, none added.
- UI primitives stay in `src/components/ui/`; the option is a prop on the existing
  `Dialog`/`Sheet` primitives rather than feature-level DOM hacks — correct.
- Tests use the repo's established harness style copied from
  `src/features/notes/NotesView.test.tsx` (`@vitest-environment jsdom`,
  `fake-indexeddb/auto`, Zustand store reset). No new test framework.
- `prettier --check` clean on all 10 files; `eslint .` clean (0 errors, 0 warnings).
- AGENTS.md "no comments unless non-obvious intent": the two jsdoc lines on the new
  props (`Dialog.tsx:17-18`, `Sheet.tsx:16-17`) explain non-obvious intent (why the
  option exists) — compliant, not noise.

---

## 2. Critical a11y verification

### 2a. Tab / Shift+Tab containment — CONFIRMED

The `onKeyDown` handler in `src/hooks/useFocusTrap.ts:25-38` is **byte-identical**
before and after the change (confirmed by `git diff -U2`: the hunk only touches the
function above it and the dep array below it). Both branches survive:

- forward wrap: `if (!shift && document.activeElement === last)` → `first.focus()`
- reverse wrap: `if (shift && (activeElement === first || activeElement === container))` → `last.focus()`

**Live proof at 1280px** (QuickAdd open, DOM order `[Close dialog, input, example×3, Cancel]`, `Add` disabled):

1. `document.activeElement` = the QuickAdd `INPUT`
2. focused last focusable (`Cancel`) → `press Tab` → `document.activeElement` = `Close dialog` (forward wrap ✓)
3. `press Shift+Tab` from `Close dialog` → `document.activeElement` = `Cancel` (reverse wrap ✓)

No focus ever escaped to `<body>`/background in either direction.

### 2b. Escape closes AND restores focus to the opener — CONFIRMED (3/3 overlays, 2 widths)

Escape handling is untouched (`Dialog.tsx:40-48`, `Sheet.tsx:32-40`, both
`useEffect(..., [open, onClose])`); focus restore is the trap's cleanup
(`useFocusTrap.ts:45-47`, `previouslyFocused?.focus?.()`).

| Overlay                | Opener established                | After Escape                      |
| ---------------------- | --------------------------------- | --------------------------------- |
| QuickAdd (1280)        | clicked `Today` nav link          | `link "Today" [active]`           |
| CommandPalette (1280)  | `Today` nav link                  | `link "Today" [active]`           |
| ItemEditorSheet (1280) | clicked `Daily reading` item card | `button "Daily reading" [active]` |
| QuickAdd (390)         | `Daily reading` card              | `button "Daily reading" [active]` |
| CommandPalette (390)   | `Daily reading` card              | `button "Daily reading" [active]` |
| ItemEditorSheet (390)  | `Daily reading` card              | dialog closed, focus on the card  |

**Why this actually got fixed by removing `autoFocus`:** `previouslyFocused` is
captured inside the effect (`useFocusTrap.ts:15`). Before the change, React's
`autoFocus` ran during commit _before_ that effect, so `document.activeElement` was
the overlay's own input and the cleanup re-focused a node that was being unmounted —
focus was lost to `<body>`. With `autoFocus` removed, the capture is the real opener.
The mechanism is sound and empirically confirmed above.

### 2c. The trap does NOT steal focus from elements the user is interacting with — CONFIRMED

Two probes, both at 1280px in the open editor:

1. **Direct interaction:** clicked the `Notes` textarea → `document.activeElement`
   stayed the textarea. `focusInitial` is scheduled once (`setTimeout(..., 20)` at
   mount) and is not re-armed by re-renders, so it cannot yank focus back.
2. **Adversarial dep-stability probe (the real risk of adding `initialFocus` to the
   dep array):** the change made deps `[active, initialFocus]`. If any call site
   passed an unstable ref object, the effect would re-run on every render, re-capture
   `previouslyFocused`, re-arm the 20 ms timer and re-fire `focusInitial` — stealing
   focus. I clicked the `Schedule` tab, which unmounts the Title input
   (`titleRef.current` → `null`) and re-renders all `Sheet` children. Result:
   `tab "Schedule" [active]` — focus stayed exactly where the user put it; no steal.
   Verified stable because all three call sites pass a `useRef` object
   (`QuickAdd.tsx:19`, `CommandPalette.tsx:33`, `ItemEditorSheet.tsx:41`).
3. **Re-render during typing:** typed `gym mon 7am` into the QuickAdd input; the
   parse-preview panel re-rendered (chips `task / 2026-10-03 / 07:00`, Title `Gym mon`)
   and `document.activeElement` remained the input.

Blast radius is fully confined: `rg "useFocusTrap" src` → only `Dialog.tsx` and
`Sheet.tsx`. Every other consumer (`ConfirmDialog`, `SettingsView`, `ShortcutSheet`)
passes no ref and therefore keeps the exact previous behavior.

### 2d. Removing `autoFocus` caused no behavioral regression — CONFIRMED

- QuickAdd typing, Enter-to-add affordance, disabled/enabled `Add` button: intact.
- CommandPalette combobox filtering, `aria-activedescendant="nav-/today"` pointing at
  the selected option: intact.
- ItemEditorSheet `titleRef` is only attached when `draft` exists
  (`ItemEditorSheet.tsx:66` early-returns `null` while the editor is opening). Because
  `Sheet` is not mounted at all on that first commit, the trap's effect runs on mount
  with `trapRef.current` set — no missed-arm race. Confirmed empirically: the Title
  input was focused on every one of 4 opens (2 widths × 2 opens).
- Full suite green twice in a row after restoring the source (128/128), including the
  10 pre-existing smoke/mount tests.

---

## 3. Gates

```
npm run typecheck   → exit 0, no output
npm run lint        → exit 0, 0 errors 0 warnings
npm run test        → Test Files 20 passed (20) | Tests 128 passed (128)  [was 16 files / 118 tests at HEAD]
npm run build       → exit 0, built in 10.5s, PWA precache written
```

Baseline confirmed: `HEAD` (695d756) = 16 files / 118 tests, all green. Delta is
exactly +4 files / +10 tests, matching the claimed additions. No test was modified or
deleted. All four gates re-run **after** restoring the mutation (section 4) — still
green, so the tree I measured is the tree I verified.

---

## 4. Mutation check

### 4a. Revert the focus-preference line (the requested check)

Mutation: `src/hooks/useFocusTrap.ts:21-22` reduced to `const target = focusable[0] ?? container;`
(i.e. `initialFocus` ignored — equivalent to the pre-change trap).

```
npx vitest run src/hooks/useFocusTrap.test.tsx src/features/quickadd/QuickAdd.test.tsx \
                 src/features/command/CommandPalette.test.tsx src/features/item/ItemEditorSheet.test.tsx
→ Test Files  1 passed | 3 failed (4)
→ Tests       2 passed | 8 failed (10)
```

The 8 failures are exactly the preference-sensitive assertions
(`useFocusTrap.test.tsx:93`, `:123`, `QuickAdd.test.tsx:36,71`,
`CommandPalette.test.tsx:57,82`, `ItemEditorSheet.test.tsx:63,89`). The 2 survivors are
correctly preference-independent (`:68` fallback-to-first-focusable, `:103` Tab wrap) —
they are the control group and _should_ survive.

> Correction to the implementation report: it states "9 of 10 fail". The measured
> number is **8 of 10**. The report's direction is right; the count is off by one.
> Report-only inaccuracy, no code impact.

### 4b. Per-overlay wiring mutations (extra rigor)

Removing `initialFocusRef={…}` from each call site individually, one at a time:

| Mutation                                                  | Result                           |
| --------------------------------------------------------- | -------------------------------- |
| `QuickAdd.tsx` (drop `initialFocusRef={inputRef}`)        | `Tests 1 failed \| 1 passed (2)` |
| `CommandPalette.tsx` (drop `initialFocusRef={inputRef}`)  | `Tests 2 failed \| 0 passed (2)` |
| `ItemEditorSheet.tsx` (drop `initialFocusRef={titleRef}`) | `Tests 2 failed \| 0 passed (2)` |

Every overlay's wiring is independently pinned by a failing-when-broken test — the
suite is not passing by accident.

### 4c. Restoration

All mutated files restored from byte-identical backups and verified:
`md5` pairs match for `useFocusTrap.ts`, `QuickAdd.tsx`, `CommandPalette.tsx`,
`ItemEditorSheet.tsx`; `npx prettier --check` clean; `git diff --stat src/` matches the
original 7-file change exactly. **No mutation residue.** Nothing was committed.

---

## 5. Browser verification (Playwright MCP)

- Server: `npm run preview` → `http://localhost:4173/eisenmatrix-calendar/`, stopped after the run.
- **Stale-SW guard:** the first load was served from a cached service worker
  (`index-P_hezT4P.js`, `navigator.serviceWorker.controller === true`) — a stale bundle
  that predates this change. Unregistered all SWs, deleted all caches, reloaded with a
  cache-buster. Confirmed the fresh build was live before measuring:
  `document.querySelector('script').src` → `index-Dl0aOAV8.js`, matching
  `dist/assets/index-Dl0aOAV8.js` from `npm run build`.
  _(This reproduces the stale-SW trap flagged in `.improve/reports/discovered-IMP-009.md`;
  it is a pre-existing PWA/precache property, not caused by IMP-009.)_
- Widths: 1280×800 and 390×844.

| #   | Action                       | `document.activeElement`                                                       | First focusable in DOM (what the old trap chose) |
| --- | ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| 1   | press `c` (1280)             | `INPUT` placeholder `pay electricity $120 every month on the 5th !urgent`      | `button[aria-label="Close dialog"]`              |
| 2   | press `/` (1280)             | `INPUT[role=combobox]` `Search items, jump to a view, or run an action…`       | `Close dialog`                                   |
| 3   | click `Daily reading` (1280) | `INPUT` placeholder `What is it?`, value `Daily reading`, focusable index 4/18 | `Close panel`                                    |
| 4   | press `c` (390)              | same QuickAdd `INPUT`                                                          | `Close dialog`                                   |
| 5   | press `/` (390)              | same `INPUT[role=combobox]`                                                    | `Close dialog`                                   |
| 6   | click `Daily reading` (390)  | same Title `INPUT`, value `Daily reading`                                      | `Close panel`                                    |

**AC1 ✓** (rows 1, 4) · **AC2 ✓** (rows 2, 5) · **AC3 ✓** (rows 3, 6) ·
**AC4 ✓** (Tab/Shift+Tab wrap + Escape restore, section 2a/2b).
Focus rings are visibly rendered on the primary input in every screenshot.

### Console

```
playwright_browser_console_messages  →  [] (empty)
```

Zero console messages of any severity across page load + all six overlay
open/close cycles at both widths. The capture path was then validated by emitting
two sentinel messages from the page — both were captured, so the empty result is a
true zero and not a broken collector. **Zero new console errors.**

### Screenshots — `.improve/artifacts/IMP-009/`

| File                               | Bytes  |
| ---------------------------------- | ------ |
| `desktop-1280-quick-add.png`       | 130438 |
| `desktop-1280-command-palette.png` | 113835 |
| `desktop-1280-item-editor.png`     | 123565 |
| `mobile-390-quick-add.png`         | 70059  |
| `mobile-390-command-palette.png`   | 55726  |
| `mobile-390-item-editor.png`       | 32312  |

Naming follows the existing `desktop-1280-*` / `mobile-390-*` convention used in
`.improve/artifacts/IMP-049/`. The Playwright scratch dir `.playwright-mcp/` was
removed after copying.

---

## 6. Findings

### Blocking

None.

### Non-blocking (actionable, none required for PASS)

1. **Reverse-wrap (Shift+Tab) has no unit test.**
   `useFocusTrap.test.tsx:103-114` asserts only the forward wrap. The reverse branch
   (`useFocusTrap.ts:33-36`) is covered by nothing in CI — I verified it manually in
   the browser (Close → Cancel). The implementation report's phrase "Tab wrap both
   directions" overstates what the suite pins.
   _Suggested:_ extend that test with a first-focusable + `shiftKey: true` dispatch
   asserting the last focusable receives focus.
2. **Latent footgun in the new dep array.** `[active, initialFocus]` is only safe
   because every call site passes a stable `useRef`. Passing an inline object literal
   (`initialFocusRef={{ current: el }}`) would re-run the effect on every render,
   re-capturing `previouslyFocused` and re-firing `focusInitial` — exactly the
   "steal focus from the user" failure mode 2c guards against. Nothing documents or
   enforces the contract.
   _Suggested:_ a one-line JSDoc on the hook param ("must be a stable ref object"),
   and/or a test asserting focus is not re-applied when children re-render.
3. **Harness duplication.** The ~20-line render harness plus
   `declare global { var IS_REACT_ACT_ENVIRONMENT }` is copy-pasted into 4 new test
   files (a 5th copy already existed in `NotesView.test.tsx`). The repo has no Vitest
   setup file, so this is consistent with precedent rather than a violation — but 4x
   duplication is the point where a shared `src/test/harness.ts` pays for itself.
4. **Weak assertion** at `QuickAdd.test.tsx:38`
   (`expect(activeElement?.getAttribute('aria-label')).not.toBe('Close dialog')`).
   The meaningful assertion is `:36-37`; `:38` can only fail if the input is also
   labelled "Close dialog". Harmless, but it reads as coverage it isn't.

### Informational

- The initial focus still lands on a 20 ms `setTimeout` (unchanged), so there is a
  ~20 ms window after opening where focus is still on the opener rather than the
  input. `autoFocus` closed that window synchronously. Unreachable in practice —
  human reaction time is >150 ms, and typing was verified to work — but it is the one
  real behavioral delta of removing `autoFocus`. The implementation report already
  discloses this. Not a regression worth blocking; worth remembering if a future
  "type immediately after `⌘K`" complaint appears.
- `ConfirmDialog`, `SettingsView` and `ShortcutSheet` still get first-focusable
  (Close) focus. Correct and unchanged; naming those in a backlog item would be a
  reasonable follow-up if desired, not a gap in IMP-009.

---

## 7. Acceptance-criteria scorecard

| AC  | Criterion                                                    | Result  | Evidence                                                                                  |
| --- | ------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------- |
| 1   | QuickAdd focuses its textbox on open                         | **MET** | Browser rows 1 & 4; `QuickAdd.test.tsx:29-38`; mutation 4b (fails when unwired)           |
| 2   | CommandPalette focuses its combobox/input on open            | **MET** | Browser rows 2 & 5; `CommandPalette.test.tsx:50-57`; mutation 4b                          |
| 3   | ItemEditorSheet focuses the Title input on open              | **MET** | Browser rows 3 & 6; `ItemEditorSheet.test.tsx:56-63`; mutation 4b                         |
| 4   | Escape/Tab trapping still works; focus returns to the opener | **MET** | §2a both wrap directions live; §2b 6/6 Escape restores; `useFocusTrap.ts:25-47` unchanged |
| —   | No scope creep / debug leftovers / secrets                   | **MET** | §1 — 7 files, all in the backlog's stated file list; no logs/TODOs/secrets                |
| —   | Gates green                                                  | **MET** | §3 — 20 files / 128 tests, typecheck + lint + build clean                                 |
| —   | New tests fail when the fix is reverted                      | **MET** | §4a 8/10 fail; §4b each overlay independently pinned                                      |
| —   | Visual at 1280 + 390, zero new console errors                | **MET** | §5 — 6 screenshots, console list empty and probe-validated                                |

**Final: PASS.**
