# IMP-008 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File                   | Change                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useData.ts` | `useItems` (`:8-14`) and `useArchivedItems` (`:16-19`) now wrap the archived filter in `useMemo`, keyed on `[items, includeArchived]` / `[items]`. Added a module-level `EMPTY_ITEMS` (`:6`) used as the `useLiveQuery` default so the pre-resolution result is also a stable reference. The `items ?? []` fallbacks are gone — with a `defaultResult` the live query is typed `Item[]`, not `Item[] \| undefined`. |

No other file was touched. The consumers named in the intent note needed no change: they already
depend on `items` identity, so they now stop re-running.

- `src/hooks/useOccurrences.ts:18` — the `useMemo` on `[items, …]` no longer re-expands and re-sorts
  every render.
- `src/pwa/ReminderRuntime.tsx:167` — the effect on `[items, …]` no longer tears down and re-arms the
  60s reminder interval on every render.
- `src/features/calendar/CalendarView.tsx:288,327` — the year view's `months` memo and
  `useOccurrences` window no longer recompute on unrelated renders.

Why the memo is keyed on `items` identity and not on a derived value: `useLiveQuery` already holds
the query result in a ref and only re-emits when `itemRepo.all()` produces a different array
(`dexie-react-hooks/dist/dexie-react-hooks.mjs:73-92`), so `items` identity changes exactly when the
data changes. Memoizing on it keeps the filtered array in lockstep with the data and re-filters for
free on a real change.

## Acceptance criteria

1. `useItems()` returns a referentially stable array when data and `includeArchived` are unchanged —
   `useMemo(..., [items, includeArchived])`; asserted across three renders in
   `src/hooks/useData.test.tsx` (`returns the same array reference across re-renders…`,
   `keeps the archived-inclusive result stable too`).
2. `useArchivedItems` is memoized the same way — `useMemo(..., [items])`; asserted in
   `describe('useArchivedItems identity')`.
3. Archived filtering behavior is unchanged — the predicate is byte-identical
   (`!item.archivedAt` for `useItems`, truthy `archivedAt` for `useArchivedItems`); asserted by
   `describe('archived filtering behavior')` (default excludes archived, `includeArchived` includes
   all in source order, `useArchivedItems` returns only archived, empty live query returns `[]`).

Two extra tests guard against over-caching: a new live-query array yields a new result array
(`produces a new array when the live-query data changes`), and flipping `includeArchived` yields a new
array that is then stable again.

## Tests added

`src/hooks/useData.test.tsx` (new, jsdom). `@testing-library/react` is not a dependency, so the file
uses the repo's existing hook-render harness style: `createRoot` + `act` from `react-dom/client`, as
in `src/features/calendar/CalendarView.test.tsx`. A `vi.mock('dexie-react-hooks')` stub returns a
fixed `liveQuery.result` array (held in `vi.hoisted`), which is the "fixed live-query data" the
verification method asks for and keeps the test deterministic. A `tick` prop changes on every
re-render so React cannot bail out of rendering, which is what makes the identity assertions real
rather than vacuous. 8 tests.

Negative check: restoring the old unmemoized bodies makes exactly the two identity tests fail
(`useItems` stability and `useArchivedItems` stability); the three behavior tests still pass,
confirming the filter semantics were not altered.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (16 files, 118 tests passed;
baseline 15 files / 110) · `npm run build` (OK, `dist/sw.js` emitted, 18 precache entries, 602.81 KiB).
`npx prettier --check` clean on both touched files.

## Notes for the verifier

- No browser check was needed: the change is referential identity only, with no DOM or persisted
  output. If a UI pass is wanted, `#/calendar` in month and year modes and the reminder digest
  indicator are the places the effect is visible.
- The vitest run still prints the known benign `--localstorage-file was provided without a valid path`
  Node warning.
