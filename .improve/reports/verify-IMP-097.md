# verify-IMP-097 — serialize the remaining occurrence edit writers

**Verdict: PASS** (with two unreachable missing-row deviations noted)

Reviewer: independent, did not write the change. Source not modified (probe modules deleted after use).

## Scope reviewed

`git diff` vs acceptance criteria in `.improve/FEATURES.md` (IMP-097). Only
`src/domain/itemActions.ts` and `src/domain/itemActions.test.ts` changed; `src/db/repository.ts` is
untouched (the `updateAtomic` seam already exists from IMP-089, the declared dependency).

- `patchItem` now reads, appends `buildHistory`, merges and writes in one `updateAtomic` transaction;
  the undo snapshot is `result.before`.
- `saveItem`'s edit branch uses `updateAtomic`; undo/`history` derive from the transaction's row.
  Create branch unchanged.
- `skipOccurrence` and `updateRecurring` scope `occurrence` moved onto `patchItemAtomic`; the
  exceptions list / override map is built inside the transaction from the stored row.
- `updateRecurring` scope `future` (head+tail `createMany`) is byte-identical in the diff.

## Criteria checks

1. **Atomic / serialized per item.** All four paths now run their read-modify-write inside
   `db.transaction('rw', db.items, …)` (`repository.ts:76-93`). `updateRecurring` scope `all` is
   routed through `patchItem`, so it is atomic too. No nested-transaction hazard: no caller invokes
   these from inside another Dexie transaction.
2. **Concurrent occurrence edits preserve both.** Non-vacuous differential probe against
   `git show HEAD:src/domain/itemActions.ts`:
   - two `skipOccurrence` of different keys from one stale snapshot → HEAD kept `['2026-07-27']`,
     new keeps `['2026-07-20','2026-07-27']`;
   - two `updateRecurring(..., 'occurrence', …)` → HEAD kept only `Planning`, new keeps both
     overrides. Matches the two new tests; `itemActions.test.ts` passed 3/3 consecutive runs.
3. **Sequential behavior, history, undo, toasts unchanged.** Differential probe ran 12 scenarios
   against HEAD and the new module with `updatedAt`/timestamps/ids normalized: 10 identical
   (patchItem existing/missing, saveItem edit/create/stale-draft, skip existing/already-skipped,
   updateRecurring occurrence/no-op/future). Undo labels, undo counts, toast text and per-field
   history signatures all match.

## Review probes (throwaway, deleted)

- **`patchItem` on a missing/deleted item:** identical — returns `undefined`, no undo entry, no
  toast (`itemRepo.get` and `updateAtomic` both miss).
- **`saveItem` edit of a stale draft:** identical — the draft's full payload wins (last-write-wins,
  pre-existing semantics); `history` is diffed against the transaction's fresh row and the undo
  restores `result.before`.
- **`updatedAt`:** unchanged — `mergeItem` (`repository.ts:20-28`) still stamps `Date.now()` when the
  patch omits it (`patchItem`/`skipOccurrence`/`updateRecurring`) and `saveItem` still supplies one.
- **`future`-split path:** untouched; the probe's `updateRecurring(..., 'future', …)` result
  (split rows, `Split “Standup”` undo label, `Series split` toast) matched HEAD exactly.

## Deviations found (non-blocking)

Both occur only when the row is **absent at the transaction's read** (row deleted concurrently —
unreachable in current UI, no concurrent writer exists), and both are corrections of a prior
false-positive, not data regressions:

- `skipOccurrence` on a missing row: HEAD toasted `Occurrence skipped` despite writing nothing; new
  is silent. The dropped `stored = get(...) ?? item` fallback is the cause.
- `updateRecurring` scope `occurrence` on a missing row: HEAD returned `true`; new returns `false`
  (editor would show "Nothing to update" instead of "Occurrence updated"). No write either way.

The impl report's claim that the no-op guards are "preserved" is imprecise for this missing-row case;
the intended reachable behavior is preserved.

## Gates (clean tree, probes removed)

```
npm run typecheck   PASS
npm run lint        PASS
npm run format:check PASS
npm run test        PASS (46 files, 508 tests; baseline 506 + 2)
npm run build       PASS (tsc --noEmit && vite build; PWA sw.js generated)
```
