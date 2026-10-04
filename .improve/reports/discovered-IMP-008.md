# Discovered findings — IMP-008

Out-of-scope observations made while implementing IMP-008. Nothing here was fixed.

## 1. `useSetting` re-runs and re-serializes its fallback on every render

**Where:** `src/hooks/useData.ts:39-47`.

```ts
() => settingsRepo.get<T>(key, fallback),
[key, JSON.stringify(fallback)],
```

`JSON.stringify(fallback)` is a per-render deep serialize of the fallback, purely to build a stable
dep. For `useSetting<AppSettings>('app', DEFAULT_SETTINGS)` that stringifies the whole settings object
on every render of every one of the 4 call sites (`AppShell`-adjacent views, `SettingsView`,
`CalendarView`, `ItemEditorSheet`, `ReminderRuntime`). A module-level cache keyed by the fallback
object (a `WeakMap<T, string>`) or a `useMemo`-based dep would remove it. Left alone: it is not a
correctness issue and the profile flags settings as an area to avoid.

## 2. Dead nullish fallbacks left in `useData.ts`

`useLists` (`lists ?? []`), `useChildren` (`items ?? []`) and `useSetting`
(`(value ?? fallback) as T`) keep guards that are unreachable: with a `defaultResult` argument,
`useLiveQuery` is typed `T`, not `T | undefined`. The `useSetting` one also carries an unchecked
`as T` cast that can no longer be justified. IMP-008 removed the equivalent `?? []` in `useItems` /
`useArchivedItems` only because it was inside the code being rewritten; sweeping the rest is a
trivial cleanup but not needed for the fix.

## 3. `EMPTY_ITEMS` is now a single array shared by every caller

`src/hooks/useData.ts:6`. The old code gave each `useLiveQuery` call site its own `[] as Item[]`
literal. The module constant is the standard way to keep the pre-resolution default referentially
stable, and it is non-exported, but with an empty database `useItems(true)` hands that exact array
object to every caller. Nothing mutates it today (checked every `push`/`sort`/`splice` on an items
array in `src/` — the five hits are all pushes into locally built grouping maps), so this is a latent
aliasing hazard rather than a live bug. Worth remembering if a future feature starts sorting or
splicing the array it receives from `useItems`.

## 4. Every `useItems()` call site runs its own Dexie live query over the whole table

`useItems` is called in 13 components (`MatrixView`, `BillsView`, `CommandPalette`, `TodayView`,
`HabitsView`, `ListView`, `NotesView`, `GoalsView`, `ShoppingView`, `SettingsView`,
`CalendarView`, `ReminderRuntime`, and the hook itself). Each call constructs its own
`Dexie.liveQuery` observable and its own `itemRepo.all()` result, so one write to `items` re-runs
`toArray()` and an identity comparison 13 times, and each component re-renders independently even
when the change is irrelevant to it (e.g. a shopping-item write re-rendering `CalendarView`).
IMP-008 makes each of those renders cheap, but the duplication remains. A single shared observable
(`Dexie.liveQuery` created once at module scope, exposed through a subscription-counted context or a
small `useSyncExternalStore` cache) would fix the fan-out. Deliberately not done here: it changes
data-flow structure across 13 files, well beyond "smallest complete change" for IMP-008.

## 5. Coverage gap in `useData.ts` is now narrowed but not closed

`src/hooks/useData.test.tsx` (new) covers `useItems` and `useArchivedItems` only. `useItem`,
`useLists`, `useChildren` and `useSetting` still have no test. A future item could extend the same
`vi.mock('dexie-react-hooks')` harness to assert each hook's dep behavior (notably that `useItem`
re-reads when `id` changes and `useSetting` re-reads when `key` or the serialized fallback changes).
