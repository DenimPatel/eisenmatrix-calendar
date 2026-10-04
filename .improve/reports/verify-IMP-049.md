# Verify — IMP-049 (calendar honors `weekStartsOn`)

**Verdict: PASS** (all four acceptance criteria met; 3 non-blocking housekeeping/noise issues)

Independent reviewer. Did not write the change. Branch `improve/auto-20261003`, HEAD `7865c75`,
all IMP-049 work is **uncommitted working-tree** state.

---

## 1. Change under review

```
 M .improve/PROGRESS.log          <- UNRELATED (see Issues #1)
 M src/features/calendar/CalendarView.tsx   (+11/-6)
 M src/lib/labels.ts                        (+5)
?? src/lib/labels.test.ts                   (new, 18 lines)
?? src/features/calendar/CalendarView.test.tsx (new, 109 lines)
?? .improve/reports/{discovered,impl}-IMP-049.md
?? .kilo/                                   <- harness dir, NOT part of the item
```

No other source file touched. `dist/`, lockfile, `metadata.json`, `agents.md` untouched.
Grep for `console.*|debugger|TODO:|FIXME` in the 4 changed/added source files: **none**.
Grep diff for `api_key|secret|token|password|PRIVATE KEY`: **none**.

## 2. Acceptance criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `CalendarView` reads `weekStartsOn` from `useSetting<AppSettings>('app', DEFAULT_SETTINGS)` and uses it for week + month interval start/end | **MET** | `CalendarView.tsx:21,32-33,40-41` reads the setting; `:51-52` (week) and `:58-59` (month) pass `weekStartsOn` to `startOfWeek`/`endOfWeek`; `:65` adds it to the `useMemo` deps so a settings change re-derives the interval. `day`/`year` cases untouched (no week alignment involved) — correct and minimal. |
| 2 | Weekday header order derived from `weekStartsOn` (0 → Sun…Sat, 1 → Mon…Sun) | **MET** | `CalendarView.tsx:165` `weekdayLabels(weekStartsOn).map(...)` replaces the hardcoded array. Pure helper `weekdayLabels(weekStartsOn: 0 \| 1): string[]` at `src/lib/labels.ts:58-61` rotates the pre-existing `WEEKDAY_LABELS` const (no duplicated copy, no mutation of the source array). |
| 3 | `weekStartsOn=0` → first day cell of first week row is a Sunday; `=1` → Monday | **MET** | Browser (§4) and unit (`CalendarView.test.tsx:82,89,96,104-105`) evidence below. `2026-09-27` is a Sunday, `2026-09-28` a Monday. |
| 4 | Default (Monday) behavior unchanged | **MET** | `DEFAULT_SETTINGS.weekStartsOn` is still `1` (`src/types/settings.ts:20`); `weekdayLabels(1)` reproduces the exact previous header `Mon…Sun`; the live-query fallback also resolves to `1`, asserted by `CalendarView.test.tsx:93-98`. Visually identical to `.improve/artifacts/baseline/desktop-02-calendar.png` (Mon-first, 6 rows, first cell 2026-09-28). |

## 3. Gates (`npm run typecheck && npm run lint && npm run test && npm run build`)

| Gate | Result |
|------|--------|
| `typecheck` (`tsc --noEmit`) | PASS, no diagnostics |
| `lint` (`eslint .`) | PASS, no output |
| `test` (`vitest run`) | PASS — **14 files / 100 tests**, 9.54 s (baseline 10 files / 49; +51 = IMP-006's 31 committed earlier + 20 new) |
| `build` | PASS — `dist/sw.js` emitted, injectManifest, **precache 18 entries (602.71 KiB)** |

No regression vs baseline. Pre-existing benign `--localstorage-file` Node warning not shown in this run.

## 4. Visual check (Playwright MCP, `npm run preview` on :4173)

Setting persisted and confirmed in IndexedDB via `page.evaluate` on the `settings` store:
`{key:'app', value:{… weekStartsOn: 0 …}}`.

**Sunday (`weekStartsOn=0`), month view** — header `Sun Mon Tue Wed Thu Fri Sat`; first date cell
`aria-label="Add item on 2026-09-27"` (a Sunday); grid `2026-09-27 … 2026-10-31` (5 rows — correct:
Oct 2026 needs no 6th Mon-start week).
**Sunday, week view** — title `Sep 27 – Oct 3, 2026`; first cell `2026-09-27`.
**Monday (`weekStartsOn=1`), month view** — header `Mon Tue Wed Thu Fri Sat Sun`; first cell
`2026-09-28` (a Monday); grid `2026-09-28 … 2026-11-01` (6 rows) — byte-for-byte the pre-change behavior.
**Monday, week view** — title `Sep 28 – Oct 4, 2026`; first cell `2026-09-28`.

Layout / design integrity at **390 px**: `document.documentElement.scrollWidth === innerWidth === 390`
→ **no horizontal overflow**. Header row and day row share the same column geometry —
header `left` = `[13,65,117,169,221,273,325]`, first day-row week `left` = `[13,65,117,169,221,273,325]`,
all 35 cells and all 7 headers exactly **52 px** wide. No misalignment, no clipped labels, dividers
consistent, out-of-month cells still dimmed. The bottom-nav horizontal scroll visible at 390 px is the
pre-existing known defect recorded in `REPO_PROFILE.md` §7, unrelated to this change.
Dark theme re-checked at 1280 px: header row and grid render correctly on semantic tokens
(`bg-elevated`, `text-muted`, `border-border`), no hardcoded colors introduced.

**Console: zero messages** — no errors, no warnings — across every route/mode/width/theme visited
(`playwright_browser_console_messages` returned `[]` on both checks).

Screenshots (`.improve/artifacts/IMP-049/`):
`desktop-1280-sun-month.png`, `desktop-1280-sun-week.png`, `desktop-1280-mon-month.png`,
`desktop-1280-mon-week.png`, `desktop-1280-dark-mon-month.png`, `mobile-390-sun-month.png`,
`mobile-390-mon-month.png`.

## 5. Item's verification method (unit tests for the helper)

`npx vitest run src/lib/labels.test.ts src/features/calendar/CalendarView.test.tsx --reporter=verbose`
→ **2 files / 7 tests passed**.

- `weekdayLabels(0)` = `['Sun','Mon','Tue','Wed','Thu','Fri','Sat']`
- `weekdayLabels(1)` = `['Mon','Tue','Wed','Thu','Fri','Sat','Sun']`
- both length 7; `WEEKDAY_LABELS` not mutated
- `CalendarView`: Sunday-first grid, Monday-first grid, missing-setting → Monday fallback, and week-mode
  interval equal to `formatISODate(startOfWeek(now, weekStartsOn))` with the right `getDay()`

## 6. Issues (all non-blocking)

1. **Unrelated change in the diff — `.improve/PROGRESS.log`.** The single added line is the
   `IMP-006 | done | 7865c75` entry, not IMP-049. `git show 7865c75 -- .improve/PROGRESS.log` shows the
   IMP-006 commit wrote the *IMP-005* line, so this is a pre-existing one-line bookkeeping lag. It must
   not be swept into the IMP-049 commit as-is; either drop it from the commit or land it separately.
2. **Backlog bookkeeping missing.** `.improve/FEATURES.md` IMP-049 is still `- **Status:** TODO` and there
   is no IMP-049 `PROGRESS.log` line. Every prior item (IMP-001…006) flipped FEATURES to `DONE` + appended
   a log line in the same commit. `impl-IMP-049.md:3` acknowledges this. Actionable: set `Status: DONE`
   with a Notes line and append the IMP-049 log row before committing.
3. **Test noise: 261 `The current testing environment is not configured to support act(...)` warnings.**
   Reproduce: `npx vitest run src/features/calendar/CalendarView.test.tsx --reporter=verbose | grep -c
   'not configured to support act'` → 261. Cause: `IS_REACT_ACT_ENVIRONMENT` is never set
   (`src/test/setup.ts` only imports `fake-indexeddb/auto`), and `waitForSettingApplied`
   (`CalendarView.test.tsx:37-46`) polls up to 200 × 5 ms so each Dexie live-query resolution lands
   outside `act`. The pre-existing `app.smoke.test.tsx` emits 4 under the same reporter, so the pattern is
   inherited, but this file amplifies it ~65×. `npm run test` still exits 0 (the default reporter suppresses
   stderr for passing files), so this is not a gate failure. Fix if you touch the file: set
   `globalThis.IS_REACT_ACT_ENVIRONMENT = true` in `src/test/setup.ts`, or wrap the whole mount-and-settle in
   a single `act`.
4. **Informational — transient Monday-first first paint.** Because `useSetting` seeds with
   `DEFAULT_SETTINGS`, a fresh load renders Monday-first for ~one frame before the live query resolves.
   Observed twice (Settings select and Calendar grid). Pre-existing hook behavior shared with
   `SettingsView`/`ItemEditorSheet`; not introduced here, not in scope, but a future flicker item.
5. **Informational — inconsistency left behind (out of scope, correctly untouched).**
   `src/features/habits/HabitsView.tsx:29` still hardcodes `startOfWeek(..., 1)` for its 7-day window, so
   Habits does not follow the setting either. IMP-049 scoped only `CalendarView`; flagging so it is not
   mistaken for a complete `weekStartsOn` sweep.
6. `.kilo/` is untracked harness infrastructure (created 22:05, before IMP-049 work at ~22:58) and must
   not be committed.

## 7. Conventions (`.improve/REPO_PROFILE.md` §5)

Persistence still via `settingsRepo` through `useSetting` — no direct Dexie in the feature. Dates via
`src/lib/date.ts` helpers with local `formatISODate` keys; no `toISOString()`. Display copy lives in
`src/lib/labels.ts`, helper is pure and unit-testable without mounting, exactly as the item's Notes
requested. Styling untouched, semantic tokens only. `day`/`year` modes unchanged. No new comments beyond
one JSDoc on the exported helper explaining non-obvious rotation intent. Layering respected
(features → lib leaf).