# IMP-060 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File | Change |
| --- | --- |
| `src/hooks/useData.ts` | Replaced the per-hook `useLiveQuery(() => itemRepo.all())` calls in `useItems` / `useArchivedItems` with one module-level, reference-counted `Dexie.liveQuery` source consumed through `useSyncExternalStore`. The source array, the non-archived filter and the archived filter are cached module-level, so every consumer with the same flag gets the same array instance until the data changes. The first listener starts the query; the last listener unsubscribes it. Errors are re-thrown from the snapshot getter, matching `useLiveQuery`'s ErrorBoundary behavior. Filter predicates and the `EMPTY_ITEMS` pre-resolution default are unchanged. |
| `src/hooks/useData.test.tsx` | Added a controllable `liveQuery` mock (partial `dexie` mock) that records query creations, active observers and executions. Updated the existing identity/behavior probes to read the latest rendered value (the shared source now resolves after mount, like real Dexie). Added 3 tests: four consumers share one query and array instances per flag; one emission/change runs one query and updates every consumer; the underlying query is dropped on the last unmount and restarted on the next mount. |

No consumer call site changed. `useItem` / `useChildren` keep their per-site `useLiveQuery` calls as
specified. No new dependencies.

## Acceptance criteria

1. **One shared subscription** — `subscribeItems` starts `liveQuery(() => itemRepo.all())` only when
   the first listener registers and unsubscribes when the last one leaves; both hooks use it.
2. **One execution, shared instances** — one source array per emission; `useItems(true)` returns the
   source, `useItems(false)` and `useArchivedItems()` return cached filtered arrays. The new test
   asserts one query creation, one observer and one execution for four consumers, and `toBe` identity
   between consumers with the same flag.
3. **Filter semantics + IMP-008 stability** — predicates are byte-identical; caches are invalidated
   only when the source array changes, and the include-archived flag still selects a different array.
   The existing identity tests pass unchanged in intent.
4. **No call-site changes, safe empty array** — all 12 production call sites compile untouched;
   `EMPTY_ITEMS` remains the pre-resolution snapshot and nothing in `src/` mutates an items array
   (`grep` for `push|sort|splice|reverse|shift|pop|copyWithin|fill` on items returns only the test
   probe's own recorder).

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 42 files, **453 tests passed** (baseline 450; +3)
- `npm run build` — OK, `dist/sw.js` emitted, 18 precache entries
- `npm run format:check` — clean
- Playwright against `npm run preview` (service worker/caches reset first): created one task
  ("Shared query probe"), confirmed it appeared in **Lists** through the shared subscription, visited
  Today, Calendar, Matrix, Lists, Goals, Habits, Bills, Shopping, Notes and Settings — all rendered,
  zero console errors/warnings. The probe task was deleted afterwards.

## Notes

- The store caches the last snapshot across a gap with zero consumers, so a remount renders the known
  data immediately and then refreshes via liveQuery (previous behavior showed the empty default first).
  This is not user-visible and removes a potential empty-state flash.
- `useItems(false)` and `useArchivedItems()` now share one derived array across components, so they
  must not be mutated; see `discovered-IMP-060.md`.
