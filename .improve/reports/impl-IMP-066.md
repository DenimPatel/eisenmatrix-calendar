# IMP-066 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File                       | Change                                                                                                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useData.ts`     | `useLists` and `useChildren` return the `useLiveQuery` result directly; removed the unreachable `lists ?? []` / `items ?? []` guards. `useSetting` memoizes the serialized fallback (`useMemo(() => JSON.stringify(fallback), [fallback])`), uses it as the second dep, and returns the live-query value directly; removed the unreachable `?? fallback` and the `as T` cast. |
| `src/hooks/useData.test.tsx` | The `useLiveQuery` mock now captures `(querier, deps)` (and the default result) per call, with a `lastCall()` accessor. Added value probes for `useItem`, `useLists`, `useChildren` and `useSetting` (9 new tests, 17 total in the file).           |

`useItems` / `useArchivedItems` and their memos are untouched, so IMP-008 identity behavior is
unchanged; the existing identity tests still pass. `EMPTY_ITEMS` was left alone (not required here).

## Acceptance criteria

1. **Mock captures deps** — every call pushes `{ querier, deps }` into `liveQuery.calls`; tests assert
   the exact dep arrays.
2. **Coverage** — `useItem` re-reads on `id` (`['1']` → `['2']`) and returns `undefined` for `null` /
   `undefined` without reading; `useLists` returns/re-reads live rows and its empty default; `useChildren`
   re-reads on `parentId` and returns `[]` for nullish parents; `useSetting` re-reads on key change,
   returns stored value vs. fallback, and only changes the serialized fallback dep when the serialized
   value changes.
3. **Stable fallback dep** — `useMemo` keyed on `[fallback]` replaces the per-render `JSON.stringify`.
   Equal-content new objects keep the same dep string; a changed fallback value changes it, preserving
   the old string-comparison re-read semantics.
4. **Guards removed** — all three are unreachable because the `defaultResult` overload types the return
   as `T` (not `T | undefined`): `useLists`/`useChildren` default to `[] as …[]`, `useSetting` defaults
   to `T`. `npm run typecheck` passes with no new cast.
5. **Gates** — see below.

## Mutation check

Emptying the three dep arrays (`[id]`, `[parentId]`, `[key, serializedFallback]` → `[]`) made exactly
the 6 dep-driven tests fail (`useItem` ×2, `useChildren` ×2, `useSetting` ×2); restored immediately.
This confirms the tests fail if the deps are dropped.

## Gates

Final run on the finished tree:

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 41 files, 436 tests passed (baseline 427; +9)
- `npm run build` — OK, `dist/sw.js` emitted, 18 precache entries (620.67 KiB)
- `npx prettier --check src/hooks/useData.ts src/hooks/useData.test.tsx` — clean

No browser check was needed: the change is hook-internal (dep arrays and dead-branch removal), with the
same values and identity returned. No new deps, no public hook signature/behavior change.
