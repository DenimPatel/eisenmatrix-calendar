# Verify — IMP-071: Backfill `data` so a row without it cannot crash the editor

**Verifier:** independent, did not write the change
**Branch:** `improve/auto-20261017` (working tree, uncommitted)
**Date:** 2026-10-17
**VERDICT: PASS** (with one out-of-scope, user-facing residual risk documented below)

## Scope reviewed

`git diff` against HEAD (`612bc4b`), source only:

```
src/domain/itemFactory.ts              |  2 +-
src/features/item/KindFields.tsx       | 77 ++++++++++++++++++++++--------------
src/lib/ics.ts                         |  2 +-
src/domain/itemFactory.test.ts         | 17 +++++++++-
src/features/item/ItemEditorSheet.test.tsx | 16 ++++++++
src/lib/backup.test.ts                 | 22 +++++++++-
src/lib/csv.test.ts                    |  6 ++++
src/lib/ics.test.ts                    | 12 +++++-
```

- `normalizeItem` now writes `data: { ...defaultDataFor(kind), ...(partial.data ?? {}) }`
  instead of spreading `base.data` from the `createItem` intermediate. This is
  behaviorally equivalent for well-formed and missing/`null` data (the previous
  `base.data` was already `defaultDataFor(kind)`), but it is clearer and removes reliance
  on the intermediate; partial top-level payloads still merge over the defaults.
- `KindFields` normalizes the incoming `item` once at the top and switches/reads on
  `normalized`, replacing ~30 direct `item.data.X` reads. This is the actual defense for
  unnormalized callers (the previous `normalizeItem` already backfilled `data`, so the
  crash came from the editor reading the raw draft). The rewrite is mechanical: every
  read kept its exact fallback/default and every `onData` patch is byte-for-byte the same
  (only line wrapping changed). No field semantics, labels, option lists or typed values
  changed.
- `itemsToICS` uses `item.data?.location`, covering `undefined` and `null` payloads.
- No debug output, `console.*`, TODOs, comments or new dependencies. No production files
  outside the three named areas were touched. The only unrelated churn is a Prettier
  re-wrap of an existing `mergeImportedItems(...)` call in `backup.test.ts` (no semantic
  change).
- `.improve/FEATURES.md`, `.improve/PROGRESS.log`, `.improve/STATE.md` were already
  dirty orchestration metadata; not part of the code change.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `normalizeItem` backfills missing/`null` data with `defaultDataFor(kind)`; partial payloads merge; `csvToItems`/`parseBackup` import path yields a full row | **Met** | `itemFactory.ts:126`. New `it.each(ITEM_KINDS)` asserts `missing.data` **and** `data: null` equal `defaultDataFor(kind)` for all 7 kinds, plus a partial `{ why: 'Because' }` goal merges over defaults (`itemFactory.test.ts:56-68`). `SettingsView.tsx:106-107` maps `parseBackup(...).items` through `normalizeItem`; `:128` does the same for `csvToItems`; new tests exercise both paths (habit defaults, goal defaults). I independently re-ran the sweep for every kind. |
| 2 | Opening the editor for a row stored without `data` renders Details with kind defaults, not a throw | **Met** | Unit test opens the editor for `data: undefined` habit and asserts `Target count` = 1 (`ItemEditorSheet.test.tsx:163-177`). Browser proof below: seeded a real IndexedDB row with **no `data` property**, hard-reloaded, opened it from the command palette, dialog rendered Details with `Target count` = `1` and **0 console messages**. My temporary all-kind test also mounted the editor for all 7 kinds with `data: undefined`. |
| 3 | No `TypeError` from `KindFields` or `itemsToICS` when `data` is `undefined` | **Met** | Temporary independent test (22/22 passing, then removed): `KindFields` renders for all 7 kinds, `ItemEditorSheet` opens for all 7 kinds, and `itemsToICS([item])` does not throw for all 7 kinds with `data: undefined`. Committed `ics.test.ts` pins the event case; `KindFields` uses defaults/`??` guards for every read. |

## Gates (run from the working tree)

```
npm run typecheck   PASS  (tsc --noEmit, no diagnostics)
npm run lint        PASS  (eslint ., no output)
npm run test        PASS  33 files / 355 tests (baseline 343 + 12 new)
npm run build       PASS  tsc + vite build; PWA precache 18 entries; dist/sw.js generated
```

## Independent verification performed

### 1. Temporary cross-kind test (removed afterward)

Created `src/features/item/__verify_imp071.test.tsx` (jsdom, `react-dom/client`) and ran
`npx vitest run src/features/item/__verify_imp071.test.tsx` → **22/22 passed**:

- `normalizeItem` backfill for missing and `null` data, all 7 kinds.
- `KindFields` render for all 7 kinds with `data: undefined` (non-empty output, no throw).
- `ItemEditorSheet` mount + `openEditor(raw)` for all 7 kinds; Details tab present, no
  crash overlay.
- `itemsToICS` with `data: undefined` for all 7 kinds does not throw.

The file was deleted; `git status` is back to only the intended changes.

### 2. Browser proof with a raw IndexedDB row (Playwright MCP, preview)

Built this working tree, started `npm run preview` (`http://localhost:4173/eisenmatrix-calendar/`).
Stale-SW handling: unregistered all service workers, deleted the `workbox-precache-v2`
cache, deleted the `eisenmatrix` IndexedDB, then loaded with a cache-busting query
(`?verify=imp071#/settings`).

Seeded a version-1 `eisenmatrix` DB with one item that deliberately has **no `data` key**
(all other fields valid; habit, title “Raw habit no data”), matching
`src/db/schema.ts` stores/indexes. Verified via `indexedDB.open('eisenmatrix')` →
`items.getAll()` that the DB contained exactly that one row and `data` was absent.

Then:

1. Hard-loaded `/#/settings` (no habit view rendered).
2. `⌘K` → command palette listed “Raw habit no data · Habit”.
3. Clicked it. The item editor dialog rendered the **Details** tab with:
   - `Target count` spinbutton value **`1`** (habit default), `Per` select present.
   - Title “Raw habit no data”, status selects render.
4. Console after the editor opened: **0 errors, 0 warnings** (all levels).

This confirms the DB → `useLiveQuery` → command palette → `openEditor` → `structuredClone`
→ `KindFields` path for a genuinely unnormalized persisted row.

### 3. Residual risk found outside IMP-071's file scope (non-blocking for the criteria)

The editor and ICS are fixed, but list/stats views still read `data` unguarded. With the
same seeded row, navigating to `#/habits` **still blanks the app**:

```
TypeError: Cannot read properties of undefined (reading 'target')
  at HabitsView habitData useMemo -> habitStreak (domain/stats.ts `item.data.target`)
```

Evidence: `.improve/artifacts/IMP-071/verify-IMP-071-habits-crash.png`. This does not violate the
stated criteria (the editor is reachable through the command palette, which is how it was
verified), but in the ordinary user flow a no-`data` habit/goal/bill/shopping/note row
crashes its list view before a user can click it. Same unguarded reads exist in
`HabitsView.tsx:99,126`, `GoalsView.tsx:98-149`, `BillsView.tsx:24-185`,
`ShoppingView.tsx:35-89`, `NotesView.tsx:25-130`, `TodayView.tsx:19,234` and
`domain/stats.ts:49,122`. Recommended follow-up: normalize at the repository read seam
(`repository.ts`) or guard those reads; that would make IMP-071's intent hold end-to-end.

## Observations (non-blocking)

- **Nested partial payloads are still shallow-merged.** `{ data: { target: { count: 2 } } }`
  replaces the default `target` object (losing `per`), and `{ target: null }` /
  `{ metric: null }` would still throw in `KindFields`. The acceptance wording and tests
  target a missing/`null` whole `data` and top-level partial keys, which work; a deep merge
  or nested guards would be a small follow-up if corrupt nested payloads matter.
- **Editor save does not persist the normalized defaults.** `updateData` spreads
  `prev.data` (possibly `undefined` → `{}`), so editing one kind field on a raw row and
  saving persists a partial `data` object. The editor re-renders fine (it normalizes), but
  the stored row stays partial and the list-view crash above remains. Not required by the
  criteria; worth folding into the follow-up.
- `KindFields` now calls `normalizeItem` on every keystroke/render; trivial allocation,
  no behavioral concern.
- New unit test covers every kind and both whole-`data` null/missing; the committed
  editor test is habit-only and passes the in-memory fixture to `openEditor` (it writes a
  DB row but does not read it back). The browser run closes that gap for a persisted row.

## Suggested health deltas

| Dimension | Current | Suggested | Rationale |
|---|---|---|---|
| Bugs/Correctness | 4 | 4 (hold; +1 candidate once list/stats reads are guarded) | Editor + ICS crash fixed and proven; other views still throw on the same row. |
| Tests/Tooling | 4 | 4 (hold) | +12 focused regression tests, all gates green; no deep-merge/nested-null coverage. |
| Robustness | — | +1 (local) | The defensive editor seam is real and verified across all kinds; persistence still allows partial `data`. |
| Code Quality | 4 | 4 (hold) | Mechanical substitution, no semantics changed, one unrelated Prettier re-wrap. |

## Files produced

- `.improve/reports/verify-IMP-071.md` (this file)
- `.improve/artifacts/IMP-071/verify-IMP-071-habits-crash.png` (residual HabitsView crash evidence)
