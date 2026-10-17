# Verify IMP-066 — Cover the remaining `useData` hooks and drop unreachable guards

- **Verdict:** PASS
- **Reviewer:** independent verification (did not author the change)
- **Date:** 2026-10-17
- **Branch:** `improve/auto-20261017`

## Acceptance criteria

1. **Mock captures deps — MET.** `src/hooks/useData.test.tsx:15-30` records
   `{ querier, deps }` for every call and exposes `lastCall()`. Tests assert exact dep arrays
   (`['1']`, `['2']`, `[null]`, `[undefined]`, `[]`, `['app', JSON.stringify(DEFAULT_SETTINGS)]`).
2. **Coverage — MET.** 9 new tests: `useItem` re-read on id change and `undefined` for
   `null`/`undefined`; `useLists` live rows, `[]` before resolution and empty default;
   `useChildren` re-read on `parentId` change and `[]` for nullish; `useSetting` re-read on key
   change, stored value vs fallback (querier also resolves the fallback against fake-indexeddb),
   and serialized-fallback dep stability. Baseline 427 → 436 matches.
3. **Stable fallback dep — MET.** `useData.ts:38` uses
   `useMemo(() => JSON.stringify(fallback), [fallback])`; all five production call sites pass the
   module-level `DEFAULT_SETTINGS`, so serialization is once per mount, not per render. Dep
   values that trigger a re-read are unchanged because strings compare by value.
4. **Guards and cast removed — MET.** All three `?? []` / `?? fallback` branches and
   `(value ?? fallback) as T` are gone; `useData.ts` returns the `useLiveQuery` result directly.
   `useLiveQuery`'s `defaultResult` overload returns `T | TDefault`, making the branches
   unreachable at the type level, and runtime never yields `undefined` for these queriers
   (`listRepo.all`/`itemRepo.children` always resolve arrays; `settingsRepo.get` returns the
   row or the fallback). Remaining `[] as List[]` / `[] as Item[]` predate the change
   (`git show HEAD:src/hooks/useData.ts`); no new cast and no `as any`.
5. **Gates — MET.** `npm run typecheck` clean, `npm run lint` clean, `npm run test`
   41 files / 436 passed, `npm run build` OK (`dist/sw.js`, 18 precache entries, 620.67 KiB),
   Prettier clean on both changed files.

## Consumer return types

Unchanged: `useLists(): List[]`, `useChildren(): Item[]`, `useSetting<T>(): T`,
`useItem(): Item | undefined`, `useItems(): Item[]`, `useArchivedItems(): Item[]`. The old
`lists ?? []` only widened a value the default-result overload already guaranteed; no consumer
saw a possibly-`undefined` result. `settingsRepo.get` still returns the fallback for a missing
row, so `useSetting` behavior is identical for every stored shape the app writes (always objects).

## Mutation check (scratch copy, workspace untouched)

Copied the tree to a temp directory with linked `node_modules`, emptied `[id]`, `[parentId]` and
`[key, serializedFallback]` to `[]`: exactly 6 tests failed (the two `useItem`, two
`useChildren`, and two `useSetting` dep tests), matching the impl report. A second mutation,
`useMemo(..., [])` in place of `[fallback]`, failed exactly the fallback-dep test, confirming it
guards the memo dependency rather than only the value. Scratch copy deleted; `git status` in the
workspace is unchanged.

## Scope / style

Source diff is confined to `src/hooks/useData.ts` and its test, matching the spec's file list.
`EMPTY_ITEMS` was correctly left alone. Test style follows the existing probe pattern. The
worktree's `.improve/CHANGELOG.md`/`PROGRESS.log` IMP-062 lines and untracked
`discovered-IMP-039.md` are unrelated workflow bookkeeping, not code scope creep.

Minor residual: no assertion spies on `JSON.stringify` to prove it is not re-invoked per render;
the memo dependency mutation above covers the observable contract instead.

## Suggested Tests/Tooling health delta

3 → 4: the suite now covers every `useData` hook's dependencies and fallback paths, and the
mutation check demonstrates the tests are non-vacuous. Remaining gap: the mock never re-executes
the querier on dep change (deps are asserted directly), which is inherent to mocking
`useLiveQuery`.
