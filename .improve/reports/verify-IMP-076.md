# verify-IMP-076 — `setStatus` merges into the persisted occurrence map

**Reviewer:** independent verifier (did not write the change)
**Date:** 2026-10-17
**Item:** `.improve/FEATURES.md` → `### IMP-076` (`:696-711`)
**Impl report:** `.improve/reports/impl-IMP-076.md`
**Conventions:** `.improve/REPO_PROFILE.md`, `AGENTS.md`
**Branch:** `improve/auto-20261017` (change is uncommitted; HEAD `5bc7bf1`)

## VERDICT: PASS

All four acceptance criteria are met for the specified stale-snapshot path. One residual
concurrency window survives when two `setStatus` calls overlap instead of being awaited; it is
documented below as non-blocking because AC2's verification sequence is sequential and the
prescribed fix shape (a re-read inside the action) leaves that window by construction.

---

## 1. Scope of the diff

`git diff --stat` (product files):

```
 src/domain/itemActions.test.ts | 41 +++++++++++++++++++++++++++++++++++++++++
 src/domain/itemActions.ts      | 21 +++++++++++----------
```

| File | Verdict |
|---|---|
| `src/domain/itemActions.ts` | In scope. `setStatus` only (`:187-210`). `occurrenceStateFor` (`:156`), `withoutOverrideStatus` (`:175`) and `patchItem` are unchanged. |
| `src/domain/itemActions.test.ts` | In scope. Adds `setStatus` import and one `describe` block (`:359-396`) with 2 cases. |
| `.improve/FEATURES.md`, `.improve/PROGRESS.log`, `.improve/STATE.md` | Harness bookkeeping only (status/edit + IMP-075 commit SHA + current item). No product code. Not authored as part of the fix; harmless. |

No new files in `src/` after this verification (the verifier's scratch test was removed). No
changes to `package.json`, lockfile, Dexie schema, repository, recurrence engine, reminders,
features, or styles. No unrelated action changed code path or semantics.

**Cleanliness:** no `console.*`, `debugger`, `TODO`, `FIXME`, or secrets in either changed file.
The one added comment (`itemActions.ts:193-194`) explains non-obvious intent (why the persisted
row, not the prop, is the base), which `AGENTS.md` permits and matches the existing comments in
`skipOccurrence`/`updateRecurring`.
`npx prettier --check src/domain/itemActions.ts` passes. `itemActions.test.ts` warns, but the
only deviation is the pre-existing `undoStack.map(...)` line at `:148` — `git show
HEAD:src/domain/itemActions.test.ts` warns identically, and the new block is clean.

---

## 2. Acceptance criteria

### AC1 — merge into the persisted map (re-read inside the action) — **MET**

`src/domain/itemActions.ts:195`:

```ts
const stored = (await itemRepo.get(item.id)) ?? item;
```

`occurrenceStateFor(stored, …)` (`:198`) and `withoutOverrideStatus(stored, …)` (`:199`) now
spread the persisted row's map/rule, and the patch writes `stored.occurrences` (`:201`). The
read is inside the action (not an effect), so an awaited second call always sees the first
call's persisted map. Missing rows fall back to the prop, and `patchItem` then returns without
writing, so the fallback is inert.

### AC2 — two stale-snapshot `setStatus` calls persist both keys — **MET**

Independent reproduction (fake-indexeddb, same captured `item` for both calls):

```
K1=2026-07-20, K2=2026-07-21
await setStatus(stale,'done',K1); await setStatus(stale,'done',K2)
persisted keys = ['2026-07-20','2026-07-21']
undoStack.length = 2
undo #1 -> { K1: done, K2: undefined }
undo #2 -> {}
```

The implementer's test (`itemActions.test.ts:363-384`) asserts the same and adds the two-undo
LIFO restoration. Reverse toggling from one stale snapshot (`done K1`, then `todo K1`) also
lands at `todo` with `completedAt: null` and only `K1` present; two undos return to `done` and
then to `{}`.

### AC3 — habit streak derives from persisted post-toggle state and shares one undo entry — **MET**

`toggleDone` (`:212-234`) is unchanged: it awaits `setStatus`, then re-reads (`:223`), computes
`habitStreak(persisted)` and patches `data` with `trackUndo: false` (`:232`). Independent
two-toggle reproduction with `yesterday` + `today` from one stale snapshot:

```
after toggle(yesterday): streak {current:1,best:1,lastAt:yesterday}
after toggle(today):     streak {current:2,best:2,lastAt:today}
undoStack.length = 2 (one per toggle, not two per toggle)
undo #1 -> today todo, streak {1,1,yesterday}
undo #2 -> {}, streak {0,0,null}
```

The existing toggle tests (`itemActions.test.ts:304-356`) still cover the single-entry undo and
stale-prop streak case; all 375 tests pass.

### AC4 — a genuine no-op writes nothing and pushes no undo — **MET**

Occurrence branch (`:196-202`): `occurrenceStateFor` returns `null` when the resolved status and
`completedAt` already match (`:167`) and `withoutOverrideStatus` leaves the rule identical, so
`setStatus` returns before `patchItem`. Independent case with a stale empty map against a
persisted `done` occurrence: row deep-equals the pre-call row (including `updatedAt`), undo
depth unchanged.

Non-occurrence branch (`:207-209`): compares against `stored.status`/`stored.completedAt` and
returns before `patchItem`. Independent case: a task already `done` with `completedAt: 111`,
called with a prop claiming `todo`; result keeps `completedAt: 111`, unchanged `updatedAt` and
`history`, no undo entry. `completedAt` for `done` now preserves an existing timestamp
(`stored.completedAt ?? timestamp`) instead of refreshing it; that is a deliberate behavior
change required by the "same status/same completedAt" no-op definition and is user-visible only
as "re-marking done no longer rewrites the completion time". No other action is affected, and
the impl report discloses it.

---

## 3. Race analysis

- **Stale `history`:** not possible on the second write. `patchItem` re-reads the row
  (`itemActions.ts:91`) and appends to `existing.history`; two sequential occurrence writes keep
  both undo snapshots intact.
- **Stale `completedAt`:** not used from the caller. The occurrence branch preserves the
  persisted occurrence's `completedAt` (`:166`), and the non-occurrence branch reads
  `stored.completedAt` (`:207`).
- **Residual, non-blocking (concurrency):** if two `setStatus` calls are started without
  awaiting the first (the UI's `void toggleDone(...)` handlers, a double-fired `markToday`), both
  can `itemRepo.get` before either writes and each writes a whole map built from that pre-write
  read. My independent test `Promise.all([setStatus(stale,'done',K1),
  setStatus(stale,'done',K2)])` lost `K1` (persisted keys `[K2]`). The same race exists between
  the read at `:195` and `patchItem`'s `itemRepo.update`. This is the remaining TOCTOU window;
  the deterministic stale-prop bug (both writes rebuilding from the same captured map) is fixed.
  AC2's prescribed sequence is awaited, so this does not fail the item, but a future hardening
  could merge inside a Dexie read-modify-write transaction in `itemRepo` (or serialize writes
  per item id) rather than computing the map in the action.

---

## 4. Gates

```
npm run typecheck  -> exit 0 (tsc --noEmit, no diagnostics)
npm run lint       -> exit 0 (eslint ., no output)
npm run test       -> 33 files / 375 tests passed
npm run build      -> tsc --noEmit && vite build; dist/sw.js generated; precache 18 entries
```

All four gates pass on the working tree. The independent reproduction suite (7 tests) was run
separately: 6 passed, 1 failed only for the intentionally out-of-scope concurrent case above.
The scratch file was deleted; `git status` shows only the intended five modified/one new file.

## 5. Browser verification

Not run. A meaningful Playwright check of this item requires two occurrence toggles from the same
render snapshot happening close enough to overlap; that is timing-dependent and not reliably
reproducible. The Habits UI only exposes today's toggle (heatmap cells are `role="img"` divs,
not buttons), so driving two arbitrary occurrences would require seeding IndexedDB and clicking
calendar cards, which still would not deterministically produce the race. The unit reproduction
above exercises the exact action path with a real fake-indexeddb store, and the app has no UI
code changes, so the preview run was judged impractical and skipped. No console/runtime path was
modified.

## 6. Health deltas (suggested)

| Dimension | Delta | Why |
|---|---|---|
| Correctness | **+2** | Deterministic stale-snapshot map loss fixed; no-op writes eliminated. |
| Concurrency | **+1** | Re-read shrinks the window; overlapping fire-and-forget calls can still drop a key (residual, non-blocking). |
| Test coverage | **+1** | Adds stale-snapshot merge + occurrence no-op; no non-occurrence no-op test (covered independently here). |
| Maintainability | **0** | Small, local change with an intent comment; matches existing re-read pattern. |
| Performance | **0** | One extra IndexedDB `get` per status write; negligible, and no-op writes now save a write. |
| Risk | **low** | `completedAt` preservation on redundant `done` is the only behavior change; disclosed and verified. |
