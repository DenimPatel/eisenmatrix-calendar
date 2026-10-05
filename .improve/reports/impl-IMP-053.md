# IMP-053 — Implementation report

**Status:** implemented (all four gates pass; not marked DONE in FEATURES.md)

## Intent

Month cells capped at 3 occurrences and year cards at 5, with a non-interactive
`+N more` `<div>`/`<p>`. Any occurrence past the cap was unreachable from those two
views: no click target, no keyboard target, no screen-reader target. The only route to
those items was switching to `day`/`week` mode or navigating to the item in another view.

## Change

| File | Change |
| --- | --- |
| `src/features/calendar/CalendarView.tsx` | Extracted the two caps into named module constants `MONTH_CELL_LIMIT = 3` / `YEAR_CARD_LIMIT = 5` (previously bare `3` and `5` literals). The month cell now renders `shown = expandedDay === key ? dayOccurrences : dayOccurrences.slice(0, MONTH_CELL_LIMIT)` and the `+N more` `<div>` became a `<button type="button" aria-expanded={expanded}>` that toggles that day in place. `YearMonthCard` gained local `useState` `expanded` and the same toggle, so its `+N more` `<p>` became a `<button>` too. |
| `src/features/calendar/CalendarView.test.tsx` | Added a `CalendarView overflow affordance` describe block (5 tests) driving the real component through jsdom + Dexie. |

### Why in-place expansion rather than a popover/dialog

The acceptance criteria allow either ("expanding in place or opening a popover/dialog"),
and in-place is the smallest complete change:

- The occurrence buttons themselves already carry the whole interaction — `openEditor(occ.item, occ.occKey)` — so revealing them is sufficient to make every item reachable *and* editable at the occurrence level. A dialog would need to re-implement that wiring or embed `ItemCard`.
- Expanded state is transient view state, not session state, so it stays local `useState`
  in the feature and out of `useUiStore` (per AGENTS.md layering).
- The month cell tracks **one** expanded day at a time (`expandedDay: string | null`).
  A cell is ~6.5rem tall inside a fixed 7-column grid; letting several expand at once
  would blow out the row heights for every week on screen. The year cards are independent
  per-month components, so each keeps its own flag.

### Keyboard / a11y

The control is a native `<button>`, so it is in the tab order and responds to Enter/Space
with no extra key handling. `aria-expanded` reflects the toggle so the state is announced.
The label flips `+N more` ↔ `Show less`, matching the existing `aria-expanded="true"`
convention in `CommandPalette.tsx`. Styling uses the same semantic tokens as the row it
replaces (`text-muted` → `hover:bg-elevated hover:text-accent`), so light and dark both
work without a hardcoded colour.

## Acceptance criteria

1. **Month `+N more` is a button that reveals all occurrences for that day** —
   `CalendarView.tsx:184-185` (the `shown` derivation) and `:236-247` (the button).
2. **Year-card `+N more` does the same for that month** — `CalendarView.tsx:342` (local
   `expanded`) and `:347,361-369`.
3. **With 6 items on a day, activating `+3 more` makes all 6 titles reachable** — covered by
   two unit tests plus the Playwright run below.
4. **The default (≤3 / ≤5) rendering is unchanged** — the control is still gated on
   `length > LIMIT`, so at or below the cap no button renders at all and `shown` equals the
   old `slice`. Two dedicated tests assert `moreControl(...) === undefined` at 3 and at 5.

## Tests added

All in `src/features/calendar/CalendarView.test.tsx` (jsdom + `createRoot` + `DndContext`,
matching the existing mount helper in that file). Items are seeded through
`itemRepo.replaceAll` with `createItem({ kind: 'task', …, start: todayKey() })`, then a
`waitForOccurrences` poll waits for the Dexie live query to land before asserting.

| Test | Asserts |
| --- | --- |
| caps a month day at 3 and reveals all 6 titles from `+3 more` | control text `+3 more`, 3 titles before, 6 after |
| collapses back to the capped list on a second activation | control becomes `Show less`, no `+N more` remains, back to 3 titles, then `+3 more` returns |
| keeps the default rendering free of a control at 3 or fewer items | no control, 3 titles |
| caps a year card at 5 and reveals all 6 titles from `+1 more` | control text `+1 more`, 5 titles before, 6 after |
| keeps the default year card free of a control at 5 or fewer items | no control, 5 titles |

**Mutation check.** Two mutants were injected and both were caught:

1. `const shown = dayOccurrences.slice(0, MONTH_CELL_LIMIT)` (drop the expansion branch) →
   2 failures (the two month reveal/collapse tests).
2. `{occurrences.slice(0, YEAR_CARD_LIMIT)}` in `YearMonthCard` → 1 failure.

`src/features/calendar/CalendarView.test.tsx`: 4 tests → 9.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (**29 files, 287 tests
passed**; baseline 28 files / 282 tests, so +1 file-net and +5 tests) · `npm run build`
(OK, `dist/sw.js` emitted, 18 precache entries, 610.74 KiB).

## Browser verification (Playwright, `npm run preview` on :4173)

Seeded 6 tasks on 2026-10-20 through the app's own Quick add (`IMP053 probe <name>
2026-10-20`), then exercised `#/calendar`:

- **Month view**: cell 2026-10-20 showed 3 titles + a `+3 more` **button** (`aria-expanded="false"`).
  Click → all 6 titles rendered, control became `Show less [expanded]`.
- **Keyboard**: with focus on the control, <kbd>Enter</kbd> collapsed it back to `+3 more`
  and 3 titles — native button activation, no custom key handling.
- **Year view**: October card (11 occurrences) showed 5 + `+6 more`; clicking revealed all
  11 and flipped to `Show less [expanded]`. November (6 occurrences) showed 5 + `+1 more`
  and was unaffected by the October toggle, confirming the cards hold independent state.
- **No console errors or warnings** across the whole session.

Playwright caveat worth recording: the first load served a **stale precached bundle** from
the service worker (`workbox-precache-v2-*`), so the old non-interactive `+N more` was still
on screen even after a rebuild. Clearing the cache from inside the page was not enough
(the already-installed worker re-served it); closing and reopening the browser context was.
Anyone re-verifying this item should expect one confusing round before a clean load.

## Scope notes

- `openEditor` was already wired on every occurrence button; this change only makes the
  hidden ones render, so no new editor or store plumbing was needed.
- No data, schema, migration, or `labels.ts` change. `3` and `5` stay display-only
  constants local to the view, as they were.
- Pre-existing defects in this file (recorded in `REPO_PROFILE.md` §7) are untouched and
  remain listed there; nothing new was introduced.
