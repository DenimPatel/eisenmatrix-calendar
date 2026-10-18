# Regression Sweep — s3

- **Date:** 2026-10-18
- **Commit:** `57faf4d` (fix(errors): surface swallowed data-loss errors [IMP-042])
- **Scope:** read-only regression sweep; no source modified.
- **Verdict:** **CLEAN** — no regressions found.

## Gates

| Gate | Command | Result |
| ---- | ------- | ------ |
| Typecheck | `npm run typecheck` | pass (no output) |
| Lint | `npm run lint` | pass (no output) |
| Tests (1st) | `npm run test` | pass — 72 files, 707 tests |
| Tests (2nd) | `npm run test` | pass — 72 files, 707 tests |
| Format | `npm run format:check` | pass — all files Prettier-clean |
| Build | `npm run build` | pass — `dist/` + PWA `sw.js` (28 precache entries) |

## Route sweep (build + preview on :4173)

Served the production build with `npm run preview -- --port 4173 --strictPort`.
Service worker and caches were unregistered/cleared before checking the rebuilt bundle,
per AGENTS.md, then a real document load was forced.

13 screens × 2 viewports × 2 themes = **52 captures**, saved to
`.improve/artifacts/regression-s3/<route>__<viewport>__<theme>.png`.

Screens: Today, Calendar (day/week/month/year), Matrix, Lists, Goals, Habits, Bills,
Shopping, Notes, Settings. Viewports: 1280x800, 390x844. Themes: light, dark.

Per screen recorded: console errors, page errors, failed/4xx–5xx requests, and
horizontal overflow (`documentElement.scrollWidth > clientWidth`), plus a screenshot.

Result: **0 console errors, 0 page errors, 0 failed/4xx–5xx requests, 0 horizontal
overflow** across all 52 combinations. Light/dark class application verified correct for
every capture.

Screenshots visually spot-checked (rendered correctly, correct theme, no clipping):
`today__390x844__light`, `calendar-month__390x844__light`, `settings__1280x800__light`,
`matrix__1280x800__dark`, plus the flow captures below.

> Note: the browser profile persisted a stored theme of `dark` in IndexedDB settings, so
> `prefers-color-scheme` emulation alone had no effect. The sweep set the app theme
> explicitly in the `settings` store before each pass so both themes were exercised
> deterministically. This is test-harness behavior, not an app defect.

## Critical flows

All flows ran against the preview build; each captured console/page errors.

| Flow | Result | Evidence |
| ---- | ------ | -------- |
| Quick add | Pass — `c` opens dialog; `buy milk 2L #groceries` parsed to title "Milk", kind shopping, "2 l", tag `#groceries`; committed and persisted to Shopping/Groceries | `flow-quickadd.png`, `flow-quickadd-result.png` |
| Create / edit / complete / undo task | Pass — created "Regression Task A", edited title, completed (agenda 0/2 → 1/2 done), `⌘Z` restored (1/2 → 0/2) | `flow-task-editor-new.png`, `flow-task-completed.png`, `flow-task-undone.png` |
| Recurring "This and future" edit + undo | Pass — daily series created, occurrence editor shows scope panel, "This and future" split applied (`Regr Series` → `Regr Series FUTURE`, "Series split" toast), `⌘Z` restored the original series | `flow-recurring-editor.png`, `flow-recurring-occurrence.png`, `flow-recurring-after-split.png`, `flow-recurring-undo.png` |
| Habit toggle from Today | Pass — "Complete Morning run for today" → done (0 → 1 day streak); toggled back, restored to before state | `flow-habit-toggled.png` |
| Export / import round trip | Pass — Export JSON produced valid backup v2 (16 items, 4 lists); re-import with "Overwrite existing" reported `Imported 16 items · skipped 0 · overwritten 16 · duplicated 0`; counts unchanged | `export-roundtrip.json`, `flow-export-import.png` |
| Help dialog | Pass — header "Help & syntax" opens dialog, Esc closes | `flow-help-dialog.png` |
| Command palette | Pass — `⌘K` and `/` open palette; filtering to "settings" shows "Go to Settings"; running it navigates and closes | `flow-command-palette.png` |
| Deep-link refresh | Pass — `#/habits` and `#/settings` survive full reload, no redirect to Today | `flow-deeplink-habits.png` |
| Offline load after first visit | Pass — SW active, precache present; with context offline, navigating to and reloading `#/notes` renders from cache with no console errors | `flow-offline-load.png` |

Shortcut sheet (`?`) also verified: opens "Keyboard shortcuts" dialog, Esc closes
(`flow-shortcut-sheet.png`).

## Notes

- No source files were modified.
- A false alarm during flow testing (undo apparently reverting a habit) was a selector
  artifact: `getByRole('button', { name: /Undo/ })` matched the habit toggle
  ("Undo Morning run for today") before the toast button. Task completion is silent (no
  toast); its undo is `⌘Z`, which works. Toast undo should be scoped to
  `[data-testid="toast-stack"]`.
- Preview server was stopped after the sweep.
