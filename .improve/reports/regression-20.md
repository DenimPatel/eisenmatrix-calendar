# Regression Sweep 20

**Branch:** `improve/auto-20261003`
**HEAD at sweep:** `1c1cbd5 IMP-068: detect test-suite state leakage`
**Baseline:** `b9d2324` (sweep 10 — 10 files / 49 tests, all green)
**Verdict:** **CLEAN** — no regressions. Two non-blocking discoveries logged below.

Changes covered since sweep 10: ICS `UNTIL` for all-day events, CSV import error handling
+ SettingsView tests, habit streak undo/history, legacy-migration localStorage capability probe.

---

## 1. Full gates

| Gate | Command | Result |
| --- | --- | --- |
| typecheck | `npm run typecheck` | **exit 0** — `tsc --noEmit` clean, 0 diagnostics |
| lint | `npm run lint` | **exit 0** — `eslint .` clean, 0 errors, 0 warnings |
| test | `npm run test` | **exit 0** — **23 test files / 175 tests**, 23 passed (23), 175 passed (175), 0 skipped, 0 todo, 0 failed |
| build | `npm run build` | **exit 0** — 53 modules, `✓ built in 70ms`, PWA `injectManifest`, 18 precache entries (604.12 KiB), `dist/sw.js` + `dist/sw.mjs` emitted |

Counts vs baseline: **10 → 23 test files (+13)**, **49 → 175 tests (+126)**.

### Five consecutive `npm run test` runs (IMP-068 flake class)

```
RUN1 exit=0 | Test Files  23 passed (23) | Tests  175 passed (175) | suspicious_lines=0
RUN2 exit=0 | Test Files  23 passed (23) | Tests  175 passed (175) | suspicious_lines=0
RUN3 exit=0 | Test Files  23 passed (23) | Tests  175 passed (175) | suspicious_lines=0
RUN4 exit=0 | Test Files  23 passed (23) | Tests  175 passed (175) | suspicious_lines=0
RUN5 exit=0 | Test Files  23 passed (23) | Tests  175 passed (175) | suspicious_lines=0
```

`suspicious_lines` counts matches for `unhandled | UnhandledRejection | FAIL | stderr | Errors`.
**5/5 exit 0, zero unhandled errors/rejections every run.** Identical counts across all five
runs — no count drift, no ordering-dependent state leakage.

---

## 2. Baseline comparison — nothing deleted, skipped, or weakened

`git diff b9d2324..HEAD --stat` → **109 files changed, 11447 insertions(+), 98 deletions(-)**.

Test-file roster (baseline 10 → HEAD 23, all 13 additions):

```
src/db/migrations/legacyTasks.test.ts        (+39 in diff — pre-existing file, extended)
src/domain/eisenhower.test.ts                NEW
src/domain/itemActions.test.ts               NEW
src/domain/quickadd.test.ts                  (extended)
src/domain/recurrence.test.ts                (extended)
src/domain/reminders.test.ts                 NEW
src/domain/stats.test.ts                     NEW
src/features/quickadd/QuickAdd.test.tsx      NEW
src/features/settings/SettingsView.test.tsx  NEW
src/hooks/useData.test.ts                    NEW
src/lib/csv.test.ts                          NEW
src/lib/date-fns.test.ts                     NEW
src/lib/ics.test.ts                          NEW
src/pwa/ReminderRuntime.test.ts              NEW
src/store/useUiStore.test.ts                 NEW
... (23 total)
```

Checks performed:

- **Deleted test files** (`--diff-filter=D`): **none**.
- **Removed `it(` / `test(` / `describe(` lines** across all `*.test.ts(x)`: **zero**.
- **`.only` / `.skip` / `.todo` anywhere in the repo's test files**: **none**.
- **Per-file `it(`/`test(` count, baseline vs HEAD** — every file grew or held:

  | File | base | head |
  | --- | --- | --- |
  | `src/lib/date-fns.test.ts` | 2 | 9 |
  | `src/db/migrations/legacyTasks.test.ts` | 4 | 10 |
  | `src/domain/recurrence.test.ts` | 5 | 33 |
  | `src/domain/quickadd.test.ts` | 6 | 19 |
  | `src/domain/eisenhower.test.ts` | 6 | 12 |
  | `src/domain/stats.test.ts` | 8 | 15 |
  | `src/lib/ics.test.ts` | 4 | 7 |
  | `src/lib/csv.test.ts` | 7 | 12 |
  | `src/domain/reminders.test.ts` | 7 | 12 |
  | `src/store/useUiStore.test.ts` | (new) | 7 |

  Remaining HEAD-only files (`itemActions`, `QuickAdd`, `SettingsView`, `useData`,
  `ReminderRuntime`) account for the remainder of the 175 total.

- **New CI workflow** `.github/workflows/ci.yml` (+40) gates on `typecheck → lint → test → build`,
  matching the local chain. `.github/workflows/deploy.yml` gained 7 lines (build gating).
- `.improve/**` accounts for the bulk of the 11k insertions — documentation, not product code.

**Conclusion: test count only grew. Nothing deleted, skipped, or weakened.**

---

## 3. Playwright pass — 0 console errors (baseline 0)

Server: `npm run preview` → `http://localhost:4173/eisenmatrix-calendar/`.
Viewports: **1280×900** and **390×844**. 22 screenshots in `.improve/artifacts/regression-20/`.

### Views visited

| View | Desktop | Mobile | Notes |
| --- | --- | --- | --- |
| Today | `desktop-13-today.png` | `mobile-01-today.png` | Overdue 2 · agenda 4 (1/4 done, 25%) · Habits 1 · Bills 1 · Goals 1 · "What's next" ribbon |
| Calendar — day | (default on entry) | — | |
| Calendar — week | `desktop-06-calendar-week.png` | — | Mon-first header (IMP-049); occurrence times shown (IMP-012); "+1 more" overflow |
| Calendar — month | `desktop-07-calendar-month.png` | `mobile-02-calendar-month.png` | Recurrences expand correctly; `byMonthDay=5` bill first fires Oct 5 |
| Calendar — year | `desktop-08-calendar-year.png` | — | Monthly aggregation correct |
| Matrix | `desktop-09-matrix.png` | `mobile-06-matrix.png` | Priority mapping Q2/Q3/Q4 correct; DnD zones present |
| Lists | `desktop-11-lists.png` | `mobile-04-lists.png` | All items 12 · Inbox 10 · Groceries 2 |
| Goals | `desktop-03-goals.png` | — | Goal created and rendered |
| Habits | `desktop-12-habits.png` | `mobile-03-habit-editor-history.png` | Streak + heatmap + History tab |
| Bills | `desktop-10-bills.png` | — | This month 120 / Paid 0 / Remaining 120; Upcoming (60 days) Oct 5 + Nov 5 |
| Shopping | `desktop-04-shopping.png` | — | Items added via inline composer |
| Notes | `desktop-05-notes.png` | — | 113-char second line **not truncated** (IMP-007 holds) |
| Settings | `desktop-16-settings.png` | `mobile-05-settings.png` | Export JSON/CSV/ICS, Save snapshot, Import JSON/CSV, Re-run legacy import, Reset all data |

### Interactions exercised

- **Quick add** — button and `C` shortcut (`desktop-01-quickadd.png`). Parser correctly derived
  kind `bill`, `start 2026-10-04`, recurrence `every month on the 5`, `USD 120`, `Urgent` from
  `pay electricity $120 every month on the 5th !urgent`. Primary input auto-focused on open
  (IMP-009 holds). Enter submits.
- **Item editor save + undo** — renamed an item, saved (toast "Saved"), `⌘/Ctrl+Z` reverted the
  title and toasted "Undone". Verified live in DOM.
- **Habit toggle + undo** — see §4(c). History tab records the streak delta.
- **Bill mark-paid + undo** — Paid 0→120, Remaining 120→0 (green); `⌘/Ctrl+Z` restored.
- **Command palette** — `⌘/Ctrl+K` (`desktop-14-command-palette.png`); typed `electr`, filtered
  to `Pay electricity / Bill`. `Esc` closes.
- **Shortcuts sheet** — `?` (`desktop-15-shortcuts-sheet.png`); all 8 bindings listed.
- **Other shortcuts** — `n` opens new task, `Esc` closes sheets, `1–9` view jump palette entries present.

### Console / network

Instrumented `console.error`, `console.warn`, `window.onerror`, and
`unhandledrejection` in-page, then walked **all 10 routes at 390px** plus a quick-add open/close:

```json
{ "errors": [], "rejections": [], "warnings": [] }
```

- **Console errors: 0** (baseline 0) — no change.
- **Console warnings: 0**.
- **Unhandled rejections: 0**.
- **Failed network requests: 0** — `browser_network_requests` empty; `vite preview` access log
  shows no 404/5xx.
- `browser_console_messages` returned an empty result at every checkpoint.

---

## 4. Targeted spot-checks of behaviour changed since sweep 10

### (a) ICS export of an all-day recurring item → bare `UNTIL=YYYYMMDD` — **PASS**

Created an all-day recurring task (start `2026-10-04`, all-day, repeat daily, *Ends → On date*
`2026-12-31`) and used **Settings → Export ICS**. From the downloaded
`eisenmatrix-calendar-2026-10-05.ics` (archived at
`.improve/artifacts/regression-20/ics-export-verified.ics`):

```
DTSTART;VALUE=DATE:20261004
RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20261231
```

`DTSTART;VALUE=DATE` pairs with a bare `UNTIL=20261231` (no `T`/`Z`) — RFC-5545 §3.3.10
conformance. **No regression.**

Also confirmed on the same export:

- All-day recurring item → no `DTEND` emitted (correct per RFC-5545 §3.6.1).
- Non-recurring bill → no spurious `UNTIL` (IMP-014 intact).
- Timed item → `DTSTART:20261001T090000Z` + `DTEND:…T093000Z` + `RRULE:FREQ=WEEKLY;UNTIL=20261231T235959Z`
  (date-time form retained for timed recurrences).
- Unit level: `npx vitest run src/lib/ics.test.ts` → 7/7 pass.

### (b) Settings CSV import of a valid file still reports success — **PASS**

Exported a real CSV from Settings, appended one distinct row, re-imported it:

```
Import complete
Imported 1 items · skipped 0 · overwritten 0 · duplicated 0
toast (success): "CSV imported"
```

Item count 4 → 5. Round-trip intact. **No regression.**

Error path also verified via **Import JSON** with truncated JSON:

```
toast (error): "Import failed: Unexpected end of JSON input"
```

Item count unchanged, no crash, no unhandled rejection — the IMP-015 hardening works.

### (c) Habit toggle then `⌘/Cmd+Z` restores streak and status — **PASS**

1. Created habit `Drink water`, target 1×/day, unit `glasses`. Streak **0**, Best **0**.
2. Clicked the today toggle → streak **1**, Best **1**, button flipped to "Undo today" (✓).
3. `⌘/Ctrl+Z` → streak **0**, Best **0**, button back to "Complete today" (○), toast "Undone".
4. Re-toggled and opened **History (1)** — one entry recording `current 0 → 1`, `best 0 → 1`.

Both the streak/stat reversion and the history record required by IMP-050 are present.
Verified again at 390px. **No regression.**

### (d) App boots cleanly with no unhandled rejection — **PASS**

- Cold load of `/eisenmatrix-calendar/` → 0 console messages, 0 failed requests.
- Hard reload (`location.reload()`) with migration pending → 0 console messages,
  0 `unhandledrejection`.
- All 10 routes walked with error/warn/rejection hooks installed → all arrays empty.

### (e) Legacy localStorage migration still runs when data is present — **PASS**

Seeded `localStorage['eisenmatrix-tasks']` with a 2-task v1 payload (mixed
`YYYY-MM-DD` and ISO-week `2026-W40` completion keys), deleted the
`migration.legacy` marker, then hard-reloaded:

| Check | Result |
| --- | --- |
| Items imported | 6 → **8** |
| `settings['migration.legacy']` written | `{ ranAt: …, version: 1, imported: 2 }` |
| `backups` row | `reason: 'legacy-v1-migration'` |
| `localStorage['eisenmatrix-tasks.v1.bak']` written | **yes** |
| Daily key `2026-10-02` → occurrence | `2026-10-02` → `done` |
| ISO-week key `2026-W40` → occurrence | `2026-10-01` (Thursday) → `done` |
| `item.legacy.completionHistory` raw retained | **yes** on both |
| Recurrence mapping | `Daily` / `Weekly` preserved |
| Console output | **0 messages** |

The `getItem` capability probe added in `legacyTasks.ts` does not throw or short-circuit the
migration. **No regression.**

> Methodology note: an initial attempt reported the migration as *not* running. That was a
> harness artifact — navigating to a URL differing only by hash is a same-document navigation,
> so `App.tsx` never re-mounted. Re-tested with `location.reload()`; migration ran.

---

## 5. Baseline screenshot refresh

**Not required — nothing refreshed.** Verification:

- `git diff b9d2324..HEAD --name-only | rg 'styles|tailwind|\.css$'` → **NONE**.
- `git diff b9d2324..HEAD -- src/features src/components | rg '^[+-].*className'` → **NONE**.
- Every change in this window is logic-only (ICS string formatting, CSV/JSON error toasts,
  habit stat/undo bookkeeping, capability probe, CI workflows).

All four post-sweep-10 changes are behaviour that does not alter rendered markup. The 22
screenshots in `.improve/artifacts/regression-20/` are structurally identical to the existing
`.improve/artifacts/baseline/` set. Existing baselines left untouched.

---

## Findings

### No regressions

Zero regressions. All gates green, all five targeted spot-checks pass, console parity with
baseline (0 errors), test suite strictly additive and stable across 5 consecutive runs.

### Discovery A (pre-existing, non-blocking) — quick add does not parse `"every weekday"`

`every weekday` produces **no recurrence** and falls through to a plain one-off task dated today.
Cause: the frequency regex is `\bevery\s+week\b`, and `\b` after `week` cannot match inside
`weekday`. `WEEKDAY_PATTERN` (src/domain/quickadd.ts) contains mon/tue/wed/thu/fri/sat/sun but
not the literal token `weekday`.

- Location: `src/domain/quickadd.ts` frequency block.
- **Not a regression.** `git show b9d2324:src/domain/quickadd.ts` contains the byte-identical
  `\bevery\s+week\b`; the IMP-010/IMP-011 edits only touched lone-weekday and next-month-day
  handling.
- User impact: cosmetic surprise — the literal words "every weekday" stay in the title
  (`Team standup every weekday`) instead of becoming `byWeekday=[1..5]`. Suggest as a future
  improvement; no action taken.

### Discovery B (pre-existing, non-blocking) — CSV import silently accepts non-CSV files

`csvToItems` performs no header validation and cannot throw: an arbitrary two-line garbage file
imported **successfully** and created an item titled `Untitled`. Consequences:

- The IMP-015 `Import failed: …` toast is effectively **unreachable for CSV** (it is reachable
  for JSON, verified in §4(b)).
- A wrong file silently injects junk items rather than erroring.

Not a regression — `csvToItems` is unchanged in this window and was equally lenient at
`b9d2324`. Suggest header validation (require ≥1 known `CSV_COLUMNS` name) as a future
improvement. No action taken.

### Observation C (cosmetic, pre-existing) — empty-state flash on view navigation

Several views briefly render their empty state ("No items match", "No bills yet", "0 items")
before the async `useLiveQuery` resolves — observed on Settings, Lists, Bills, Habits, Matrix.
Consistently resolves within ~1–2 s; verified correct in every case. Pre-existing, unrelated to
this window's changes.

### Observation D (cosmetic, pre-existing) — progress ring crowds the percentage text

On Today, the "Today's agenda" completion ring's left arc slightly overlaps the `25%` /
`0%` label at both 1280px and 390px (`desktop-13-today.png`, `mobile-01-today.png`).
Purely visual, pre-existing, no functional impact.

---

## Artifacts

```
.improve/artifacts/regression-20/
  desktop-01-quickadd.png                  mobile-01-today.png
  desktop-02-habit-history-undo.png        mobile-02-calendar-month.png
  desktop-03-goals.png                     mobile-03-habit-editor-history.png
  desktop-04-shopping.png                  mobile-04-lists.png
  desktop-05-notes.png                     mobile-05-settings.png
  desktop-06-calendar-week.png             mobile-06-matrix.png
  desktop-07-calendar-month.png
  desktop-08-calendar-year.png
  desktop-09-matrix.png
  desktop-10-bills.png
  desktop-11-lists.png
  desktop-12-habits.png
  desktop-13-today.png
  desktop-14-command-palette.png
  desktop-15-shortcuts-sheet.png
  desktop-16-settings.png
  ics-export-verified.ics      <- evidence for spot-check (a)
```

Nothing committed. No source files modified.