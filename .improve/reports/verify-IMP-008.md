# Verification report — IMP-008 (memoize `useItems`)

Verifier: independent reviewer (did not author the change). Date: 2026-10-04.
Base: branch `improve/auto-20261003`, HEAD `4ac86f9` (IMP-007), working-tree diff only.

## Verdict

**PASS** — all three acceptance criteria met; gates green; mutation check confirms the new
tests actually pin the memoization. Three non-blocking observations recorded below.

## Diff under review

```
 M .improve/PROGRESS.log        |  1 +
 M src/hooks/useData.ts         | 15 ++++++++++-----
 ?? .improve/reports/discovered-IMP-008.md
 ?? .improve/reports/impl-IMP-008.md
 ?? src/hooks/useData.test.tsx
 ?? .kilo/
```

`src/hooks/useData.ts` (the entire production change, `+10/-5`):

```diff
+import { useMemo } from 'react';
 import { useLiveQuery } from 'dexie-react-hooks';
 import { itemRepo, listRepo, settingsRepo } from '@/db/repository';
 import type { Item, List } from '@/types';
 
+const EMPTY_ITEMS: Item[] = [];
+
 export function useItems(includeArchived = false): Item[] {
-  const items = useLiveQuery(() => itemRepo.all(), [], [] as Item[]);
-  const list = items ?? [];
-  return includeArchived ? list : list.filter((item) => !item.archivedAt);
+  const items = useLiveQuery(() => itemRepo.all(), [], EMPTY_ITEMS);
+  return useMemo(
+    () => (includeArchived ? items : items.filter((item) => !item.archivedAt)),
+    [items, includeArchived],
+  );
 }
 
 export function useArchivedItems(): Item[] {
-  const items = useLiveQuery(() => itemRepo.all(), [], [] as Item[]);
-  return (items ?? []).filter((item) => item.archivedAt);
+  const items = useLiveQuery(() => itemRepo.all(), [], EMPTY_ITEMS);
+  return useMemo(() => items.filter((item) => item.archivedAt), [items]);
 }
```

No other production file was touched. No consumer needed a change.

## 1. Acceptance criteria

| # | Criterion | Status | Evidence |
| - | --------- | ------ | -------- |
| 1 | `useItems()` referentially stable when data + `includeArchived` unchanged | **met** | `src/hooks/useData.ts:10-13` — `useMemo(..., [items, includeArchived])`. Tests `src/hooks/useData.test.tsx:77-96` assert `.toBe()` identity across 2–3 renders, with a `tick` prop (`:26-30`, `:43-47`) that changes every render so React cannot bail out and make the assertion vacuous. |
| 2 | `useArchivedItems` memoized consistently | **met** | `src/hooks/useData.ts:18` — `useMemo(..., [items])`. Test `src/hooks/useData.test.tsx:123-132`. |
| 3 | Archived filtering behavior unchanged | **met** | Predicate text is byte-identical: `!item.archivedAt` for `useItems` (`useData.ts:11`), truthy `archivedAt` for `useArchivedItems` (`useData.ts:18`). `describe('archived filtering behavior')` (`useData.test.tsx:135-160`) pins: default excludes archived → `['Alpha','Beta']`; `includeArchived=true` → `['Alpha','Archived one','Beta']` in source order; `useArchivedItems` → `['Archived one']`; empty live query → `[]`. Additionally proven by the mutation check below: with the memo removed, these 3 tests still pass while only the identity tests fail. |
| — | Verification method: new `src/hooks/useData.test.tsx`, `npm run test` | **met** | File exists (161 lines, 8 tests); full suite green. |

Anti-over-caching guards are present and non-vacuous: new live-query array ⇒ new result
(`useData.test.tsx:98-107`); `includeArchived` flip ⇒ new result that is then stable again
(`:109-119`).

## 2. Correctness of the memoization (not just speed)

**Is keying on `items` identity safe?** Yes — verified against the installed implementation,
not assumed. `node_modules/dexie-react-hooks/dist/dexie-react-hooks.mjs:14-21,74-92`:

- `monitor.current.result` is initialized to `defaultResult` and is only ever replaced by a
  value emitted by `Dexie.liveQuery(querier)`.
- The subscription guard is `current.result !== val`, so a re-render is only triggered when the
  observable emits a **different array reference**. `itemRepo.all()` resolves through Dexie
  `toArray()`, which allocates a fresh array on every observed change ⇒ `items` identity changes
  exactly when the data (or a query-invalidating table write) changes.
- Errors are thrown to an error boundary, never returned as `undefined`.

**Is dropping `items ?? []` safe?** Yes, for the same reason: with a `defaultResult` supplied,
`useLiveQuery` never returns `undefined`, so `items.filter(...)` cannot throw on a nullish value.
Confirmed empirically: the app renders the pre-resolution frame (`Settings` showed
"0 items · 0 lists" and the calendar showed an empty grid) and then filled in — i.e. the default
path executed and resolved cleanly, with no console output.

**Can a caller mutate a shared/aliased array?** No caller can today — audited exhaustively.
Every in-place array mutation in `src/` was enumerated
(`rg -n "\.(sort|reverse|push|splice|pop|shift|unshift|fill|copyWithin)\(" src --glob '!*.test.*'`),
and every one that touches `useItems()` output operates on a freshly allocated array:

- `src/features/matrix/MatrixView.tsx:27-30` — `items.filter().filter().sort()`
- `src/features/notes/NotesView.tsx:20-22` — `items.filter().sort()`
- `src/features/goals/GoalsView.tsx:24-26` — `items.filter().sort()`
- `src/features/list/ListView.tsx:52` — `result.slice().sort()`
- `src/hooks/useOccurrences.ts:11-17` — `items.flatMap(...)` then sort
- `src/features/today/TodayView.tsx:69,79`, `src/features/calendar/CalendarView.tsx:73,264`,
  `src/features/shopping/ShoppingView.tsx:37,40`, `src/features/goals/GoalsView.tsx:31-36`,
  `src/pwa/ReminderRuntime.tsx:54` — all build new arrays

`useItems(true)` (`src/features/settings/SettingsView.tsx:42`) receives the Dexie array itself;
`buildBackup(items, …)`, `itemsToCSV(items)`, `itemsToICS(items)` are read-only.

**Stale-result check:** none. Because the memo key is `items` identity (which changes on every
real data change), and `includeArchived` is the second key, both invalidation paths are covered.
Live-updating verified in-browser: with the year view open, quick-adding "Weekly review every
monday" immediately populated October/November/December with 5/4/4 occurrences, with no reload and
no console output — the new item arrived through `useLiveQuery` → new `items` → memo recompute.

**Reminder runtime:** not broken. `src/pwa/ReminderRuntime.tsx:167` depends on `[items, …]`; with
the memo the effect now arms the 60s `setInterval` **once** instead of tearing it down and
re-arming on every render (the actual bug IMP-008 targets), and it still re-arms when items
genuinely change (proven by the live-update check above). The interval/`visibilitychange`/SW
listener cleanup at `:161-166` is unchanged. Digests still depend on `settings.digestEnabled` /
`digestTime`, which are separate keys and unaffected.

## 3. Gates (300s budget, `npm run typecheck && npm run lint && npm run test`)

```
> tsc --noEmit          → no diagnostics, exit 0
> eslint .              → no output, exit 0
> vitest run            → Test Files 16 passed (16) | Tests 118 passed (118) | 8.55s
```

Baseline 15 files / 110 tests (`.improve/FEATURES.md` IMP-007 note) → +1 file / +8 tests. Matches
the implementer's report exactly. `npx prettier --check src/hooks/useData.ts src/hooks/useData.test.tsx`
→ "All matched files use Prettier code style!".

## 4. Mutation check (remove the `useMemo`)

Replaced both memoized bodies with the pre-change unmemoized bodies
(`return includeArchived ? items : items.filter(...)`, `return items.filter(...)`), then ran
`npx vitest run src/hooks/useData.test.tsx`:

```
Test Files  1 failed (1)
     Tests  2 failed | 6 passed (8)

FAIL  useItems identity > returns the same array reference across re-renders when the data is unchanged
  AssertionError: expected [ …(2) ] to be [ …(2) ] // Object.is equality
   ❯ src/hooks/useData.test.tsx:84:26
FAIL  useArchivedItems identity > returns the same array reference across re-renders when the data is unchanged
  AssertionError: expected [ { id: '3', kind: 'task', …(23) } ] to be [ { id: '3', … } ]
   ❯ src/hooks/useData.test.tsx:129:29
```

Exactly the two identity tests fail; the three archived-filtering tests and the two
anti-over-caching tests still pass. This is the strongest single piece of evidence for the report:
(a) the new tests are non-vacuous and genuinely pin the memoization, and (b) archived-filtering
semantics are provably independent of the memoization.

`src/hooks/useData.ts` restored byte-identical to the reviewed diff afterwards
(`git diff -- src/hooks/useData.ts` reproduces the hunk above exactly).

## 5. Runtime / calendar year view (dev server + Playwright)

`npm run dev` → `http://localhost:3000/eisenmatrix-calendar/`.

| Route | Result |
| ----- | ------ |
| `#/calendar` month | Renders; header `Mon Tue Wed Wed Thu Fri Sat Sun` — IMP-049 `weekStartsOn` behavior preserved; October 2026 grid correct (28 Sep … 1 Nov). |
| `#/calendar` year | 12 month cards render; "Review every monday" appears on Oct 3/10/17/24/31, Nov 7/14/21/28, Dec 5/12/19/26 — correct weekly Mondays, live-updated on create. |
| `#/settings` | Renders (uses `useItems(true)`); "0 items" pre-resolution frame resolves without error. |
| `#/matrix` | 4 quadrants render; per-quadrant `.sort()` on filtered arrays causes no corruption (0/0/0/0 for a low-urgency/low-importance task). |

`playwright_browser_console_messages` returned **zero** entries (no errors, no warnings, no
React warnings) across all navigations. Dev server stopped; browser closed.

## Issues / observations (none blocking)

1. **Low — `EMPTY_ITEMS` is untested.** A second mutation replacing the shared `EMPTY_ITEMS` with
   a fresh `[] as Item[]` at each call site still passes all 8 tests (`npx vitest run
   src/hooks/useData.test.tsx` → 8 passed). The constant's only purpose is pre-resolution identity,
   and `returns an empty list when the live query has no data yet` (`useData.test.tsx:151-160`)
   asserts `toEqual`, not `toBe`. *Actionable:* add `expect(run.items[0]).toBe(run.archived[0])`
   while the live query is empty, or assert `toBe` against the pre-resolution value. Not a
   correctness bug — only a coverage gap.
2. **Low — latent aliasing hazard, no current trigger.** With `includeArchived === true` the hook
   returns the array produced by `Dexie.liveQuery`, and before that resolves it returns the
   module-level shared `EMPTY_ITEMS`. A caller that did `items.sort()` on that value would poison
   every other hook instance. Today no caller does (audited above), and this exact aliasing already
   existed pre-change (`includeArchived ? list : …` returned the same array), so the change does not
   introduce it — it only makes the returned array stable, so a mutation would now persist across
   renders. *Actionable (optional):* `Object.freeze` the default, or document the read-only
   contract on the hook.
3. **Informational — memo does not eliminate all churn.** Because the `dexie-react-hooks` guard is
   `result !== val`, any write that invalidates `itemRepo.all()` (including a `settings` write, if
   the query observes that table) still produces a new array with identical contents and re-runs
   consumers' memos. The memo does fully fix the churn IMP-008 targets — re-renders caused by
   unrelated React state — so the intent is met; consumers are not fully insulated from cross-table
   writes. Out of scope for this item.
4. **Informational — unrelated changes in the working tree.** `.improve/PROGRESS.log` has one
   added line, and it is the **IMP-007** entry, not an IMP-008 entry:
   `2026-10-04T03:19Z | IMP-007 | done | 4ac86f9 | note quick-add no longer truncates…`.
   IMP-007 is already committed (`4ac86f9`), so this is a leftover log line from the prior item,
   not scope creep by IMP-008 — but it will be swept into whatever commit lands next, and IMP-008
   itself has no `PROGRESS.log` entry. `.kilo/` is untracked harness config. Neither contains
   secrets, debug output, or unrelated production code.
5. **Informational — no leftover `console.*`/`debugger`/TODO** in either touched file
   (`rg` → none). No hardcoded colors or styling introduced (no JSX touched). No secrets.
6. **Informational — status bookkeeping.** `FEATURES.md:157` still reads `- **Status:** TODO` for
   IMP-008 and the item was intentionally not marked DONE (documented in the impl report). Since
   this verification passes, IMP-008 can be flipped to DONE with a Notes line and a
   `PROGRESS.log` row added.

## Commands run

```bash
git status && git log --oneline -5
git diff -- src/hooks/useData.ts .improve/PROGRESS.log
npm run typecheck && npm run lint && npm run test          # 16 files / 118 tests, exit 0
npx prettier --check src/hooks/useData.ts src/hooks/useData.test.tsx
# mutation 1: strip both useMemo calls        -> 2 failed | 6 passed
# mutation 2: EMPTY_ITEMS -> fresh [] each call -> 8 passed (coverage gap, see Issue 1)
npx vitest run src/hooks/useData.test.tsx
rg -n "\.(sort|reverse|push|splice|pop|shift|unshift|fill|copyWithin)\(" src --glob '!*.test.*'
rg -n "console\.(log|debug|warn)|TODO|FIXME|XXX|debugger" src/hooks/useData.ts src/hooks/useData.test.tsx
sed -n '1,140p' node_modules/dexie-react-hooks/dist/dexie-react-hooks.mjs
npm run dev                                                # Playwright MCP against :3000
```

Nothing was committed. Only this report file was added.