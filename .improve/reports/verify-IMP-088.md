# Verify — IMP-088: Normalize items on read so a malformed row cannot blank a view

Reviewer: independent (did not author the change)
Branch: `improve/auto-20261017` (HEAD `9647e37`), working tree uncommitted
Date: 2026-10-17

**VERDICT: PASS** — all four acceptance criteria are met. Findings below include
non-blocking advisories.

## Scope reviewed

| File | Change |
|---|---|
| `src/db/repository.ts` | `itemRepo` read methods map through `normalizeItem`; writes untouched |
| `src/domain/stats.ts` | `habitStreak`/`goalProgress` tolerate missing `data`/`target`/`metric` |
| `src/db/repository.test.ts` | raw no-`data` and `data: null` rows for all 7 kinds; read-only assertion |
| `src/domain/stats.test.ts` | no-`data` habit/goal and empty `{}` goal payload |
| `src/features/noDataRows.test.tsx` (new) | mounts Habits/Goals/Bills/Shopping/Notes/Today on raw rows |
| `.improve/*` | FEATURES status IN-PROGRESS, impl/discovered reports, two unrelated IMP-029 log lines |

Production diff is confined to the two files named in the spec. No debugger/console/TODO
leftovers; no direct Dexie access was added outside `src/db/`; no comments added.

## Acceptance criteria

1. **PASS — read seam yields normalized `data`.** `readItem`/`readItems`
   (`src/db/repository.ts:7-13`) wrap every item read: `all` (`:45`), `get` (`:49`),
   `collectDescendants` (`:87`), `byKind` (`:101`), `byList` (`:105`), `children`
   (`:109`), `query` (`:113`). `collectDescendantIds` returns IDs only. UI read paths are
   `all` (useItems/useArchivedItems), `get` (useItem/itemActions/ReminderRuntime) and
   `children` (useChildren → goal milestones); `byKind`/`byList`/`query` have no
   production caller. No component reads Dexie directly.
2. **PASS — Habits, Goals, Bills, Shopping, Notes and stats render/return with kind
   defaults.** Verified by `src/features/noDataRows.test.tsx` (raw row for every kind,
   six view mounts) and the new `stats.test.ts` cases. Browser: all six affected views
   render the seeded no-`data` rows (evidence below).
3. **PASS — read-only.** Read methods contain no `put`/`add`/`modify`; `normalizeItem`
   is a pure object merge. `repository.test.ts` re-reads the raw rows after `all`/`get`/
   `byKind` and asserts the stored rows still have no `data` key (or still store `null`).
   Browser re-read after visiting every view confirmed the habit row still has no `data`.
4. **PASS — test seeds a no-`data` row per kind and exercises views/stats.**
   `ITEM_KINDS` drives both the repository seed and the view test. The stats
   "does not throw for any kind" case is a control (`overallCompletion` does not read
   `data`), but `habitStreak`/`goalProgress` cases are direct.

### stats cannot divide by a missing target

- `habitStreak` uses `data?.target ?? { count: 1, per: 'day' }` and
  `Math.max(1, Number(target.count) || 1)` (`stats.ts:49-51`); no division by `target`.
- `goalProgress` uses `data?.metric ?? { type: 'binary' }` (`:124`), `target = metric.target ?? 1`
  (`:126`) and keeps the `target === 0 → percent 0` guard (`:136`); the empty-payload test
  yields `0/1`, not `NaN`.
- `completionStats` keeps its `total === 0` guard (`:22`).
- `overallCompletion`/`activeDayStreak` never read `data`.

### IMP-008 / live-query identity

`src/hooks/useData.ts` is untouched. `useLiveQuery` still returns the repository result
verbatim, and the existing `useItems`/`useArchivedItems` `useMemo` behavior is unchanged;
the 8 IMP-008 identity tests pass. Normalization happens inside the query function, and
Dexie already produced fresh arrays/objects per emission before this change, so no new
render-time identity churn is introduced.

## Gates

```
npm run typecheck   PASS
npm run lint        PASS
npm run test        PASS  35 files / 397 tests  (HEAD baseline re-run: 34 files / 386)
npm run build       PASS  tsc + vite + PWA, dist/sw.js generated, precache 18 entries
```

## Non-vacuous test check (HEAD differential)

Temporary copies of HEAD (no workspace edits) with only the new tests copied in:

- `noDataRows.test.tsx`: **6/6 fail on HEAD** — habits (`reading 'target'`), goals
  (`'metric'`), bills (`'amount'`), shopping (`'aisle'`), notes (`'pinned'`), today
  (`'payments'`). Log: `.improve/artifacts/IMP-088/head-view-failures.log`.
- `repository.test.ts` new case and 3 `stats.test.ts` cases: **4 fail on HEAD**
  (`data` absent; `'target'`, `'metric'`, `'current'` undefined). Log:
  `.improve/artifacts/IMP-088/head-seam-failures.log`.

Well-formed-row differential: seeded 11 fully-formed items covering all 7 kinds plus
parent/child/grandchild/archived, then serialized the output of `all`, `get`, `byKind`,
`byList`, `children`, `collectDescendants`, `query` and `count` after stable key sorting.
HEAD output and working-tree output are **byte-identical** (14,594 bytes):
`.improve/artifacts/IMP-088/differential.txt`.

## Browser verification (preview, port 4173)

Cleared the service worker/caches/DB, seeded 7 raw rows (habit, goal, bill, shopping,
note, task, event) with **no `data` property** via plain `indexedDB` transactions, then
did a full document load per route:

| Route | Result | Console |
|---|---|---|
| `#/habits` | "Raw habit no data", "1× per day", heatmap | 0 errors/warnings |
| `#/goals` | "Raw goal no data", "0/1", "This month" | 0 |
| `#/bills` | "Raw bill no data", "USD 0" | 0 |
| `#/shopping` | "Raw shopping no data" | 0 |
| `#/notes` | "Raw note no data" | 0 |
| `#/today` | raw task + raw event (09:00) render | 0 |
| `#/calendar`, `#/matrix` | render (extra regression check) | 0 |

Post-visit re-read of the habit row confirmed it still has no `data` key. Screenshots:
`.improve/artifacts/IMP-088/{habits,goals,bills,shopping,notes,today,calendar,matrix}.png`;
details in `.improve/artifacts/IMP-088/browser-checks.txt`.

The only console noise was on the initial cleanup load (pre-existing `/favicon.ico` 404
and a deleteDatabase warning caused by deleting the DB while the app held it open); no
seeded route load produced an entry.

## Advisories (non-blocking)

1. **Nested partial payloads remain unsafe.** `normalizeItem` shallow-merges `data`, so
   `{ target: null }` / `{ metric: null }` still throws in `HabitsView`/`KindFields`
   (`stats.ts` now survives because it uses optional chaining). Explicitly disclosed in
   `.improve/reports/discovered-IMP-088.md`; outside the "no whole `data`" acceptance
   criteria but worth a follow-up (deep merge or nested guards).
2. **`itemRepo.update` still returns the raw merged row.** No current caller consumes the
   return value for rendering (`patchItem` callers ignore it), so this does not violate
   the read-path criterion; a future consumer could receive unnormalized data.
3. **Test breadth.** The new repository test exercises `all`/`get`/`byKind`; `byList`,
   `children`, `collectDescendants` and `query` rely on the same mapper and were checked
   by code review + the differential corpus, not by dedicated assertions.
4. **Working-tree hygiene.** `.improve/CHANGELOG.md` and `.improve/PROGRESS.log` carry
   unrelated IMP-029 entries; keep them out of an IMP-088 commit. `prettier --check` flags
   a pre-existing formatting line in `src/db/repository.test.ts` (also flagged at HEAD).

## Suggested health delta

**Bugs/Correctness: +2** — eliminates a class of blank-screen crashes for missing/`null`
`data` across six views and two stats functions, with a read-only seam and no behavioral
change to well-formed rows. The nested-payload gap and untested non-UI read methods keep
this below the maximum.
