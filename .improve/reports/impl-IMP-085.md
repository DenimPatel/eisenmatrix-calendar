# IMP-085 — Implementation report

**Status:** implemented; all four gates pass; not marked DONE in FEATURES.md; not committed.

## What was wrong

IMP-016 stores a "This occurrence" retitle in `recurrence.overrides[occKey].title`, but
nothing resolved or rendered it: `Occurrence` had no title, `buildOccurrence` dropped the
override, and every card/list rendered `item.title`. The save toasted "Occurrence updated"
and the user saw no change anywhere.

## Change

Engine-side resolution, exactly as the spec prefers (AC1):

| File | Change |
| --- | --- |
| `src/types/item.ts` | `Occurrence` gains `title: string` — "Effective title after overrides". |
| `src/domain/recurrence.ts` | New exported `resolveOccurrenceTitle(item, occKey)` returning `item.recurrence?.overrides[occKey]?.title ?? item.title`. `buildOccurrence` sets `title: resolveOccurrenceTitle(item, occKey)`. |
| `src/features/item/ItemCard.tsx` | Resolves `title` via the shared resolver when `occurrenceKey` is present (mirroring `resolveOccurrenceStatus` on the line above), else `item.title`; renders `{title || 'Untitled'}`. |
| `src/features/calendar/CalendarView.tsx` | Month/week grid cells (`title` attr + label) and `YearView` rows render `occ.title` instead of `occ.item.title`. |
| `src/features/today/TodayView.tsx` | "What's next", Overdue and Bills-due lines render `occ.title`. |

The two resolver forms AC1 offers are both used: the shared resolver *and* the resolved
`Occurrence.title` that the engine bakes in, so consumers that already carry an occurrence
(the calendar grid, the year view, the Today lists) never need to know about recurrence.

### Call sites the spec did not name

The spec's Area/files and AC2 assume "three call sites that already pass `occurrenceKey`".
That is not accurate: only **two** `ItemCard` call sites pass it (Today agenda
`TodayView.tsx:165`, Calendar `AgendaList` `CalendarView.tsx:279`); `MatrixView` renders
whole items, not occurrences, so it needs no change and already shows the series title
correctly. The Calendar month/week grid, the Calendar year view and Today's Overdue /
Bills / "What's next" lines are separate render paths that printed `occ.item.title`
directly. Leaving them would have contradicted AC2's "Calendar … shows it" and the
verification's "assert the new title on that day's card", so they now consume `occ.title`.
These edits are behaviour-preserving for every occurrence without a title override (AC4),
because `occ.title === item.title` then.

## Acceptance criteria

1. **Done.** `resolveOccurrenceTitle` is the single resolver; `buildOccurrence` sets
   `Occurrence.title` from it.
2. **Done.** `ItemCard` renders the resolved title (Today + Calendar agenda cards); the
   Calendar month/week grid, year view and Today's secondary lists render `occ.title`.
3. **Done.** `resolveOccurrenceTitle` returns the override only for its own `occKey`; every
   sibling falls back to `item.title`. The stored row is untouched by the render change
   (`updateRecurring` already writes only `overrides[occKey].title`).
4. **Done.** Non-recurring items and occurrences without a title override resolve to
   `item.title` (no recurrence → `?? item.title`), rendering exactly as before.

## Tests

`npm run test`: 43 files, **491** passing (+5 new).

- `src/domain/recurrence.test.ts` (+3): the override applies to its own `occKey` only;
  fallback to the series title with no override and with no recurrence; and
  `buildOccurrence` bakes the resolved title onto each occurrence (`only(...).title`).
- `src/features/item/ItemCard.test.tsx` (+2): a retitled occurrence card shows the new
  title while a sibling card shows the series title; a card with no `occurrenceKey` shows
  the series title and not the override.
- `src/domain/stats.test.ts`: the `occurrence()` test fixture gains `title: item.title`
  (compile fix for the new required field).

## Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run test` 43 files / 491 tests ·
`npm run format:check` "All matched files use Prettier code style" ·
`npm run build` OK (`dist/sw.js`, 18 precache entries).

## Browser verification (Playwright, `npm run preview` on :4173)

Used the seeded recurring "Occurrence probe" task (daily, 09:00). Opened the
2026-10-18 occurrence (scope "This occurrence" preselected), set the title to
"Renamed probe", Save.

1. Stored row: base `title: "Occurrence probe"`, `recurrence.overrides` gains only
   `"2026-10-18": { "title": "Renamed probe" }` — siblings untouched (AC3 stored half).
2. Today: the 2026-10-18 agenda card reads "Renamed probe"; no other occurrence of the
   series appears in Today.
3. Calendar (month): the 2026-10-18 cell shows "09:00Renamed probe"; every other day
   (Oct 19–31) shows "09:00Occurrence probe". The Oct 18 card was behind the cell's
   "+2 more" truncation and was revealed to assert it (AC2/AC3 UI half).
4. Console: **0 messages** from the current bundle.

Note: the first preview load served a stale precached bundle (the "A new version is
available" toast); per AGENTS.md the origin's service worker registrations and caches were
unregistered/deleted and the document reloaded, after which the new bundle ran.

Cleanup: the "Renamed probe" override was left in the browser's IndexedDB demo profile; no
repo data is affected.

## Notes / out of scope

`notes` overrides are stored the same way but are still not rendered on cards — unchanged,
as the spec states `title` is the only user-visible half. See
`.improve/reports/discovered-IMP-085.md`.
