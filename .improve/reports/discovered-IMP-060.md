# Discovered findings — IMP-060

Out-of-scope observations made while implementing IMP-060. Nothing here was fixed.

## 1. Shared item arrays are now shared between components, not just on an empty database

**Where:** `src/hooks/useData.ts` (`itemsSource`, `visibleItems`, `archivedItems`).

Before this change only `EMPTY_ITEMS` was aliased between call sites (the IMP-066 note); every
non-empty `useItems()` result was private to its component. The shared store now deliberately returns
one array instance per flag/source, which is required for AC2, so a future consumer that calls
`items.sort(...)`, `splice`, `reverse` or `push` on the hook result would corrupt every other view
using the same flag. No current consumer mutates the array (re-checked every mutation call on an
`items` value in `src/`), but the invariant is now broader and worth an assertion or a comment in a
future cleanup.

## 2. The `useData` test mock still models `useLiveQuery` synchronously

**Where:** `src/hooks/useData.test.tsx` (`vi.mock('dexie-react-hooks')`).

The `useItem` / `useLists` / `useChildren` / `useSetting` tests keep the original synchronous mock,
while the real hooks resolve asynchronously and `useSyncExternalStore` adds an effect-boundary render.
That is fine for dep/identity assertions, but a future test that depends on pre-resolution defaults or
on the first commit would need the async fake used for items. Not changed to avoid widening this
refactor.
