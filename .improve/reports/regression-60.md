# Regression Sweep 60 — 10 new commits since regression-50

**Date:** 2026-10-17
**Branch:** `improve/auto-20261017`
**Overall range:** `cc609a4..f916b43` (21 commits)
**New since regression-50:** `8b46ffa..f916b43` (10 commits)

Commits under test:

| Commit | Item | Area |
| --- | --- | --- |
| `f916b43` | IMP-039 | Boot recovery: ErrorBoundary, storage/PWA failure capture |
| `ce661e3` | IMP-061 | `deleteItems([])` is a true no-op |
| `3afe7fb` | IMP-026 | Eisenhower mapping/scoring tests |
| `c52c7b8` | IMP-032 | Bill Paid total uses recorded payment amounts |
| `8a164e1` | IMP-033 | Toggle/sort state exposed via ARIA |
| `e1ea1ff` | IMP-088 | Normalize items at the repository read seam |
| `9647e37` | IMP-029 | Node 20 pin for contributors and CI |
| `2e455ce` | IMP-031 | CSV quotes only open at field start |
| `aeea3e3` | IMP-027 | Sheet/Dialog accessible names |
| `f27dff6` | IMP-025 | itemActions write-path tests |

## VERDICT: CLEAN

No S0/S1 regressions found. No source file was changed and no commit was made.
The only working-tree changes remain the pre-existing `.improve/` bookkeeping edits
(`CHANGELOG.md`, `FEATURES.md`, `PROGRESS.log`) and the untracked
`.improve/reports/discovered-IMP-039.md`.

## 1. Static quality gate

Command: `npm run typecheck && npm run lint && npm run test && npm run build`

| Gate | Result | Detail |
| --- | --- | --- |
| typecheck | PASS | `tsc --noEmit`, no diagnostics |
| lint | PASS | `eslint .`, no output |
| test | PASS | Vitest 4.1.11: **41 files / 425 tests passed**, 11.64 s |
| build | PASS | `tsc --noEmit && vite build`: 2111 modules, `dist/sw.js` generated, PWA injectManifest, precache 18 entries / 620.63 KiB, built in 2.41 s + SW 0.109 s |

Baseline was 33 files / 375 tests. The growth to 41/425 is new/extended tests
added by IMP-025, IMP-026, IMP-027, IMP-029, IMP-031, IMP-032, IMP-033, IMP-039,
IMP-061 and IMP-088; no existing test was lost. The known benign
`--localstorage-file` environment warning did not appear in either run.

## 2. Browser environment

- `npm run preview` on port **4173**; `/` → 302 to `/eisenmatrix-calendar/`, base path → HTTP 200.
- Existing service worker **unregistered** and `workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/` deleted, then hard reloaded before testing.
- After testing, SW re-registered normally (`1` registration, precache cache present); `/eisenmatrix-calendar/sw.js` serves 200.
- Viewports **1280×800** and **390×844**; themes switched through Settings (not by script injection).
- The persistent Playwright profile still contains the `raw-*` and `verify-*` fixtures created by earlier IMP-088/IMP-032/IMP-033 verifications. They are useful evidence for read normalization and are not product data.

## 3. Route / theme / viewport matrix — 40/40 PASS

Every route was visited in all four combinations (10 routes × 2 viewports × 2 themes).
Checks: rendered landmark, `location.hash`, `html.dark`, body background, nav link counts,
and `documentElement.scrollWidth` vs `innerWidth`.

| Route | Desktop light | Desktop dark | Mobile light | Mobile dark | Rendered landmark |
| --- | --- | --- | --- | --- | --- |
| Today | PASS | PASS | PASS | PASS | `h1 Today`, agenda/cards |
| Calendar | PASS | PASS | PASS | PASS | `h2 October 2026`, Day/Week/Month/Year |
| Matrix | PASS | PASS | PASS | PASS | `h1 Eisenhower Matrix`, 4 quadrants |
| Lists | PASS | PASS | PASS | PASS | `[role=table][aria-label=Items]` |
| Goals | PASS | PASS | PASS | PASS | `h1 Goals` |
| Habits | PASS | PASS | PASS | PASS | `h1 Habits` |
| Bills | PASS | PASS | PASS | PASS | `h1 Bills` |
| Shopping | PASS | PASS | PASS | PASS | `h1 Shopping` |
| Notes | PASS | PASS | PASS | PASS | `h1 Notes` |
| Settings | PASS | PASS | PASS | PASS | `h1 Settings` |

- **10/10 destinations** present in the desktop nav (`nav[aria-label="Primary sections"]`)
  and in the mobile nav (`nav[aria-label="Primary"]`); both navs expose 10 links.
- **No horizontal overflow** in any of the 40 checks (`scrollWidth === 1280` or `390`).
- Light body background `rgb(248, 250, 252)`; dark `rgb(2, 6, 23)` with `html.dark`.
- Lists has no `h1` by design (table view); the table landmark is its accessible name.

## 4. Console and network

Across all 40 route checks, every interaction script, and the final hard reload of `#/today`:

- **Console errors: 0. Console warnings: 0.**
- **Page errors: 0.**
- **Failed requests: 0.**
- **HTTP responses ≥ 400: 0.**

This matches the regression-50 baseline (0/0/0). The PWA update toast did not appear during
this sweep (SW was reset, then registered cleanly).

## 5. Interaction checks

### Quick add create
- Pressed `c` on Today; dialog opened with accessible name **Quick add**, `aria-labelledby`
  resolving to the heading and `aria-describedby` to the helper text; input focused on mount.
- Entered `gym every fri`, pressed **Add**. Exactly **one** Gym row was persisted:
  `kind: task`, `start: 2026-10-17`, `allDay: true`,
  `recurrence: { freq: weekly, interval: 1, byWeekday: [5] }` (Friday).
- No duplicate row and no console error. The earlier stale Gym from regression-50 was not present
  after the browser-context reset.

### Command palette
- `⌘K` opened **Command palette**; the combobox had `aria-expanded=true`,
  `aria-controls=command-list`, `aria-activedescendant=nav-/shopping`, and focus.
- Typed `Go to Shopping`, pressed Enter: URL `#/shopping`, `h1 Shopping`, palette closed.

### Item editor open / save / undo / delete
- Opened all seven `raw-*` fixtures (task, event, goal, habit, bill, shopping, note) from Lists:
  7/7 Sheets opened with `aria-labelledby` resolving to the item title; Escape closed them;
  no console/page errors. (This also exercises IMP-088 read normalization; see §5.9.)
- Saved **Alpha task** as **Alpha task edited**; DB updated and `Saved` toast shown.
  `⌘Z` restored **Alpha task**.
- Deleted **Beta task**; confirmation `alertdialog` was named **Delete the whole series**;
  `Delete series` removed the row; `⌘Z` restored it.
- Created **Undo probe** from the editor and immediately pressed `⌘Z`; the row was removed
  (IMP-069 editor-created undo path).
- Note pin on **Raw note no data**: `aria-pressed` false → true, DB `data.pinned=true`,
  then toggled back to false (IMP-033 note coverage).

### List sort
- On Lists (desktop), initial `Date` column had `aria-sort=ascending`, the others `none`.
- First Priority click: `aria-sort=ascending` on Priority, Date `none`; Q4 rows first.
- Second Priority click: `aria-sort=descending`; order began **Alpha task (Q1)**,
  **Gamma task (Q3)**, then Q4 rows.
- Item click: `aria-sort=ascending` on Item, Priority `none`; alphabetical order.
- No console errors; `role=table`/`row`/`columnheader`/`cell` structure rendered correctly.

### Bills paid toggle and totals (IMP-032)
Baseline in the profile: This month **142**, Paid **100**, Remaining **42**.

| Step | This month | Paid | Remaining | Evidence |
| --- | --- | --- | --- | --- |
| Create “Electric bill” amount 120 | 262 | 100 | 162 | Saved, row appears |
| Mark paid | 262 | **220** | 42 | `aria-pressed=true`, payment `{amount:120}` |
| Edit amount to 150 | 292 | **220** | 72 | Recorded payment stays 120 → IMP-032 fix correct |
| Mark unpaid | 292 | 100 | 192 | `aria-pressed=false` |
| Mark paid again | 292 | **250** | 42 | New payment records 150 |

No console errors. The Paid total always equals the sum of recorded payment amounts, not the
current bill amount.

### Habit mark-today (IMP-070 / IMP-033)
- Created **Stretch**; persisted recurrence is **daily**, interval 1 (IMP-070 default).
- Initial streak: 0. Clicked **Complete today**: `aria-pressed=true`, occurrence
  `2026-10-17 = done`, streak current/best = 1.
- Clicked **Undo today**: `aria-pressed=false`, occurrence `todo`, streak 0; re-marked done.
- No console errors.

### Settings theme change
- Clicked **light**, **dark**, **system** through the Settings UI:
  `html.dark` and body background toggled correctly; exactly one theme button had
  `aria-pressed=true`; the choice persisted to IndexedDB (`theme: system` then `dark`).
- Screenshots captured in both themes.

### Exports and imports
- Downloaded **Export JSON** (`eisenmatrix-backup-2026-10-17.json`, app marker + version 2 +
  items array), **Export CSV** (`eisenmatrix-items-2026-10-17.csv`, full 26-column header),
  and **Export ICS** (`eisenmatrix-calendar-2026-10-17.ics`). All downloads completed with no error.
- ICS verified:
  - Multi-day all-day **Retreat**: `DTSTART;VALUE=DATE:20261020` and
    `DTEND;VALUE=DATE:20261023` — exclusive end (IMP-075).
  - Recurring all-day **Weekly sync**: `DTSTART;VALUE=DATE:20261020` and
    `RRULE:FREQ=WEEKLY;INTERVAL=1;UNTIL=20261130` — floating/bare UNTIL, no `Z` (IMP-074).
  - **Gym**: `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=FR`.
- CSV import through Settings with a quoted-comma/escaped-quote row and a mid-field-quote row:
  imported 2, skipped 0. Stored titles were exactly `Roadmap, Q4 "final"` and
  `Mid "quote" here`, proving quotes only open at field start (IMP-031).
- No console or page errors during exports/imports.

### Direct deep-link reload
- Direct load `http://localhost:4173/eisenmatrix-calendar/#/shopping` rendered `h1 Shopping`.
- `location.reload()` preserved `#/shopping` and re-rendered Shopping; the SW re-registered
  (`1` registration, precache cache present); 0 console errors, 0 failed requests.

### Repository read normalization (IMP-088)
- The profile contains seven `raw-*` fixtures, five of which lack `data` entirely
  (`task`, `event`, `goal`, `shopping`, `note`) and two with partial data (`bill`, `habit`).
- All seven open in the editor without crashing; all views render them with defaults:
  Shopping shows quantity 1, Goals shows `0/1`, Notes shows an unpinned note,
  Bills/Calendar/Matrix/Today render the bill/event rows.
- A pin toggle on the data-less note wrote `data.pinned` successfully.
- No console/page errors.

### Boot failure fallback (IMP-039)
- Healthy boot and all routes: no errors (above).
- In a **separate isolated context** with `window.indexedDB` overridden to `undefined`
  (the same simulation used by the IMP-039 verifier), the app still rendered Today instead of
  blanking: `h1 Today`, empty states, and three persistent recoverable toasts with **Reload**
  (storage, migration, notification gate), plus the normal “Ready to work offline” toast.
- This simulated path intentionally logs the three expected fixed-message console errors
(the storage message is logged twice, once by each boot path). It also produces the
  **known pre-existing** unhandled `DatabaseClosedError` from the reminder runtime; this was
  already documented in `verify-IMP-039.md` as residual and is not a regression.
- The ErrorBoundary render fallback itself was not force-triggered in the production bundle;
  its new jsdom tests pass in the gate.

### Node pin (IMP-029)
- `.nvmrc` = `20`; `package.json` `engines.node` = `>=20`; CI and deploy workflows use Node 20.
- The sweep ran on Node v24.21.0, which satisfies the declared range; build and gates pass.

## 6. Touched-area checklist

| Area | Result | Evidence |
| --- | --- | --- |
| itemActions undo/delete | PASS | save→undo, delete→undo, editor-create→undo, empty-delete unit test |
| Overlay naming and ARIA | PASS | Dialog/Sheet `aria-labelledby`, Quick add/Command palette names, alertdialog |
| Toggle/sort ARIA | PASS | theme/paid/habit/pin `aria-pressed`, table `aria-sort` |
| CSV import | PASS | quoted comma, escaped quote, mid-field quote |
| ICS export | PASS | exclusive multi-day DTEND, floating UNTIL, weekly BYDAY |
| Bill totals | PASS | recorded payments, not current amount, after edit |
| Repository read normalization | PASS | 7 raw fixtures across all views/editor |
| Boot error boundary / storage fallback | PASS | isolated blocked-storage context renders Today + toasts |
| Node pin | PASS | `.nvmrc`, engines, CI node 20 |

## 7. Issues

**No regressions. No S0/S1 issues.**

Non-blocking observations (all pre-existing / test-environment only):

1. **Known residual unhandled rejection under blocked storage.** The isolated simulation logs a
   `DatabaseClosedError` page error after the storage toasts. This is the residual
   `ReminderRuntime` path already recorded in `verify-IMP-039.md` §3.1; it does not blank the app,
   and the normal (storage-available) sweep is 0 page errors.
2. **Pre-existing field-label association gap.** `components/ui/Form.tsx` renders `<label>`
   without `htmlFor` unless the caller supplies one, and no caller does. Editor inputs such as
   Title/Amount are therefore not programmatically labelled. This predates this batch and is not
   a regression from IMP-027/IMP-033.
3. **Persistent test fixtures.** `raw-*` / `verify-*` rows from prior verification runs remain in
   the Playwright profile and appear in screenshots. They were not created by this sweep and are
   not shipped data.
4. **Blocked-storage toast stack.** Three persistent toasts appear for one root cause in the
   simulated failure, matching the IMP-039 verifier's noted UX noise.

## 8. Evidence

Screenshots (`.improve/artifacts/regression-60/`):

```
desktop-today-light.png, desktop-today-light-populated.png, desktop-today-dark.png
desktop-lists-light.png, desktop-lists-sort-desc.png
desktop-matrix-light.png
desktop-settings-dark.png, desktop-settings-theme-dark.png
desktop-bills-dark.png, desktop-bills-paid.png
desktop-habits-light.png, desktop-habits-done.png
mobile-today-light.png, mobile-today-dark.png
mobile-matrix-light.png, mobile-bills-light.png
mobile-habits-dark.png, mobile-settings-dark.png
boot-storage-blocked.png
```

Downloads and import fixture (`.improve/artifacts/regression-60/exports/`):

```
eisenmatrix-backup-2026-10-17.json
eisenmatrix-items-2026-10-17.csv
eisenmatrix-calendar-2026-10-17.ics
../import-test.csv
```

## 9. Determinism

- First gate run: **41 files / 425 tests**, 11.64 s, all pass.
- Second standalone `npm run test`: **41 files / 425 tests**, 12.03 s, all pass.
- No flaky tests, no changed snapshots, no order-dependent failures. Build remains green.

## 10. Residual risk

- The ErrorBoundary's render fallback is covered by unit tests, not by a forced render crash in
  the production bundle; the storage-failure boot path was exercised in an isolated context.
- Blocked-storage simulation still produces the known residual reminder-runtime rejection.
- No bisect was needed: no regression candidate was found in `8b46ffa..f916b43`.
