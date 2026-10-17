# Regression Sweep Final — 25 items since baseline

**Date:** 2026-10-17
**Branch:** `improve/auto-20261017`
**Baseline:** `cc609a4` (session baseline)
**Previous sweeps:** `f916b43` (regression-60, clean), `b9934d5` (regression-70, clean)
**Range under test:** `b9934d5..be7edc1` (5 commits)
**HEAD at sweep:** `be7edc1` — `fix(occurrences): make status writes atomic [IMP-089]`

New items since the 70 sweep: IMP-035, IMP-060, IMP-087, IMP-083, IMP-089.

## VERDICT: CLEAN

No S0/S1 regressions. Every static gate passes, all 40 route/theme/viewport
checks pass on both empty and populated data, and console/page-error/failed-request
counts are zero for the app. No source file was changed and no commit was made.
The working tree still contains only the pre-existing `.improve/CHANGELOG.md` and
`.improve/PROGRESS.log` edits plus untracked report/artifact files.

## 1. Static quality gate

Command: `npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build`

| Gate | Result | Detail |
| --- | --- | --- |
| typecheck | PASS | `tsc --noEmit`, no diagnostics |
| lint | PASS | `eslint .`, no output |
| test (run 1) | PASS | Vitest 4.1.11: **42 files / 455 tests**, 12.32 s |
| test (run 2) | PASS | **42 files / 455 tests**, 12.51 s |
| format:check | PASS | Prettier 3.9: “All matched files use Prettier code style!” |
| build | PASS | 2112 modules; `dist/sw.js` generated; precache **18 entries / 623.46 KiB**; Vite 2.45 s, SW 62 ms |

regression-70 baseline was 42 files / 447 tests. The growth to 455 is the new
IMP-089 atomic-status race/undo coverage and IMP-083 boot-smoke assertions; no
existing test was lost. Both runs produced identical counts with no flakes,
snapshot changes, or the benign `--localstorage-file` warning.

## 2. Browser environment

- `npm run preview` on port **4173**; base path `/eisenmatrix-calendar/` served HTTP 200.
- Before testing, the service worker was unregistered and
  `workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/` was deleted,
  then a real document load from `about:blank` was performed.
- IndexedDB was deleted and re-created so the sweep began from an empty database
  (no fixtures from earlier sweeps). This produced one expected Dexie warning
  (`Another connection wants to delete database...`) at setup time only; it is
  test-induced and does not originate from app behavior.
- Viewports **1280×800** and **390×844**; themes switched through Settings UI
  (`light`/`dark`), and persisted through a real reload.
- After testing, the SW re-registered normally: **1 registration, 1 precache cache**.
- Final hard load: 11/11 requests HTTP 200, 0 console messages.

## 3. Route / theme / viewport matrix — 40/40 PASS

10 routes × 2 viewports × 2 themes. Checks: rendered landmark, `location.hash`,
`html.dark`, both nav link counts, and horizontal overflow. The matrix was run
twice: once on the empty database and once populated with 9 items; both runs are
40/40.

| Route | Desktop light | Desktop dark | Mobile light | Mobile dark | Rendered landmark |
| --- | --- | --- | --- | --- | --- |
| Today | PASS | PASS | PASS | PASS | `h1 Today`, agenda/cards |
| Calendar | PASS | PASS | PASS | PASS | `h2 October 2026`, day/week/month/year |
| Matrix | PASS | PASS | PASS | PASS | `h1 Eisenhower Matrix`, 4 quadrants |
| Lists | PASS | PASS | PASS | PASS | `[role=table][aria-label=Items]` |
| Goals | PASS | PASS | PASS | PASS | `h1 Goals` |
| Habits | PASS | PASS | PASS | PASS | `h1 Habits` |
| Bills | PASS | PASS | PASS | PASS | `h1 Bills` |
| Shopping | PASS | PASS | PASS | PASS | `h1 Shopping` |
| Notes | PASS | PASS | PASS | PASS | `h1 Notes` |
| Settings | PASS | PASS | PASS | PASS | `h1 Settings` |

- **10/10 destinations** in both `nav[aria-label="Primary sections"]` (desktop)
  and `nav[aria-label="Primary"]` (mobile).
- **No horizontal overflow** in any combination (`scrollWidth = viewport width`),
  including populated Lists, Matrix, Today, and 390 px mobile.
- Light body background `rgb(248, 250, 252)`; dark `rgb(2, 6, 23)` with `html.dark`.
- Lists intentionally has no `h1`; its table landmark is the accessible name.

## 4. Console and network

Across the full session (40 route checks, all interaction scripts, exports/import,
cross-tab tests, and the final reload):

- **Console errors: 0. Console warnings: 0** (app).
- **Page errors: 0.**
- **Failed requests: 0.**
- **HTTP responses ≥ 400: 0.**
- Final hard load after reset: **11/11 requests HTTP 200**; no failed request,
  no PWA update toast.

The only warning observed in the entire session was the setup-time Dexie
`deleteDatabase` warning caused by the sweep intentionally clearing IndexedDB
while the app was open; it is not emitted by any user flow.

## 5. Interaction checks — all critical paths PASS

### Quick add
- Pressed `c` on Today; **Quick add** opened with focus in its input.
  `gym every fri` → one `task` **Gym**, `start 2026-10-17`, `allDay: true`,
  `recurrence {freq: weekly, interval: 1, byWeekday: [5]}`.
- `habit: Walk 20 min` → `habit` **Walk 20 min** with
  `recurrence {freq: daily, interval: 1}` (explicit kind prefix path).
- Plain tasks **Call plumber** and **Read book** persisted with today's date.

### Command palette
- `⌘K` opened **Command palette**; typed `Go to Shopping`, Enter → `#/shopping`,
  `h1 Shopping`, palette closed (0 dialogs).

### Editor create / save / undo
- New task **Editor probe** saved (row present), `⌘Z` → **Undone**, row removed.
- Opened **Gym**, renamed to **Gym edited**, Save → row title/history updated;
  `⌘Z` → title restored to **Gym** and history back to 0, exact prior state.

### Subtask create + undo (IMP-087)
- New parent **Parent probe** + subtask **Child probe**: the child was persisted
  before Save with `parentId` pointing at the draft parent.
- After Save both rows existed. `⌘Z` removed **both** parent and child in one
  undo entry; unrelated rows were untouched.

### Occurrence edit (IMP-077 / IMP-089)
- Created **Occurrence probe** event, `start 2026-10-17T09:00`, daily rule.
- Opened today's occurrence: subtitle `Occurrence 2026-10-17`, seeded `09:00`.
  Changed start to `14:30`, saved → `Occurrence updated`.
- Persisted: series `start 2026-10-17T09:00` unchanged; override
  `2026-10-17 → start 2026-10-17T14:30`; Today showed `14:30`; reopening showed
  `14:30` on the date/time controls.

### Non-recurring multi-day all-day save (IMP-077)
- Created **Retreat** event, all-day, start `2026-10-20`, end `2026-10-22T00:00`.
- Persisted exactly `start 2026-10-20`, `end 2026-10-22T00:00`, `allDay true`,
  `recurrence null`; reopening the Schedule tab preserved both dates and all-day.

### Item delete / undo
- **Call plumber** deleted via editor confirmation (`Delete series`); DB count
  1 → 0. `⌘Z` restored the same id and row.

### List sorting
- Initial: `Date` `aria-sort=ascending`, others `none`.
- Item click → Item `ascending`, Date `none`; order became alphabetical
  (`Call plumber`, `Gym`, `Occurrence probe`, `Read book`, `Retreat`, `Walk 20 min`).
- Priority clicks → `ascending` then `descending`, Date `none`.
- Date click → Date `ascending`, Priority/Item `none`. Sorting state is exposed
  correctly to assistive tech (IMP-033 intact).

### Bills paid totals (IMP-032 regression check)
| Step | This month | Paid | Remaining | Evidence |
| --- | --- | --- | --- | --- |
| Create Electric bill, amount 120 | 120 | 0 | 120 | row appears |
| Mark paid | 120 | **120** | 0 | `aria-pressed=true`, label `Mark unpaid` |
| Edit amount to 150 | **150** | **120** | 30 | recorded payment stays 120 |

DB after edit: `data.amount=150`, `payments['2026-10-17'].amount=120`. Paid total
always equals recorded payments, not the current bill amount.

### Habits (IMP-070 / IMP-078 regression check)
- **Walk 20 min** stored `recurrence {freq: daily, interval: 1}`.
- **Complete today** changed the button to done (`aria-pressed=true`), stored
  occurrence `2026-10-17 = done`, streak current/best `1`.
- Today view: agenda count and checklist exclude habits (4 non-habit agenda
  occurrences), while the Habits panel lists **Walk 20 min once**; body text
  contained exactly one occurrence of the habit title (IMP-078 intact).

### Theme and settings persistence across reload (IMP-035)
- Rapid sequence in Settings: theme **dark**, week starts **Sunday**, Daily digest
  **on**. Immediately persisted value:
  `{theme:'dark', weekStartsOn:0, digestEnabled:true, ...}` (no key lost).
- Real reload: `html.dark` true, body dark background, Sunday selected, digest
  checked, theme button `aria-pressed=true`; SW re-registered (1 registration,
  1 cache).

### Migration rerun button
- **Re-run legacy import** produced the success toast
  `No legacy data found (or already imported)` with no error toast or console
  error. `migration.legacy.completedAt` advanced and version stayed 1, while the
  app settings (theme/week/digest) were preserved by the atomic merge path.

### Exports
Downloaded to `.improve/artifacts/regression-final/exports/`:

- **JSON**: `eisenmatrix-backup-2026-10-17.json` — app marker `eisenmatrix`,
  format version `2`, 7 items at export time.
- **CSV**: `eisenmatrix-items-2026-10-17.csv` — full 26-column header.
- **ICS**: `eisenmatrix-calendar-2026-10-17.ics` —
  - Retreat: `DTSTART;VALUE=DATE:20261020`, `DTEND;VALUE=DATE:20261023`
    (exclusive multi-day end, IMP-075 intact).
  - Gym: `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=FR`.
  - Occurrence probe: `DTSTART:20261017T090000`, `RRULE:FREQ=DAILY;INTERVAL=1`.
  - Walk 20 min: `RRULE:FREQ=DAILY;INTERVAL=1`.

### CSV import
Uploaded `import-test.csv` through Settings → Import CSV. Both rows persisted
with exact titles **`Roadmap, Q4 "final"`** and **`Mid "quote" here`**, and the
quoted-comma notes value `quoted, comma`; quoted commas/escaped quotes and
mid-field quotes still parse correctly (IMP-031 intact). Import summary:
`Imported 2 items · skipped 0 · overwritten 0 · duplicated 0`.

### Deep-link reload
Direct load of `http://localhost:4173/eisenmatrix-calendar/#/shopping` rendered
`h1 Shopping`; `location.reload()` preserved `#/shopping`, re-rendered Shopping,
and kept 1 SW registration. 0 console errors, 0 failed requests.

### Stacked overlays and Escape (IMP-079)
- Opened the Gym editor, then `⌘K`: **2 dialogs**, focus in the palette combobox,
  body overflow `hidden`.
- One Escape: palette closed, **editor still open**, focus returned to the editor
  title input; body overflow became `''`.
- Second Escape: editor closed; 0 dialogs.
- **Known IMP-094 gap reproduced (record only):** after the top layer closes, the
  surviving editor is no longer scroll-locked (`overflow: ''`). This is the
  documented known gap, not a new regression from `e9fc259`.

### Concurrent occurrence toggles (IMP-089)
- Two tabs opened Calendar day view: tab A on **2026-10-17**, tab B on
  **2026-10-18**. Both showed the same recurring **Occurrence probe**.
- Both `Mark as done` buttons were clicked concurrently (`Promise.all`).
- DB after the race: `occurrences['2026-10-17'].status = done` **and**
  `occurrences['2026-10-18'].status = done`, with the same timestamp; neither key
  was lost.
- Undo in tab A restored `2026-10-17` while leaving `2026-10-18` intact, showing
  each real write restores only its own snapshot.

### Shared items live query across consumers (IMP-060)
- Two tabs open: Today and Lists. Creating **Live sync probe** in Today changed the
  Lists row count 9 → 10 without reload; `⌘Z` changed it back 10 → 9. This exercises
  the shared reference-counted live query, cross-tab Dexie notifications, and
  per-flag caching.

## 6. Recent-commit regression checks

| Commit / area | Result | Evidence |
| --- | --- | --- |
| `8605686` IMP-035 atomic settings | PASS | `settingsRepo.merge` reads+merges+puts in one rw transaction; theme, week start and digest written in rapid succession all persisted; reload and migration rerun preserved every key |
| `fbcd4fd` IMP-060 shared live query | PASS | One module-level reference-counted `liveQuery`; all 10 views read data; cross-tab create/undo propagated 9→10→9 without reload; no identity/render warnings |
| `3001432` IMP-087 undo subtasks | PASS | Pre-saved child + parent removed together by one undo; unrelated rows survive; browser and unit evidence |
| `2b3b358` IMP-083 boot smoke + double CI | PASS | `ci.yml` Test step is `npm run test && npm run test`; smoke test awaits both migrations and asserts `migration.legacy` + `migration.notificationGate` markers; local double run is 455/455 both times; production boot path unchanged |
| `be7edc1` IMP-089 atomic occurrence writes | PASS | `updateAtomic` read+merge+put inside one rw transaction; concurrent cross-tab toggles both persist; undo restores one key once; no-op writes remain no-ops per unit tests |
| CI workflow (`.github/workflows/ci.yml`) | PASS | `workflow_call` + `pull_request` + `workflow_dispatch`; distinct `-ci-` concurrency group with `cancel-in-progress: true`; SHA-pinned actions; format check and double test present |
| Earlier-sweep checks | PASS | Formatting, docs, CRLF, useData types, occurrence seeding, habit dedupe, overlay Escape, migration failure handling all remain green |

## 7. Issues

**No regressions. No S0/S1 issues.**

Non-blocking observations:

1. **Known IMP-094 scroll lock (reproduced).** Closing the palette while the editor
   remains open leaves `document.body.style.overflow === ''`; the surviving layer
   is not re-locked. Recorded only, per instructions.
2. **Pre-existing cancel-orphan subtask path (not a regression).** Adding a subtask
   to a brand-new item and pressing **Cancel** leaves the child row persisted with a
   dangling `parentId` (observed: only `Cancel child`, parent id absent). The
   `addChild` code is identical at `cc609a4`; IMP-087 fixed the save/undo path, not
   Cancel. The probe row was deleted from the test data afterwards.
3. **Migration failure branch** is covered by unit tests; it was not forced against
   a broken IndexedDB in the browser because doing so would require corrupting the
   storage layer. The success path was exercised live.
4. **Test-only warning:** deleting IndexedDB while the app is open emits Dexie's
   “Another connection wants to delete database” warning. This is setup noise, not
   app behavior; post-reset/final loads are 0 console messages.

## 8. Evidence

Screenshots (`.improve/artifacts/regression-final/`, 31 files):

```
desktop-today-light.png, desktop-today-dark.png, desktop-today-populated-dark.png
desktop-calendar-light.png, desktop-calendar-dark.png
desktop-matrix-light.png, desktop-matrix-dark.png
desktop-matrix-populated-light.png, desktop-matrix-populated-dark.png
desktop-settings-light.png, desktop-settings-dark.png, desktop-settings-rerun-toast.png
desktop-lists-populated-dark.png, desktop-bills-paid-dark.png
desktop-habits-done-dark.png, desktop-occurrence-editor.png
desktop-stacked-overlays.png
mobile-today-light.png, mobile-today-dark.png, mobile-today-populated-dark.png
mobile-calendar-light.png, mobile-calendar-dark.png
mobile-matrix-light.png, mobile-matrix-dark.png
mobile-settings-light.png, mobile-settings-dark.png
mobile-lists-light.png, mobile-lists-dark.png
mobile-lists-populated-light.png, mobile-lists-populated-dark.png
```

Downloads and import fixture (`.improve/artifacts/regression-final/`):

```
exports/eisenmatrix-backup-2026-10-17.json
exports/eisenmatrix-items-2026-10-17.csv
exports/eisenmatrix-calendar-2026-10-17.ics
import-test.csv
```

## 9. Determinism

- Gate test run 1: **42 files / 455 tests**, 12.32 s, all pass.
- Standalone test run 2: **42 files / 455 tests**, 12.51 s, all pass.
- No flaky tests, changed snapshots, unhandled rejections, or order-dependent
  failures.
- Build and `format:check` remained green; 18-entry precache generated both times.

## 10. Residual risk

- Known IMP-094 scroll lock remains open (recorded).
- Cancelling a new item after adding a subtask leaves an orphan child (pre-existing
  at `cc609a4`, not introduced by this batch).
- Migration failure handling is unit-tested, not forced against real broken storage.
- No bisect was needed: no regression candidate was found in `cc609a4..HEAD`.
