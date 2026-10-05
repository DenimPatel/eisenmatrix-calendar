# IMP-058 — Implementation report

**Status:** implemented (all four gates pass; not marked DONE in FEATURES.md; not committed)

## Change

| File | Change |
| --- | --- |
| `src/features/habits/HabitsView.tsx` | Reads `useSetting<AppSettings>('app', DEFAULT_SETTINGS)` (the `CalendarView`/`ItemEditorSheet` pattern) and uses `settings.weekStartsOn` for `windowStart` instead of the hardcoded `1`. Adds a narrow weekday legend column to the left of the heatmap, rendered from the shared `weekdayLabels(weekStartsOn)` helper — no local label-order copy. |
| `src/features/habits/HabitsView.test.tsx` | New jsdom test (4 cases) covering the setting-driven weekday order, the first grid date, the Monday default/fallback, and the 84-day window length. |

The heatmap is a `grid-flow-col grid-rows-7` grid: columns are weeks, rows are weekdays, and
`windowStart` is the row-1 weekday. So the legend column (`grid-rows-7`, one cell per row) lines
up with the rows automatically, and its first cell is the configured week day. The legend is
`aria-hidden` because the heatmap itself is a single `role="img"` node — the labels are
decorative for assistive tech and only aid sighted scanning.

## Acceptance criteria

1. `weekStartsOn` read from the `app` setting and used for `windowStart` —
   `src/features/habits/HabitsView.tsx:21-22,32-35`.
2. Weekday order derived via the shared `weekdayLabels` helper (no second copy) —
   `src/features/habits/HabitsView.tsx:140-148`; `src/lib/labels.ts` untouched.
3. Window still spans `DAYS` (84) cells and the default (Monday) rendering is unchanged —
   verified in-browser: 84 cells, first cell `2026-07-13` (Monday), last `2026-10-04`, i.e. the
   same dates as before the change; the only addition is the `Mon…Sun` legend.

## Tests added

`src/features/habits/HabitsView.test.tsx` — seeds one habit via `itemRepo.create(createItem(...))`
and `settingsRepo` with `weekStartsOn` 0/1/none, then asserts the exact weekday legend order, that
the first heatmap cell's `title` date falls on the configured weekday, that the grid still has
`DAYS` cells, and that the window start equals
`startOfWeek(addDays(now, -(DAYS - 1)), weekStartsOn)`. Like `CalendarView.test.tsx`, the mount
helper polls (up to 1s) inside `act` until the setting-driven render lands, because `useSetting`
resolves one frame late. Query helpers return `[]` rather than asserting, so the poll loop is not
aborted by a not-yet-rendered grid (the first draft of the test failed for exactly that reason).

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (26 files, 192 tests passed;
baseline was 191 tests in 25 files) · `npm run build` (OK, `dist/sw.js` emitted, 18 precache entries).
Tests re-run twice more to confirm the polling helper is not flaky.

## Browser verification (Playwright, `npm run preview` on :4173)

Note: the previously installed service worker served the precached old bundle; unregistered the SW,
cleared `workbox-precache-*` and reloaded with a cache-busting query before trusting results.

- Default (Monday) → `#/habits`: legend `Mon Tue Wed Thu Fri Sat Sun`, 84 cells, first cell
  `2026-07-13` (a Monday), last `2026-10-04`; legend column height 122px = grid height 122px
  (rows align in both themes; dark screenshot checked).
- Settings → "Week starts on" = Sunday → `#/habits`: legend `Sun Mon Tue Wed Thu Fri Sat`, first cell
  `2026-07-12` (a Sunday), last `2026-10-03`, still 84 cells.
- Back to Monday → `#/habits`: legend `Mon…Sun`, first cell `2026-07-13`.
- No console errors or warnings on the route; the setting update lands one frame late in the UI,
  which matches the documented `useSetting` behaviour.

## Out of scope

No new findings; nothing written to `discovered-IMP-058.md`.