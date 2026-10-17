# Verify — IMP-060: Share one items live query instead of one per component

**Verifier:** independent, did not write the change
**Branch:** `improve/auto-20261017` (working tree, uncommitted)
**Date:** 2026-10-17
**VERDICT: PASS**

## Scope reviewed

```
src/hooks/useData.ts        | 71 ++++++++++++++++++++++++++++++++++++-----
src/hooks/useData.test.tsx  | 156 +++++++++++++++++++++++++++++++++++++++-------
```

No consumer call site changed (`git diff` touches only the hook and its test; all 12
production `useItems` calls still compile untouched). `useItem`/`useChildren`/`useLists`/
`useSetting` keep their per-site queries as the spec requires. No new dependencies, no
comments, no styling changes.

The `.improve/CHANGELOG.md` and `.improve/PROGRESS.log` edits concern IMP-035 and were
already dirty before this item (confirmed by `regression-70.md`); the only other doc diff
is IMP-060's status moving TODO -> IN-PROGRESS. Not scope creep from this change.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | One shared, reference-counted subscription backs both hooks | **Met** | `subscribeItems` (`useData.ts:34-49`) adds a listener, starts `liveQuery(() => itemRepo.all())` only at size 1, and unsubscribes + nulls `itemsSubscription` at size 0. `useItems` and `useArchivedItems` (`:68-74`) both pass `subscribeItems` to `useSyncExternalStore`. |
| 2 | One `itemRepo.all()` per write; same array instance per data/flag | **Met** | Sole `itemRepo.all()` subscription in the app is `useData.ts:37` (grep: only tests and the unrelated bulk actions call it). One emission caches one source, one visible array and one archived array (`:56-66`); all `useItems(false)` consumers receive `visibleItems`, all `useItems(true)` consumers receive `itemsSource`. Tests assert one `liveQuery`, one observer, one execution, and `toBe` identity across consumers. |
| 3 | Filter semantics + IMP-008 referential stability | **Met** | Predicates unchanged (`!item.archivedAt`, `item.archivedAt`). Caches invalidated only in `setItemsSource` (`:20-27`); snapshot getters return the cached instance when data/flag are unchanged. Existing identity tests pass; new tests cover same-flag identity, flag flip, data change and cache invalidation. |
| 4 | Call sites unchanged; shared empty array safe | **Met** | Diff has no consumer edits. `itemsSource` still initialises to `EMPTY_ITEMS`; the empty filter result is a private array, and no consumer mutates a hook result (grep for `items.sort/push/splice/...` finds only copies via `filter()`/`slice()` or unrelated locals). |

## useSyncExternalStore scrutiny

- **Client snapshot caching:** correct. Every getSnapshot path returns a cached module
  value; `getVisibleItems`/`getArchivedItems` memoise into `visibleItems`/`archivedItems`
  and `currentItems` returns `itemsSource`, so no new array per render (no infinite-loop
  risk).
- **getServerSnapshot:** not supplied. The app is a client-only HashRouter SPA with no
  SSR/hydration, so this is safe today. It would throw if the app were ever server-rendered;
  non-blocking note only.
- **StrictMode:** refcount handles mount -> cleanup -> mount. Dev StrictMode can start and
  immediately close the first query, then start a second; no listener or subscription is
  orphaned because cleanup always decrements the same Set. Production preview is healthy.
- **Restart after last unmount:** explicitly tested — observer count 0 and a second
  `liveQuery` creation on remount.
- **Error propagation:** `itemsError` is re-thrown from `currentItems`, matching
  `useLiveQuery`'s render-time throw into the root `ErrorBoundary`; a later successful
  emission clears the error and resets both caches.
- **Array cache invalidation:** `setItemsSource` resets both derived caches before
  notifying, and `emitItems` tests prove visible and archived consumers both update.
- **Leaks:** the last unsubscribe closes the Dexie subscription; tests prove
  `observers.size === 0` after the last unmount. The retained source across a
  zero-consumer gap is intentional and documented; in production `ReminderRuntime` and
  `CommandPalette` keep at least one subscriber mounted, so items never go stale behind a
  mutation.

## Test non-vacuity

The shared-query test is non-vacuous:

- If either hook created its own query, `liveQuery.queries` would be 4, not 1, and each
  consumer would filter into a distinct array, so `toBe` identity would fail.
- If the hooks shared data but not a subscription, `observers.size`/`executions` would be
  greater than 1.
- If the subscription were never dropped, the last-unmount test would see 1 observer and
  one query; if it never restarted, it would see 1 query after remount. Both assertions
  fail on those regressions.
- Cache invalidation is pinned by the Gamma/Delta mutation test (archived consumer sees
  Delta, visible consumer sees Gamma).

One weak assertion: `emitItems` increments `executions` itself (`useData.test.tsx:189`),
so `expect(liveQuery.executions).toBe(2)` after an emission is tautological. The same test
still pins the fan-out with `queries.toHaveLength(1)`, and the first test pins the
subscribe count, so coverage is not lost. Non-blocking test-quality note.

`useItems(true)` and `useArchivedItems()` now hand out shared non-empty arrays as well as
`EMPTY_ITEMS`; no current consumer mutates them (checked all 12 call sites; sorts always
follow `filter()`/`slice()`). Worth keeping in mind for future consumers.

## Gates

```
npm run typecheck    PASS  (no diagnostics)
npm run lint         PASS  (no output)
npm run test         PASS  42 files / 453 tests (baseline 450, +3; expected 453)
npm run build        PASS  tsc + vite build; dist/sw.js emitted; 18 precache entries
npm run format:check PASS  All matched files use Prettier code style
```

## Browser verification

Preview build at `http://localhost:4173/eisenmatrix-calendar/`, service workers and caches
reset before the run:

- Boot: `#/today` renders "Today" with persisted data; reload still boots and renders.
- All 10 routes (`today`, `calendar`, `matrix`, `lists`, `goals`, `habits`, `bills`,
  `shopping`, `notes`, `settings`) render their headings/content.
- Quick-add create (`IMP-060 verify probe`) becomes visible on Today and, without reload,
  on Lists; deleting it through Lists removes it from both Lists and Today.
- Console: **0 messages, 0 errors, 0 warnings** across boot, all routes, create, delete
  and reload.
- Evidence: `.improve/artifacts/IMP-060/` (`browser-check.md`, `today.png`,
  `calendar.png`, `lists.png`, `lists-after-create.png`, `lists-after-delete.png`,
  `settings.png`).

## Issues

None blocking. Two non-blocking notes: (1) the tautological `executions` assertion above;
(2) missing `getServerSnapshot` is only a concern if SSR is ever introduced.

## Suggested Performance health delta

**Performance 3 -> 4 (+1).** The 12 per-component `itemRepo.all()` subscriptions collapse
to one reference-counted query, so a write now triggers one table read instead of 12 and
only one Dexie observer re-renders consumers; the remaining open performance gap
(`DIMENSIONS.md`) is closed. No other dimension changes.
