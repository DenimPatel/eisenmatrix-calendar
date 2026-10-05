# Regression Sweep 40 — EisenMatrix Calendar

**Branch:** `improve/auto-20261003`
**HEAD:** `b9f4151` — *fix(shell): make every mobile nav destination reachable at 390px [IMP-024]* (counter commit 40)
**Baseline for additivity:** `b9d2324`
**Sweep date:** 2026-10-05
**Verdict:** **CLEAN** — no regressions found.

Changes in scope since sweep #30:

| Commit | Item | Summary |
| --- | --- | --- |
| `9c5de51` | IMP-052 | ICS RFC 5545 line folding (octet-safe) |
| `a4c1793` | IMP-053 | Calendar "+N more" expands to the full occurrence list |
| `b9f4151` | IMP-024 | Mobile bottom-nav redesign + new `src/lib/layout.ts`, shared toast/main offset mechanism, safe-area inset |

`b9f4151` is the only commit that changed product code in the sweep-30 → sweep-40 window.
Non-test files touched by it: `src/components/ui/ToastHost.tsx`,
`src/features/shell/AppShell.tsx`, `src/features/shell/MobileBottomNav.tsx`,
`src/lib/layout.ts`.

---

## 1. Full gates

All four gates pass. Exact output:

| Gate | Command | Exit | Result |
| --- | --- | --- | --- |
| Typecheck | `npm run typecheck` | 0 | 0 errors, 0 warnings (`tsc --noEmit`) |
| Lint | `npm run lint` | 0 | 0 errors, 0 warnings across the repo |
| Test | `npm run test` | 0 (×5) | **31 test files / 302 tests passed**, 0 failed, 0 skipped |
| Build | `npm run build` | 0 | 2108 modules, `dist/index-BEp28GaM.js` 368.85 kB (gzip 110.17 kB), service worker `dist/sw.js`, 18 precache entries (612.30 KiB) |

### Determinism — 5 consecutive `npm run test` runs

| Run | Exit | Test Files | Tests | Unhandled / stderr |
| --- | --- | --- | --- | --- |
| 1 | 0 | 31 passed (31) | 302 passed (302) | none |
| 2 | 0 | 31 passed (31) | 302 passed (302) | none |
| 3 | 0 | 31 passed (31) | 302 passed (302) | none |
| 4 | 0 | 31 passed (31) | 302 passed (302) | none |
| 5 | 0 | 31 passed (31) | 302 passed (302) | none |

All five runs exit 0 with identical counts. A grep for `unhandled`,
`unhandledRejection`, `stderr` and `Worker` across all five logs returns zero
matches — no unhandled rejections, no stray stderr output, no worker crashes.

---

## 2. Baseline / strictly-additive verification

Baseline `b9d2324`: **10 test files, 49 `it()`/`test()` cases** (independently
re-counted from the tree, not taken on trust). HEAD: **31 test files, 302 tests**.

`git diff b9d2324..HEAD --stat` over test files:

```
 27 files changed, 5126 insertions(+), 13 deletions(-)
```

Checks performed:

- **No deleted files anywhere in the range.** `git diff b9d2324..HEAD --diff-filter=D --name-only` → empty.
- **No `.only` / `.skip` / `.todo`** anywhere in `src/**/*.test.*`. Zero matches.
- **No new `@ts-ignore` / `@ts-expect-error` / eslint-disable** in test files (part of the clean lint pass).
- **The 13 deleted lines are all accounted for and none weaken an assertion:**
  - 2 lines: `src/domain/recurrence.test.ts` and `src/domain/reminders.test.ts` — the `describe(...)` title was reworded in each. Purely cosmetic.
  - 11 lines: `src/domain/recurrence.test.ts` — the single `"applies per-occurrence overrides"` case was refactored into an `only()` local helper (`occKey → expected {title, start}` table) that is driven by 8 cases. The refactor **added** an assertion (`expect(occ?.completedAt).toBe(1)`), so the case set and strength both grew.

  No assertion was removed, relaxed from `toBe`/`toEqual` to a looser matcher,
  or wrapped in a conditional. Growth is strictly additive.

---

## 3. Playwright pass — all 10 routes × 2 viewports × 2 themes

Environment: `npm run dev` (Vite 6, `http://localhost:3000/eisenmatrix-calendar/`),
Playwright MCP Chromium. Routes exercised: `/today`, `/calendar`, `/matrix`,
`/lists`, `/goals`, `/habits`, `/bills`, `/shopping`, `/notes`, `/settings`.

Viewports: **1280×800** (desktop) and **390×844** (mobile).
Themes: **light** and **dark**, both driven through the app's own
`setTheme` + persisted settings (not just a class toggle).

Result: all 10 routes rendered correctly in all four combinations.
`document.documentElement.scrollWidth` never exceeded `innerWidth` on any
route in any combination; the query for elements whose `getBoundingClientRect().right`
exceeded the viewport returned an empty list on all 40 route renders. **No horizontal scroll anywhere.**

### Interactions exercised

| Interaction | Viewport / theme | Result |
| --- | --- | --- |
| Quick add (`C`, typed `Design review 3pm today !important`) | 1280×800 light | Parsed to title `Design review` + chips `task` / `2026-10-05` / `15:00` / `important`; committed with Enter, toast `Added "Design review"`, Oct 5 cell went `+1 more` → `+2 more` |
| Item editor open (occurrence-scoped) | 1280×800 light | Sheet opened scoped to `Occurrence 2026-10-05`, title autofocused, importance showed `High` from `!important` |
| Editor save | 1280×800 light | Title → `Design review (edited)`; chip updated live; toast `Saved` |
| Editor undo (`⌘Z`) | 1280×800 light | Title reverted to `Design review`; toast `Undone` |
| Habit toggle | 1280×800 light | `○` → `✓`, aria `Complete today` → `Undo today`, streak `2 day streak` → `3 day streak`, Best 2 → 3 |
| Habit undo (`⌘Z`) | 1280×800 light | Reverted to `○` / `Complete today`, streak back to 2, toast `Undone` |
| Command palette (`⌘K`, query `shop`) | 1280×800 light | Opens with modal backdrop; fuzzy match filtered to the 2 matching items |
| Shortcut sheet (`?`) | 1280×800 light | Opens over a dimmed backdrop with the full shortcut table |
| Calendar **day / week / month / year** | 1280×800 light + dark, 390×844 light + dark | All four views render; day view exposes per-occurrence `Mark as done`; week view preserves an expanded month cell |
| Calendar "+N more" expand + collapse | both viewports, both themes | See §4(b) |
| Settings **Export JSON** | 1280×800 light | `eisenmatrix-backup-2026-10-05.json` downloaded, toast `Exported 1 file` |
| Settings **Export ICS** | 1280×800 light | `eisenmatrix-calendar-2026-10-05.ics` downloaded; validated on disk in §4(a) |
| Settings **Import JSON** (conflict = `Keep both (new id)`) | 1280×800 light | `Imported 22 items · skipped 0 · overwritten 0 · duplicated 22`; item count 22 → 44; `Import complete` dialog with `Done`; then de-duplicated back to the fixture |
| Toast with **Undo** action over the mobile nav | 390×844 light + dark | See §4(c) |

### Console errors / warnings / failed requests

An in-page collector (`console.error`, `console.warn`, `window.onerror`,
`unhandledrejection`, and a `fetch` wrapper rejecting non-2xx same-origin
responses) was installed before the pass and read after it:

```json
{ "consoleErrors": [], "consoleWarnings": [], "failedRequests": [], "pageErrors": [] }
```

The MCP-level console/network logs report exactly **one** 404 —
`http://localhost:3000/eisenmatrix-calendomain/stats.ts` — which is a typo in a
*sweeper-authored* diagnostic dynamic import, not an application request. No app
module, chunk, font, or service-worker request failed. No React `key` warning, no
`act()` warning, no Dexie error.

**Net: 0 application console errors/warnings and 0 failed requests — baseline of 0 held.**

---

## 4. Spot-checks

### (a) ICS export still parses after folding

Two independent verifications.

**1. Unit-level, via the app's own `itemsToCS`.** A throwaway spec was written to
`src/__scratch40.test.ts`, run with `npx vitest run`, and **deleted afterwards**
(`git status` confirmed clean). 4/4 cases passed against a fixture containing a
120-char ASCII title, 30× CJK title, 80× emoji notes/location, a 7-day
`BYDAY` RRULE with `UNTIL`, and a long `VALARM` label:

- every physical line ≤ 75 octets (longest measured in the 71–75 band)
- CRLF only; every continuation line is single-space prefixed, none double-space
- unfolds to `BEGIN:VCALENDAR`/`END:VCALENDAR` with balanced 3× `BEGIN:VEVENT`/`END:VEVENT`
  and balanced `VALARM`
- every unfolded logical line matches `^[A-Z-]+[;:]` — 0 malformed
- `SUMMARY`, `DESCRIPTION`, `DTSTART:20260304T090000`,
  `DTSTART;VALUE=DATE:20260305`,
  `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=SU,MO,TU,WE,TH,FR,SA;UNTIL=20261231`,
  `TRIGGER:-P1D` all round-trip byte-exactly
- CJK and emoji survive the fold byte-exactly; **no `U+FFFD`** anywhere, i.e. folding
  never split a UTF-8 sequence

**2. End-to-end, on the file the UI actually downloaded**
(`.playwright-mcp/eisenmatrix-calendar-2026-10-05.ics`, 14 `VEVENT`s, one with a
deliberately over-long title):

| Check | Result |
| --- | --- |
| Max octets on any physical line | ≤ 75 |
| Lines > 75 octets | 0 |
| Bare `\n` outside CRLF | 0 |
| Folded continuation lines | 4 |
| `VEVENT` open/close balance | 14 / 14 |
| `VALARM` open/close balance | balanced |
| Malformed logical lines after unfolding | 0 |
| Longest unfolded `SUMMARY` | 151 chars (folds to 3 physical lines) |
| Contains `U+FFFD` | no |

**Verdict: ICS folding (IMP-052) produces RFC 5545-conformant, losslessly
unfoldable output in both the unit path and the real download.**

### (b) Calendar "+N more" expands and collapses; occurrence state survives

- Expand: Oct 5 2026 had 11 occurrences; the cell showed 3 chips + `+8 more`/`+7 more`
  depending on fixture density. Clicking it revealed **all 11 chips** and the label
  became `Show less` with `aria-expanded="true"`.
- Collapse: clicking `Show less` restored 3 chips + the `+N more` label and
  `aria-expanded="false"`.
- Occurrence state: in **day view** an occurrence was marked done
  (`Mark as done` → `Mark as not done`). Returning to month view the chip rendered
  with `line-through text-muted`, and IndexedDB held
  `occurrences["2026-10-05"] = { status: 'done', completedAt: <ts> }` while the
  parent item's `status` stayed `'todo'` — occurrence-scoped completion, IMP-016 intact.
- **Survives round-trip:** measured `line-through` + `text-muted` before collapse,
  after collapse (3 chips), and after re-expanding (11 chips). The done styling was
  identical in all three states, i.e. expand/collapse does not lose or reset
  occurrence state.
- Expansion also survives a month → week → month view switch within the same mount
  (week view showed the expanded Mon cell with `Show less`).
- Works at 390px as well as 1280px, light and dark.

**Design note (not a defect):** expansion is *mutually exclusive across cells* —
`CalendarView.tsx:47` holds a single `expandedDay: string | null`, so opening
Oct 5 collapses a previously expanded Sep 29. Same pattern for the year view
(`CalendarView.tsx:342`). This is intentional single-open behaviour, not a leak.

### (c) Mobile nav at 390px

| Check | Result |
| --- | --- |
| All 10 destinations reachable **with no swipe** | Yes — `grid-cols-5`, two rows; all 10 links present and tappable. Every one was clicked and navigated correctly |
| Nav bar geometry | `position: fixed`, `top: 743`, `height: 101` at an 844px viewport |
| `--mobile-nav-h` published | `100px` (measured grid height), consumed by `ToastHost` and `main` |
| `main` bottom padding | `128px` — last content never ends under the bar |
| Toast / nav **overlap** | **0 px.** Toast bottom `728`, nav top `743` → 15 px clearance, in light and dark |
| Toast `Undo` tappability | `document.elementFromPoint` at the Undo button's centre returns the **Undo button**, not a nav cell — the `pointer-events-auto` Undo action is not intercepted |
| Undo action works | Yes — bulk-deleted `Sourdough`, tapped `Undo` in the toast, item restored (19 → 20) |
| **Active state on deep link** | `a[aria-current="page"]` matched the current route on **all 10** routes in both themes |
| Horizontal scroll | none |
| Safe-area inset | bar height 101 px vs 100 px measured grid — the 1 px delta is the `env(safe-area-inset-bottom)` reserve, which correctly degrades to 0 in a desktop-class browser |

### (d) Desktop rail at 1280px unchanged

- Rail present and visible on all 10 routes at 1280×800, both themes.
- Measured rail width **224 px** on every route — identical to the pre-IMP-024 value.
- Mobile bar is `display: none` at 1280px on every route; `--mobile-nav-h` resolves to
  `0px` there, and `ToastHost` correctly falls back to `sm:bottom-4` (measured toast
  bottom `784` = 800 − 16 px), so desktop toast placement is unchanged.
- Diff-level confirmation: `git show b9f4151 -- src/features/shell/AppShell.tsx` shows the
  desktop `<aside>` rail body is untouched — the only rail-side edit is an added
  `aria-label="Primary sections"` (a11y, to disambiguate the two nav landmarks for screen
  readers). The `<main>` edit only changes the *mobile* bottom padding
  (`pb-24` → `pb-[calc(var(--mobile-nav-h,7rem)+env(safe-area-inset-bottom)+1.75rem)]`);
  `sm:p-5 sm:pb-6` is preserved verbatim.

### (e) IMP-017 reverted; IMP-007/010/011/018 intact

| Item | Status | Evidence |
| --- | --- | --- |
| **IMP-017** must stay reverted | **Absent — correct** | `rg -n 'trimDanglingTail' src/` → no matches anywhere |
| **IMP-007** note draft split | intact | `quickadd.ts:387 splitNoteDraft` — title clamped to `NOTE_TITLE_MAX`, overflow prepended to `notes`; covered by 2 tests |
| **IMP-010** lone weekday | intact | `quickadd.ts:212 loneWeekday`, resolved via `nextWeekday` at `:306-307` (a lone weekday name resolves to the next such day rather than a month-day); covered by 3 tests |
| **IMP-011** month-day clamp | intact | `quickadd.ts:61 nextMonthDay` clamps with `clampDayOfMonth` from `@/lib/date` on both the current and next month, so Jan 31 → Feb 28/29 rather than skipping; covered by "parses the 31st into February" / "resolves 'on the 5th' to the 5th of next month" |
| **IMP-018** quick-added habit → daily series | intact | `quickadd.ts:433` — `item.recurrence = parsed.recurrence ?? (parsed.kind === 'habit' ? baseRule('daily') : null)`; covered by "quick-adding a habit defaults to a daily recurrence" |

---

## 5. GitHub workflow YAMLs

Three YAML files exist under `.github/`. All three parse cleanly with `js-yaml`
(no syntax errors, no unexpected keys):

| File | Parse | Structure |
| --- | --- | --- |
| `.github/workflows/ci.yml` | OK | single job `gate`, 8 steps: Checkout → Set up Node → Install → **Audit dependencies** → **Typecheck** → **Lint** → **Test** → **Build**. Triggers: `pull_request`, `push` (main), `workflow_dispatch`, `workflow_call` |
| `.github/workflows/deploy.yml` | OK | jobs `gate` (reusable call to `./.github/workflows/ci.yml`), `build` (5 steps: Checkout → Node → `npm ci` → Build → Upload artifact), `deploy` (`needs: [build, gate]` → `actions/deploy-pages@v4`, `environment: github-pages`). `permissions: contents: read, pages: write, id-token: write` |
| `.github/dependabot.yml` | OK | `version: 2`, 2 update entries |

**Ordering is intact.** `deploy` declares `needs: [build, gate]`, so a Pages
deployment cannot start until *both* the Pages build and the reusable CI gate
(audit + typecheck + lint + test + build) have succeeded. `ci.yml` still exposes
`workflow_call`, which is what makes the `gate` job in `deploy.yml` legal. The
audit step remains the first quality gate in `ci.yml`, ahead of typecheck/lint/test.

---

## 6. Findings

**No regressions.** Every gate, every route, both viewports, both themes, and all
five mandated interaction flows behaved correctly. Console/network error count
is unchanged from the baseline of 0.

### Non-blocking observations (pre-existing; not introduced by IMP-052/053/024)

1. **Month-cell expansion is mutually exclusive across the grid.** `CalendarView.tsx:47`
   keeps a single `expandedDay`, so opening one cell collapses another. Intentional,
   but undocumented — a multi-cell `Set<string>` would be a small UX upgrade. Low value.
2. **At 390 px the expanded cell's "Show less" label truncates to "Sho…"** in the month
   grid because the cell is ~51 px wide. Cosmetic only; the control is still correctly
   sized, labelled and tappable, and `aria-expanded` is correct.
3. **The shortcut sheet's focus trap puts the initial focus ring on the dialog heading**
   (`Keyboard shortcuts`), so a blue ring frames the title on open. Accessibility-neutral
   (it is inside the trapped region) but visually noisy. Pre-existing; `ShortcutSheet.tsx`
   was not touched by this batch.
4. **`createItem` hardcodes `recurrence: null` and silently ignores `recurrence` /
   `occurrences` in its options object** — `normalizeItem` is the coercing factory.
   A caller that assumes `createItem({ kind: 'habit', recurrence })` produces a recurring
   habit gets a non-recurring one. Not a product bug on its own, but it makes the
   factory easy to misuse.
5. **Narrow edge case, latent:** on a habit with **no recurrence** whose `start` is in
   the past, `expandOccurrences(habit, todayStart, todayEnd)` returns `[]`, so
   `HabitsView` renders no `occ[0]`; `toggleDone` then falls back to `occ?.occKey ?? today`
   and writes an `occurrences[today]` entry that no occurrence ever resolves to — the
   checkbox appears not to change while a row *is* written to IndexedDB. Reachable only
   by creating a habit and then editing its start into the past without setting a
   recurrence rule. `toggleDone`/`HabitsView` were **not** touched by `b9f4151`
   (the commit's non-test footprint is `ToastHost.tsx`, `AppShell.tsx`,
   `MobileBottomNav.tsx`, `layout.ts`), so this predates the current batch. Worth a
   backlog item: have `toggleDone` refuse to write when the expanded window has no
   occurrence, or have `createItem` give new habits a daily rule the way `quickAddToItem`
   does (IMP-018).

### Harness notes (disclosed for reproducibility)

- The ICS unit-level check (§4a) used a temporary spec at `src/__scratch40.test.ts`,
  run once, then **deleted**; `git status` is clean apart from the pre-existing
  `.improve/PROGRESS.log` orchestrator entry and the untracked `.kilo/` directory.
- Toasts auto-dismiss after 4000 ms (`useUiStore.pushToast`), which is shorter than an
  MCP round trip. For the two "toast with Undo over the mobile nav" captures, the
  dismiss timer was neutralised *in the page* (a `setTimeout` shim returning early for
  the 4000 ms duration only) so the toast could be photographed. The toast content, its
  `Undo` button, the Undo round-trip and the geometry measurements are all from the
  real code path; the shim was removed immediately afterwards and `window.setTimeout`
  restored. No product code was modified.
- Fixture data was seeded through the app's own modules (`db/schema.ts`,
  `domain/itemFactory.ts`, `db/repository.ts`) so the real Dexie schema and
  `normalizeItem` coercion were exercised.
- Screenshots: **51 PNGs** in `.improve/artifacts/regression-40/` —
  desktop 1280×800 light ×15 and dark ×13 (all 10 routes plus quick-add, item editor,
  command palette, shortcut sheet and calendar month/week/year),
  mobile 390×844 light ×11 and dark ×10 (all 10 routes in dark; the dark lists view is
  captured inside `mobile-390x844-dark-toast-undo-over-nav.png`), plus the two
  expanded "+N more" states per theme per viewport and both Undo-toast captures.
- The Playwright MCP writes screenshots to `.playwright-mcp/`; they were moved into
  `.improve/artifacts/regression-40/` as required (both paths are in
  `.git/info/exclude`, so nothing is staged).

### State

Nothing was fixed and nothing was committed, as instructed. This report is the only
tracked-file addition (`.improve/reports/regression-40.md`, untracked).