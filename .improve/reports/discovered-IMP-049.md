# Discovered during IMP-049

Out-of-scope observations. Nothing below was changed.

## 1. Settings read through a live query cause a one-frame default render

`useSetting` (`src/hooks/useData.ts:34-41`) returns `fallback` synchronously and only
subscribes to the Dexie table afterwards, so any consumer of `AppSettings` first renders
with `DEFAULT_SETTINGS` and re-renders when the stored value resolves. With
`weekStartsOn=0` this is visible on the calendar: the month grid first paints
Monday-first (`Mon…Sun`, first cell `2026-09-28`) and then swaps to Sunday-first
(`Sun…Sat`, first cell `2026-09-27`) a tick later. Observed in Playwright at preview.

Impact: a brief layout/header flicker for Sunday-start users. It also affects
`ItemEditorSheet` → `RecurrenceEditor` (the weekday chips initially render as
Monday-based) and any future settings consumer.

Possible follow-ups (not attempted here): hydrate settings once in `App.tsx` before the
router renders, or have `useSetting` block on first resolve / cache the value in a store.
Also note this is why the new `CalendarView` test polls for the setting-driven render
instead of asserting on the first frame.

## 2. `useItems` returns a fresh array each render (already tracked as IMP-008)

`src/hooks/useData.ts:5-9` filters without `useMemo`, so `useOccurrences`' memo (and
`CalendarView`'s `byDay`/`YearView` work) recomputes on every render. Unchanged here;
already filed as IMP-008.
