# Impl — IMP-088: Normalize items on read so a malformed row cannot blank a view

## Files changed
- `src/db/repository.ts` — every `itemRepo` read method (`all`, `get`,
  `collectDescendants`, `byKind`, `byList`, `children`, `query`) now maps stored
  rows through the existing `normalizeItem`. The mapping is pure: nothing is
  written back to Dexie. Write methods (`create`, `update`, `updateMany`,
  `setArchived`, `replaceAll`) are unchanged and still merge raw stored rows.
- `src/domain/stats.ts` — `habitStreak` reads `item.data?.target` with a
  `{ count: 1, per: 'day' }` fallback and a NaN/0 guard, and `goalProgress` falls
  back to `{ type: 'binary' }` when `data.metric` is absent. Existing target
  defaults (`target ?? 1`) and the zero-target percent guard remain, so a
  missing target cannot divide.
- `src/db/repository.test.ts` — seeds raw rows with **missing** and **null**
  `data` for all seven kinds via `db.items.bulkPut`, asserts `itemRepo.get` /
  `all` / `byKind` return `defaultDataFor(kind)`, and asserts the stored rows
  still have no `data` key / still store `null` (read-only normalization).
- `src/domain/stats.test.ts` — `habitStreak`/`goalProgress` receive rows without
  `data` and an empty `{}` goal payload; `overallCompletion`/`activeDayStreak`
  receive a no-`data` row for every kind; none throw.
- `src/features/noDataRows.test.tsx` — new jsdom view test (reusing the
  `createRoot` + `act` pattern from `HabitsView.test.tsx`/`NotesView.test.tsx`)
  seeds a raw row for every kind and mounts `HabitsView`, `GoalsView`,
  `BillsView`, `ShoppingView`, `NotesView` and `TodayView`; each must render its
  kind's title. `TodayView` also asserts the raw task and event render.

## Seam chosen
One seam: the repository read boundary. `useData` is deliberately untouched, so
`useLiveQuery` still returns the repository result verbatim and the existing
live-query identity tests/behavior are preserved. Every view (and
`ReminderRuntime`, command palette, editor children) reads through these methods,
so no per-component `data` guards were added. `stats.ts` keeps defensive
defaults of its own because it is a pure module also callable with unnormalized
rows (as the new unit tests do).

Normalization is read-only: the row is normalized on the way out of Dexie only.
A subsequent user save/toggle may persist the normalized payload through the
existing write path; merely opening a view does not.

## Commands / results
```
npm run typecheck   PASS  (tsc --noEmit, no diagnostics)
npm run lint        PASS  (eslint ., no output)
npm run test        PASS  35 files / 397 tests (baseline 386 + 11 new)
npm run build       PASS  tsc + vite build; PWA precache 18 entries (617.72 KiB); dist/sw.js generated
```

## Browser verification (Playwright MCP, `npm run preview`, port 4173)
Cleared the stale service worker/cache and the pre-existing `eisenmatrix` DB, then
seeded raw IndexedDB rows with **no `data` property** for all seven kinds. With a
full document reload per route: `#/habits` renders “Raw habit no data · 1× per
day”, `#/goals` renders “0% · 0/1 · This month”, `#/bills` renders “USD 0”,
`#/shopping` renders the item, `#/notes` renders the note, and `#/today` renders
the raw task/event/habit/goal/bill. Console after the final load: 0 errors,
0 warnings. Re-reading the seeded habit from IndexedDB confirmed it still has no
`data` key, so the view read did not repair/persist the row.

## Notes
- `query(predicate)` now filters normalized rows in memory instead of using a
  Dexie cursor filter. It has no production caller; the result set is the same,
  and predicates now see the same normalized items as every other read.
- Nested partial payloads remain shallow-merged (e.g. `{ target: { count: 2 } }`
  replaces the default `target`); that is pre-existing `normalizeItem` behavior,
  out of scope here and recorded in the discovered report.
