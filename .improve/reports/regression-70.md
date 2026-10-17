# Regression Sweep 70 — 10 new items since regression-60

**Date:** 2026-10-17
**Branch:** `improve/auto-20261017`
**Baseline:** `cc609a4` (session baseline)
**Previous clean sweep:** `f916b43` (regression-60)
**Range under test:** `f916b43..b9934d5` (11 commits; 10 improvement items)
**HEAD at sweep:** `b9934d5` — `fix(settings): handle a failed migration rerun [IMP-080]`

New items: IMP-063, IMP-064, IMP-065, IMP-062, IMP-066, IMP-077, IMP-078,
IMP-081, IMP-079, IMP-080.

## VERDICT: CLEAN

No S0/S1 regressions. Every static gate passes, all 40 route/theme/viewport checks
pass, and console/page-error/failed-request counts are all zero. No source file was
changed and no commit was made. The working tree still contains only the pre-existing
`.improve/CHANGELOG.md` and `.improve/PROGRESS.log` edits.

## 1. Static quality gate

Command: `npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build`

| Gate | Result | Detail |
| --- | --- | --- |
| typecheck | PASS | `tsc --noEmit`, no diagnostics |
| lint | PASS | `eslint .`, no output |
| test (run 1) | PASS | Vitest 4.1.11: **42 files / 447 tests**, 12.40 s |
| test (run 2) | PASS | **42 files / 447 tests**, 12.30 s |
| format:check | PASS | Prettier 3.9: “All matched files use Prettier code style!” |
| build | PASS | 2112 modules; `dist/sw.js` generated; precache **18 entries / 622.18 KiB**; build 2.44 s + SW 100 ms |

regression-60 baseline was 41 files / 425 tests. The growth to 42/447 is the new
`useData` hook coverage (IMP-066), occurrence-seeding editor tests (IMP-077), Today
dedupe tests (IMP-078), settings migration-failure tests (IMP-080), and overlay-stack
tests (IMP-079); no existing test was lost. The benign `--localstorage-file` warning
did not appear. Both test runs produced identical counts with no flakes or snapshot
changes.

## 2. Browser environment

- `npm run preview` on port **4173**; base path `/eisenmatrix-calendar/` served HTTP 200.
- Before testing, the existing service worker was unregistered and
  `workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/` was deleted, then a
  real document load from `about:blank` was performed (the IMP-065 procedure).
- After testing the SW re-registered normally: **1 registration, 1 precache cache**;
  direct-load and reload checks both showed `#/shopping` + `h1 Shopping`.
- Viewports **1280×800** and **390×844**; themes switched through the Settings UI
  (buttons `light`/`dark`), not by script injection.
- The browser profile was empty at the start of this sweep (no `raw-*`/`verify-*`
  fixtures); all data below was created by this sweep.

## 3. Route / theme / viewport matrix — 40/40 PASS

10 routes × 2 viewports × 2 themes. Checks: rendered landmark, `location.hash`,
`html.dark`, body background, both nav link counts, and
`documentElement.scrollWidth` vs `innerWidth`.

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

- **10/10 destinations** in both `nav[aria-label="Primary sections"]` (desktop) and
  `nav[aria-label="Primary"]` (mobile).
- **No horizontal overflow** in any combination (`scrollWidth` = 1280 or 390).
- Light body background `rgb(248, 250, 252)`; dark `rgb(2, 6, 23)` with `html.dark`.
- Lists intentionally has no `h1`; its table landmark is the accessible name.

## 4. Console and network

Across the full session (40 route checks, all interaction scripts, exports/import,
and the final deep-link + reload):

- **Console errors: 0. Console warnings: 0.**
- **Page errors: 0.**
- **Failed requests: 0.**
- **HTTP responses ≥ 400: 0.**
- Final hard load: 23/23 requests returned HTTP 200; no PWA update toast appeared.

This matches the regression-60 baseline (0/0/0).

## 5. Interaction checks — 28 PASS + 1 known-gap record

### Quick add
- Pressed `c` on Today; **Quick add** dialog opened with focus in its input.
  `gym every fri` → persisted exactly one `task` **Gym**, `start 2026-10-17`,
  `allDay: true`, `recurrence {freq: weekly, interval: 1, byWeekday: [5]}`.
- `habit: Walk 20 min` → persisted `habit` **Walk 20 min** with
  `recurrence {freq: daily, interval: 1}` (explicit kind prefix path).
- Selecting **Kind = habit** for `Stretch` persisted a habit with `recurrence: null`.
  This is the pre-existing quick-add kind-override gap discussed in §7.2; it exists at
  `cc609a4`, is not caused by this batch, and does not affect the other checks.

### Command palette
- `⌘K` opened **Command palette**; combobox `aria-expanded=true`.
  Typed `Go to Shopping`, Enter → `#/shopping`, `h1 Shopping`, palette closed.

### Editor open / save / undo
- Opened **Gym** from Lists; title changed to **Gym edited**, Save → `Saved` toast,
  DB title updated. `⌘Z` → `Undone` toast and DB title restored to **Gym**.
- No console/page errors on either path.

### Stacked overlays and Escape (IMP-079)
- Opened the Gym editor, then `⌘K`: **2 dialogs**, focus in the palette combobox.
- One Escape: palette detached, **editor still open**, focus returned to the editor's
  title input, `document.body.style.overflow` became `''`.
- Second Escape: editor closed; 0 dialogs.
- **Known IMP-094 gap reproduced:** after the top layer closes, the surviving editor is
  no longer scroll-locked (`overflow: ''`). Recorded, not failed, as instructed.

### Occurrence seeding (IMP-077)
- Created **Occurrence probe** event (event, `start 2026-10-17T09:00`, daily rule).
- Opened today's occurrence: subtitle `Occurrence 2026-10-17`, seeded time `09:00`.
  Changed start to `14:30`, saved → `Occurrence updated`; persisted override is
  `2026-10-17 → start 2026-10-17T14:30`, while the series `start` stayed
  `2026-10-17T09:00`. Today then showed `14:30` only; reopening showed `14:30`.
- Opened tomorrow's occurrence from Calendar week view (cell 18): subtitle
  `Occurrence 2026-10-18`, seeded date `2026-10-18`, time `09:00`.
- Scope switching on that occurrence: **All occurrences** → date `2026-10-17` /
  `09:00` (series values); **This occurrence** → date `2026-10-18` / `09:00`
  (occurrence values). The disabled Due field correctly stayed at the series value.

### Non-recurring multi-day all-day save (IMP-077)
- Created **Retreat** event, all-day, start `2026-10-20`, end `2026-10-22T00:00`.
  Persisted exactly `start 2026-10-20`, `end 2026-10-22T00:00`, `allDay true`,
  `recurrence null`; reopening the Schedule tab preserved both dates.

### List sorting
- Initial: `Date` has `aria-sort=ascending`; others `none`.
- Priority click 1 → Priority `ascending`, Date `none`; click 2 → Priority
  `descending`; click Item → Item `ascending`, Priority `none`.
- Alphabetical order confirmed: `Gym`, `Occurrence probe`, `Retreat`, `Stretch`.
  (The four items tie on priority, so priority order is stable but unchanged; the ARIA
  state and comparator behavior are correct.)

### Bill paid total after amount edit (IMP-032 regression check)
| Step | This month | Paid | Remaining | Evidence |
| --- | --- | --- | --- | --- |
| Create Electric bill, amount 120 | 120 | 0 | 120 | row appears |
| Mark paid | 120 | **120** | 0 | `aria-pressed=true` |
| Edit amount to 150 | **150** | **120** | 30 | recorded payment stays 120 |

DB after edit: `data.amount=150`, `payments['2026-10-17'].amount=120`. The Paid total
always equals recorded payments, not the current bill amount.

### Habits (IMP-070 / IMP-078 regression check)
- **New habit** → **Meditate** persisted `recurrence {freq: daily, interval: 1}`
  (IMP-070 default).
- **Complete today** on Habits → `aria-pressed=true`; stored occurrence
  `2026-10-17 = done`; streak current/best `1`; button changed to **Undo today**.
- Today view: agenda excludes habits (its count tracked only non-habit occurrences:
  Electric bill + Occurrence probe at the time), while the Habits panel listed each
  habit once (`Stretch`, `Meditate`). **One mention per habit on Today**, no duplicate
  agenda card (IMP-078).

### Settings theme and migration rerun
- Settings UI `light`/`dark` toggled `html.dark` and the body background; exactly one
  theme button had `aria-pressed=true`.
- **Re-run legacy import** button visible and clickable; it produced the success-path
  toast `No legacy data found (or already imported)` with no error toast and no console
  error. (The failure/rejection branch is covered by the new unit tests, not forced in
  the browser.)

### Exports
Downloaded to `.improve/artifacts/regression-70/exports/`:

- **JSON**: `eisenmatrix-backup-2026-10-17.json` — app marker `eisenmatrix`,
  format version `2`, items array (6 items at export time).
- **CSV**: `eisenmatrix-items-2026-10-17.csv` — full 26-column header.
- **ICS**: `eisenmatrix-calendar-2026-10-17.ics` —
  - Retreat: `DTSTART;VALUE=DATE:20261020`, `DTEND;VALUE=DATE:20261023`
    (exclusive multi-day end, IMP-075 intact).
  - Gym: `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=FR`.
  - Meditate: `RRULE:FREQ=DAILY;INTERVAL=1`.

### CSV import
Uploaded `import-test.csv` through Settings → Import CSV. Both rows persisted with
exact titles **`Roadmap, Q4 "final"`** and **`Mid "quote" here`**, proving quoted
commas/escaped quotes and mid-field quotes still parse correctly (IMP-031 intact).

### Deep-link reload
Direct load of `http://localhost:4173/eisenmatrix-calendar/#/shopping` rendered
`h1 Shopping`; `location.reload()` preserved `#/shopping`, re-rendered Shopping, and
re-registered the SW (1 registration, 1 cache). 0 console errors, 0 failed requests.

## 6. Recent-commit regression checks

| Commit / area | Result | Evidence |
| --- | --- | --- |
| `765d09d` CI concurrency | PASS | `ci.yml` has `workflow_call`, no `push: main`; distinct `-ci-` group; both workflows `cancel-in-progress: true`; YAML accepted by Prettier |
| `5feff5d` Prettier enforcement | PASS | `format:check` exits 0; reviewed diff is line wrapping/newline only (delivery.ts, editor/settings imports, tests); no semantic edits |
| `72094b6` docs | PASS | No runtime change; the documented SW/cache reset was used successfully |
| `692dc5f` CRLF note drafts | PASS | New CRLF/mixed/lone-CR unit tests pass; normalization is confined to `splitNoteDraft` (single-line quick-add inputs cannot accept CRLF, so browser exercise is not meaningful) |
| `d18883e` useData type changes | PASS | typecheck/lint clean; all 10 views read live data; new `useData` tests cover deps/fallback; no undefined-read or render error |
| `e9807ef` occurrence-seeded editor | PASS | Today and tomorrow occurrences seeded from the resolved occurrence; moved 14:30 stays on 2026-10-17; scope resets verified |
| `628f42c` + `9d95d8d` Today habit dedupe | PASS | Agenda excludes habits; one mention per habit; Habits panel intact |
| `0a185e4` SHA pinning | PASS | All six `uses:` are 40-hex commit SHAs with version comments; no tag/main refs remain |
| `e9fc259` overlay Escape stack | PASS | 2 stacked dialogs; one Escape closes only the palette; focus returns into the editor; second Escape closes it |
| `b9934d5` migration failure handling | PASS | Button visible; success path toasts and does not throw; 81 new tests cover rejection/success |

The IMP-094 scroll-lock gap is the only overlay-stack side effect observed; it is the
known gap named in the task, not a new regression from `e9fc259`.

## 7. Issues

**No regressions. No S0/S1 issues.**

Non-blocking observations:

1. **Known IMP-094 scroll lock (reproduced).** Closing the top palette while the editor
   remains open leaves `document.body.style.overflow === ''`; the surviving layer is
   not re-locked. This is the documented known gap; recorded only, per instructions.
2. **Pre-existing quick-add kind-override habit gap.** Choosing `Kind = habit` in Quick
   Add sets `kind`/`data` but does not recompute recurrence, so that habit is stored
   with `recurrence: null`; the explicit `habit:` prefix path stores daily. This is
   present at `cc609a4` and predates `f916b43..b9934d5`, so it is not a regression from
   this batch. It is noted because the sweep exercised the kind override.
3. **Test-environment only:** the migration failure/rejection branch was not forced in
   the browser (IndexedDB would need to be broken); the new unit tests cover it, and
   the success path was exercised live.
4. **CRLF path:** covered by unit tests only, because the Quick Add control is a
   single-line input that strips newlines; the implementation change is confined to
   `splitNoteDraft`.

## 8. Evidence

Screenshots (`.improve/artifacts/regression-70/`, 17 files):

```
desktop-today-light.png, desktop-today-dark.png, desktop-today-populated.png
desktop-lists-light.png, desktop-lists-populated.png
desktop-matrix-light.png, desktop-calendar-dark.png
desktop-settings-dark.png, desktop-settings-rerun-toast.png
desktop-bills-paid.png, desktop-habits-done.png
desktop-occurrence-editor.png, desktop-stacked-overlays.png
mobile-today-light.png, mobile-today-dark.png
mobile-matrix-light.png, mobile-settings-dark.png
```

Downloads and import fixture (`.improve/artifacts/regression-70/`):

```
exports/eisenmatrix-backup-2026-10-17.json
exports/eisenmatrix-items-2026-10-17.csv
exports/eisenmatrix-calendar-2026-10-17.ics
import-test.csv
```

## 9. Determinism

- Gate test run 1: **42 files / 447 tests**, 12.40 s, all pass.
- Standalone test run 2: **42 files / 447 tests**, 12.30 s, all pass.
- No flaky tests, changed snapshots, or order-dependent failures.
- Build and `format:check` remained green after both runs.

## 10. Residual risk

- IMP-094 scroll lock remains open (known); the surviving layer can scroll behind a
  closed top overlay.
- Migration failure handling is unit-tested but not forced against a real broken
  IndexedDB in this sweep.
- CRLF normalization is unit-tested; the browser UI cannot accept multi-line text in
  the Quick Add input.
- No bisect was needed: no regression candidate was found in `f916b43..b9934d5`.
