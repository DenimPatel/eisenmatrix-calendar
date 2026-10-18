# impl-IMP-131 — Year view expansion & editor analytics

Covers **IMP-131** (year view expands occurrences once per year range) and
**IMP-132** (editor analytics computed only while the Analytics tab is open).

## IMP-131 — Expand occurrences once per year view

- **Files:** `src/features/calendar/CalendarView.tsx`
- **Before:** `YearView` rendered 12 `YearMonthCard`s, each calling
  `useOccurrences(items, from, to)`, i.e. a full `expandOccurrences` pass over every item
  per month, **plus** the parent's own year-range pass (`CalendarView.tsx:71`): 13 passes
  for a year render.
- **After:** The parent's single year-range expansion (already computed for the active
  `interval`) is passed into `YearView`, which buckets it by the occurrence's local month
  (`occKey.slice(5, 7)`) into 12 `Occurrence[]` arrays. `YearMonthCard` is now a pure
  presentational component and no longer expands anything. **1 pass.**
- **Equivalence:** `expandOccurrences` counts `count`/`until` from the series start in
  both the per-month and the whole-year call, and month membership was always decided by
  the canonical occurrence day (the `occKey`), so bucket-by-`occKey`-month reproduces the
  old per-month lists exactly, in the same sort order.

## IMP-132 — Compute editor analytics only when the Analytics tab is open

- **File:** `src/features/item/ItemEditorSheet.tsx`
- **Before:** the `analytics` `useMemo` depended on `draft`, so every keystroke in Title /
  Notes re-ran `itemCompletionStats` + a 120-day `expandOccurrences` even on the Details tab.
- **After:** the memo returns `null` unless `tab === 'analytics'` and adds `tab` to its
  deps. The Analytics `TabPanel` renders nothing while closed, so output is unchanged;
  typing on any other tab performs **zero** expansions.

## Tests

- `src/features/calendar/CalendarView.test.tsx`
  - `expands the year range once instead of once per month card` — spies on
    `expandOccurrences` and asserts exactly **1** call after switching to year mode
    (would be 13 before).
  - `renders each month card exactly as a per-month expansion would` — seeds a
    `count`-limited weekly series, a month-end-clamped series with `until`, and a one-off,
    then asserts every year card's rendered `day+title` list equals the list produced by
    direct per-month `expandOccurrences` calls (equality of output).
- `src/features/item/ItemEditorSheet.test.tsx`
  - `computes analytics only while the Analytics tab is open, with identical output` —
    asserts `expandOccurrences` is **not called** while typing on Details, then that the
    opened Analytics panel shows exactly the `itemCompletionStats` / 120-day expansion
    values computed directly from the item.

## Before / after timings

Measured with a temporary harness against the real recurrence engine (300 recurring items
across a full year; `performance.now()`, 3 warm-up runs then timed). The harness was
removed after measurement.

| Scenario | Before | After | Speedup |
| --- | --- | --- | --- |
| Year expansion, 300 items | 219.89 ms (12 passes) | 66.58 ms (1 pass) | **3.30x** |
| Occurrences produced | 42 603 | 42 603 | identical |
| Editor analytics, per keystroke | 0.1105 ms | 0 (tab closed) | — |
| Editor analytics, typing 20 chars | 2.210 ms | 0.000 ms | — |

The year speedup is under 12x because each per-month pass breaks at its own month end,
whereas the single year pass walks the whole range once.

## Gates

`npm run typecheck`, `npm run lint`, `npm run test` (603 passed), `npm run format:check`,
`npm run build` — all pass.
