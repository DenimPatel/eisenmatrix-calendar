# Regression Sweep 50 — 10 commits since cc609a4

**Date:** 2026-10-17
**Branch:** `improve/auto-20261017`
**Range:** `cc609a4..8b46ffa`
**Commits under test:** IMP-069, IMP-070, IMP-054, IMP-059, IMP-071, IMP-072, IMP-073, IMP-074, IMP-075, IMP-076

## VERDICT: CLEAN

No S0/S1 regressions found. No code was changed and no commits were made.

## 1. Static quality gate

Command (single chain, as specified):

```
npm run typecheck && npm run lint && npm run test && npm run build
```

| Gate | Result | Detail |
| --- | --- | --- |
| typecheck | PASS | `tsc --noEmit`, no diagnostics |
| lint | PASS | `eslint .`, no output |
| test | PASS | Vitest 4.1.11: **33 files / 375 tests passed**, 9.83 s. Only the known benign `--localstorage-file` environment warning is absent in this run; no failures. |
| build | PASS | `tsc --noEmit && vite build`: 2108 modules, `dist/sw.js` generated, PWA injectManifest, precache 18 entries / 617.20 KiB, built in 2.43 s |

Baseline comparison (REPO_PROFILE §3): all four gates were PASS at baseline and remain PASS. Test count grew from 49 to 375 across the series (expected, new tests), not a regression.

## 2. Browser environment

- `npm run preview` on port **4173**, base `/eisenmatrix-calendar/` (`/` → 302 to base, base → 200).
- Existing service worker **unregistered** and all `workbox-precache` caches deleted, then hard reload before testing.
- After testing, SW re-registered normally at `/eisenmatrix-calendar/sw.js` (PWA path healthy).
- Playwright browser context; viewports **1280×800** and **390×844**; themes toggled through Settings.
- Data present in the test profile: 2 pre-existing items (`Keep me` goal plus an older `Gym` task from an earlier run) plus 1 created during this sweep.

## 3. Route / theme / viewport matrix

Every route was visited in all four combinations (10 routes × 2 viewports × 2 themes = **40 checks**), checking rendered content, theme class/body background, and horizontal overflow (`documentElement.scrollWidth` vs `innerWidth`).

| Route | Desktop 1280 light | Desktop 1280 dark | Mobile 390 light | Mobile 390 dark | Rendered landmark |
| --- | --- | --- | --- | --- | --- |
| Today | PASS | PASS | PASS | PASS | `h1 Today`, agenda/habits/bills/goal cards |
| Calendar | PASS | PASS | PASS | PASS | `h2 October 2026`, Day/Week/Month/Year |
| Matrix | PASS | PASS | PASS | PASS | `h1 Eisenhower Matrix`, 4 quadrants |
| Lists | PASS | PASS | PASS | PASS | LISTS, filters, item table |
| Goals | PASS | PASS | PASS | PASS | `h1 Goals` |
| Habits | PASS | PASS | PASS | PASS | `h1 Habits`, `New habit` |
| Bills | PASS | PASS | PASS | PASS | `h1 Bills`, `New bill` |
| Shopping | PASS | PASS | PASS | PASS | `h1 Shopping`, list controls |
| Notes | PASS | PASS | PASS | PASS | `h1 Notes`, `Add note` |
| Settings | PASS | PASS | PASS | PASS | `h1 Settings`, Appearance/Notifications/Data/About |

- **10/10 destinations present** in the desktop sidebar (`nav[aria-label="Primary sections"]`) and in the mobile bottom nav (`nav[aria-label="Primary"]`, two rows).
- **No horizontal overflow** at 390 px on any route (`scrollWidth === 390` in every case). The profile's known mobile bottom-nav overflow was not observed; both nav rows fit.
- Light body background `rgb(248,250,252)`; dark `rgb(2,6,23)` with `html.dark` across all routes.
- `Calendar` and `Lists` intentionally have no `h1` (section label / table layout), matching their existing designs.

## 4. Console and network

- **Console errors: 0. Console warnings: 0.** (Checked with `console`, `pageerror`, and after fresh hard loads.)
- **Failed network requests: 0.** No `requestfailed`, no HTTP ≥ 400 on any route or on reload.
- PWA update toast ("A new version is available") appeared once after the forced SW unregister/reload; it is the normal update prompt, dismissible, and produced no console/network error. It overlaps lower content at 390 px while visible (pre-existing overlay behavior, not a regression).

## 5. Deep link + refresh (HashRouter)

- Direct load `http://localhost:4173/eisenmatrix-calendar/#/shopping` rendered Shopping (`h1 Shopping`).
- In-page `location.reload()` kept `#/shopping` and rendered Shopping again.
- Direct load + reload of `#/calendar` rendered `h2 October 2026`; URL preserved; SW active; 0 errors / 0 failed requests.
- `#/today` direct load also rendered correctly.

## 6. Interactions

### Quick add (IMP-054 / IMP-073)
- On Today, pressing `c` opened the Quick add dialog and focused the input.
- Typed `gym every fri`; preview chips rendered **Title: Gym**, date **2026-10-17**, recurrence **every week on Fri**. (Schedule token consumed; the word "gym" retained — IMP-073 behavior correct.)
- Clicked **Add**: toast `Added “Gym”`, dialog closed, and exactly **one** new item was persisted (IndexedDB item count 2 → 3; new id `2cda4bd0-…`, recurrence `weekly byWeekday [5]`).
- The Lists view showed the new Gym item. No duplicate was created; the second Gym row present was an older item from a previous run (`createdAt` ≈ 20 minutes before this sweep).
- Today's agenda correctly showed 0 scheduled items: the series recurs on Fridays and 2026-10-17 is a Saturday.

### Item editor (IMP-059 focus behavior)
- Clicked the Gym row in Lists: editor sheet opened with heading `Gym`, Task badge, tabs Details/Schedule/Analytics/History, and the **Title field focused on mount**.
- Clicked **Close panel**: editor unmounted, `[role=dialog]` count returned to 0. No errors.

### Settings exports/imports (IMP-072 / IMP-074 / IMP-075)
- Export actions render: **Export JSON, Export CSV, Export ICS, Save snapshot, Import JSON, Import CSV**.
- Exercised downloads:
  - `eisenmatrix-calendar-2026-10-17.ics` — valid VCALENDAR/VEVENT, floating all-day `DTSTART;VALUE=DATE`, `RRULE:FREQ=WEEKLY;...;BYDAY=FR`.
  - `eisenmatrix-items-2026-10-17.csv` — full `CSV_COLUMNS` header incl. recurrence/occurrences/data.
  - `eisenmatrix-backup-2026-10-17.json` — backup format v2 with app marker.
  - No console errors during or after any export.
- Import rejection paths (IMP-072) via file chooser:
  - Non-JSON text → UI toast `Import failed: Unexpected token … is not valid JSON`; item count unchanged; no console/page error.
  - Valid JSON with unknown shape (`{"foo":1}`) → UI toast `Import failed: Not an EisenMatrix backup (no items or tasks array)`; item count unchanged; no console/page error.
- No data loss or unintended writes observed.

## 7. Visual inspection

Screenshots reviewed; layouts are intact with no clipping, overlap, or dark-mode contrast issues:
- Desktop Today and Settings: sidebar, cards, and controls aligned; light/dark tokens correct.
- Desktop Lists: two-row recurring items and status/priority/date cells render correctly (dates wrap at 1280 but remain legible — pre-existing table behavior).
- Mobile Today: stacked cards, two-row bottom nav with all 10 destinations visible, no horizontal scroll.
- Mobile Matrix: 4 quadrant cards stack cleanly; sticky bottom nav; no overflow.
- PWA update toast (mobile dark) overlaps the bottom card while visible but is dismissible and did not block nav.

## 8. Issues

**None.** No S0 or S1 regressions attributable to IMP-069, IMP-070, IMP-054, IMP-059, IMP-071, IMP-072, IMP-073, IMP-074, IMP-075, or IMP-076.

Non-blocking observations only:
1. PWA "A new version is available" toast overlaps low content at 390 px while visible — pre-existing overlay behavior, dismissible.
2. Lists table wraps the ISO date cell to two lines at 1280 px — cosmetic, pre-existing.
3. The test profile already contained a prior `Gym` item, so Lists showed two identical rows after this sweep; DB inspection confirmed only one item was created by this run.

## 9. Evidence

Screenshots (git-excluded via `.git/info/exclude`):

```
.improve/artifacts/regression-50/desktop-today-light.png
.improve/artifacts/regression-50/desktop-today-dark.png
.improve/artifacts/regression-50/desktop-settings-dark.png
.improve/artifacts/regression-50/desktop-lists-gym.png
.improve/artifacts/regression-50/mobile-today-light.png
.improve/artifacts/regression-50/mobile-today-dark.png
.improve/artifacts/regression-50/mobile-matrix-light.png
```

Downloaded artifacts inspected in `.playwright-mcp/` (untracked): ICS, CSV and JSON exports from Settings.

## 10. Residual risk

The sweep covered navigation, themes, viewports, console/network health, deep links, quick add, editor open/close, exports and import rejection. It did not exhaustively re-test occurrence-status persistence (IMP-076), habit default recurrence (IMP-070), or editor-created undo (IMP-069); those have dedicated passing tests in the gate (375/375) and no UI error surfaced on their routes. This does not change the CLEAN verdict.
