# Regression Sweep — s4

- **Date:** 2026-10-19
- **Branch:** `improve/auto-20261018`
- **Commit:** `ae2052c` (fix(ui): fit the small progress-ring label inside the ring [IMP-145])
- **Range reviewed:** `260551c..HEAD` (10 commits)
- **Scope:** read-only regression sweep; no source or state files modified. Only
  `.improve/artifacts/regression-s4/**` (screenshots, gate log) and this report were written.
- **Verdict:** **CLEAN** — no regressions found.

## 1. Gates

All gates run on `ae2052c`, in order, then `npm run test` repeated for flakes.

| Gate | Command | Result |
| ---- | ------- | ------ |
| Typecheck | `npm run typecheck` | pass (no output) |
| Lint | `npm run lint` | pass (no output) |
| Tests (1st) | `npm run test` | pass — **77 files, 793 tests** |
| Tests (2nd) | `npm run test` | pass — **77 files, 793 tests** (no flakes) |
| Format | `npm run format:check` | pass — all files Prettier-clean |
| Build | `npm run build` | pass — `dist/` + PWA `sw.js`, **28 precache entries (660.08 KiB)** |

Baseline at `260551c` was 72 files / 707 tests. Delta is +5 files / +86 tests, all green.
Log: `.improve/artifacts/regression-s4/gates.log`.

## 2. Route sweep (build + isolated preview on :4194)

Served the production build with `npm run preview -- --port 4194 --strictPort`. Service
worker and caches were unregistered/cleared per AGENTS.md, then a real document load was
forced. 10 routes × 2 viewports × 2 themes = **40 captures**, saved to
`.improve/artifacts/regression-s4/<route>__<viewport>__<theme>.png`.

Routes: today, calendar, matrix, lists, goals, habits, bills, shopping, notes, settings.
Viewports: 1280x800, 390x844. Themes: light, dark (via `prefers-color-scheme`).

Per capture: console errors, page errors, failed requests, 4xx/5xx responses, horizontal
overflow (`documentElement.scrollWidth > clientWidth`), applied `dark` class, `document.title`.

**Result: 0 console errors, 0 page errors, 0 failed requests, 0 4xx/5xx, 0 horizontal
overflow, correct theme class, and correct per-route title across all 40 combinations.**

Per-route `document.title` (SPA navigation) — all correct:

```
today → "Today — EisenMatrix Calendar"    matrix   → "Matrix — EisenMatrix Calendar"
calendar → "Calendar — EisenMatrix Calendar"  lists → "Lists — EisenMatrix Calendar"
goals → "Goals — EisenMatrix Calendar"    habits   → "Habits — EisenMatrix Calendar"
bills → "Bills — EisenMatrix Calendar"    shopping → "Shopping — EisenMatrix Calendar"
notes → "Notes — EisenMatrix Calendar"    settings → "Settings — EisenMatrix Calendar"
```

`RouteAnnouncer` live region (`[role="status"].sr-only`) also updates on navigation
(Today→Calendar announces "Calendar", →Habits announces "Habits").

## 3. Deep links, refresh, PWA

- 10 hash routes × (fresh document load + full reload) = **20 loads**: 0 console errors,
  0 page errors, 0 failed/4xx–5xx requests, 0 overflow, no route throws, correct view h1.
- **PWA precache intact:** after a clean unregister/clear cycle the worker re-installs and
  `workbox-precache-v2-http://localhost:4194/eisenmatrix-calendar/` holds 24 unique entries
  (28 manifest entries deduped). SW state `activated`, page controlled.

## 4. Key flows (preview build, 1280x800)

| Flow | Result | Evidence |
| ---- | ------ | -------- |
| Quick add + **Kind switch chips** | Pass — `pay electricity $120 every month on the 5th !urgent` → chips `bill, 2026-10-18, every month on the 5, USD 120, Urgent`; Kind→**Note** drops amount+recurrence (`note, date, Urgent`); Kind→**Event** keeps recurrence, drops amount; Kind→Bill restores both | `flow-quickadd-kind-bill.png` |
| Quick add commit | Pass — toast `Added "Pay electricity"`; note commit stored as a note (visible in Notes) | `flow-notes-add.png` |
| **Item editor** tabs | Pass — Details / Schedule / Analytics / History (4 tabs) | `flow-editor-occurrence-details.png` |
| **Editor Start time (IMP-137)** | Pass — value `07:00`, rendered `07:00 AM` fully visible; input `clientWidth 119 == scrollWidth 119` (no clipping) | `flow-editor-schedule-timed.png` |
| **Subtask scope (IMP-142)** | Pass — occurrence scope defaults on a recurring occurrence; "Add subtask" input is **disabled**; label reads `Subtasks · Applies to the whole series`; scope "This and future" disables Delete with the explanatory note | `flow-editor-occurrence-details.png` |
| **Reminder reconciliation (IMP-143)** | Pass — timed: control `Reminder offset = -10`, label `Before 10 min` (agree); toggle **All day** → control `Reminder time = 06:50`, label `At 06:50` (agree); toggle back → `Reminder offset = 0`, label `At start` (agree) | `flow-reminder-allday.png` |
| **Scoped toast Undo (IMP-141)** | Pass — delete "Gamma task" (toast `Deleted` + Undo); complete "Delta task" (second action); click the Delete toast's Undo → Gamma restored **and** Delta still Done | `flow-undo-scoped.png` |
| **ProgressRing label (IMP-145)** | Pass — small ring size 28, compact label "13" width 11.74px vs inner diameter 22px (no overlap); Goals ring size 56 still renders `0%` | `flow-ring-small.png`, `flow-goals-ring.png` |
| Command palette | Pass — `⌘K` opens; `Go to Settings` runs and navigates to `#/settings` | `flow-command-palette.png` |
| Help | Pass — "Help & syntax" dialog opens; Esc closes | `flow-help.png` |
| Shortcut sheet | Pass — `?` opens "Keyboard shortcuts"; Esc closes | `flow-shortcut-sheet.png` |
| Matrix DnD | Pass — dragged "Drag me task" from Eliminate (q4) to Do First (q1): q1 1→2, q4 10→9 | `flow-matrix-before.png`, `flow-matrix-after.png` |
| Calendar day/week/month/year | Pass — each mode renders, header updates, no overflow | `flow-calendar-{day,week,month,year}.png` |
| Habits toggle | Pass — new habit created, "Complete today" → "Undo today" | `flow-habit-toggle.png` |
| Bill paid toggle | Pass — new bill created, "Mark paid" → "Mark unpaid" | `flow-bill-paid.png` |
| Shopping add | Pass — `milk 2L` added | `flow-shopping-add.png` |
| Notes add | Pass — note added and listed | `flow-notes-add.png` |
| Settings theme toggle | Pass — dark → `html.dark` true; light → false | `flow-settings-dark.png`, `flow-settings-light.png` |

## 5. Regressions vs known failures

- **New regressions: none.** No console errors, page errors, failed requests, 4xx/5xx, or
  layout overflow appeared on any route, viewport, theme, deep link, or reload — matching
  the `260551c` baseline (which was also clean on these signals).
- Known pre-existing, unchanged by this session:
  - Dependabot TS7 / coverage-v8 PRs fail CI (tooling, not app).
  - IMP-017 BLOCKED.
  - Mixed imported reminder shape (IMP-184) — hand-crafted import-only reminders can still
    show two times; not producible by any app path.
- Pre-existing behaviors observed, **not** introduced this session and not regressions:
  - A direct deep-link/first paint keeps the static title `EisenMatrix Calendar`; the
    per-route title is set on in-app navigation. This is the documented `planRouteChange`
    design (`previousPathname === null | '/'` → no title) and matches the baseline, which
    had no per-route titles at all.
  - All-day tasks due today surface under "Overdue" after local midnight (pre-existing
    dueAt semantics), so a task can render in both "Overdue" and "Today's agenda".
  - Quick-add recurrence chip renders "every month on the 5" (no ordinal suffix) — existing
    `describeRecurrence` wording.

## 6. Harness notes

- The Playwright profile's `localhost:4194` origin already held leftover fixture items from
  an earlier session (e.g. "Team meeting", "A considerably longer task title…"). This is
  shared-browser-profile state, not app behavior; flows were run against that DB.
- During the first reset pass the already-active SW had completed install before caches were
  cleared, so an immediate `caches.keys()` read was empty; a clean unregister→reload cycle
  re-installs and precaches correctly (verified in §3).
- The preview server (`:4194`) was stopped after the sweep; artifacts under
  `.improve/artifacts/regression-s4/` (62 PNGs + `gates.log`).

**VERDICT: CLEAN.**
