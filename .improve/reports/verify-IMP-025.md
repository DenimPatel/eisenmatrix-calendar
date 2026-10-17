# verify-IMP-025 — direct tests for the `itemActions` write path

**Reviewer:** independent verifier (did not write the change)
**Date:** 2026-10-17
**Item:** `.improve/FEATURES.md` → `### IMP-025` (`:729-745`)
**Impl report:** `.improve/reports/impl-IMP-025.md`
**Conventions:** `.improve/REPO_PROFILE.md`, `AGENTS.md`
**Branch:** `improve/auto-20261017` (change uncommitted; HEAD `ef0775c`)

## VERDICT: PASS

All five acceptance criteria are met. The change is test-only: it adds three `it` cases to
the existing `src/domain/itemActions.test.ts` (AC1 and AC2) and leaves the already-present
AC3/AC4 coverage intact. No production code was touched, and the suite is green and
deterministic across repeated runs.

---

## 1. Scope of the diff

`git diff --numstat`:

```
1   1   .improve/FEATURES.md
82  2   src/domain/itemActions.test.ts
```

| File | Verdict |
|---|---|
| `src/domain/itemActions.test.ts` | In scope. +82/−2: one new `saveItem` accumulation test, one plain-`toggleDone` test, one occurrence-`toggleDone` test, plus a Prettier-only collapse of one pre-existing `expect`. |
| `.improve/FEATURES.md` | Harness bookkeeping only: status `TODO` → `IN-PROGRESS`. No product impact. |
| `.improve/reports/impl-IMP-025.md` | New impl report (untracked), as expected. |

The spec's "new `src/domain/itemActions.test.ts`" is stale: the file already existed at
HEAD (873 lines, 38 tests) from IMP-023/050/056/069/076. Extending it is the correct,
lower-churn choice; no unrelated production code, schema, dependency, or styling changed.
No scope creep in product code.

**Cleanliness:** the diff has no `console.*`, `debugger`, `TODO`, `FIXME`, `.only`,
`.skip`, URLs, credentials, or secrets. `git diff --check` is clean. Prettier passes on
the test file (the FEATURES.md warning is pre-existing for that large doc). No production
changes means there is nothing new to break at runtime.

---

## 2. Acceptance criteria

### AC1 — `saveItem` create + edit history accumulation and undo closure — **MET**

Existing create-path tests:
- `:120-136` — `saveItem(created)` pushes exactly one `Create “New task”` entry; undo
  removes the row and leaves the prior stack entry intact.
- `:138-145` — `{ silent: true }` keeps the create undo entry and suppresses only the toast.
- `:147-152` — saving an existing row pushes `Edit “Renamed”`, not a second create entry.

New accumulation test (`:154-181`):
- write 1 (`saveItem(created)`) + write 2 (title/notes) + write 3 (title).
- asserts the exact persisted history triples, in order:
  `['Title','Draft','First']`, `['Notes','base','one']`, `['Title','First','Second']` —
  so one entry is added per changed field and no entry is duplicated across edits.
- asserts the undo stack depth is exactly 3 (create + one per edit).
- undo 1 reloads the row and checks the intermediate title `First`; undo 2 checks title
  `Draft`, notes `base`, and `history: []` (the pre-edit snapshot, not a partially unwound
  history); undo 3 removes the created row.

This is non-vacuous: it pins field names, old/new values, stack depth, and the newest-first
restore order against the real fake-indexeddb repository (`saveItem`,
`src/domain/itemActions.ts:77-96`). A missing history append or a wrong undo snapshot fails.

### AC2 — `toggleDone` for a plain item and an occurrence — **MET**

Plain item (`:331-359`):
- `toggleDone(before)` sets `status: 'done'`, a positive `completedAt`, and exactly
  `['Status','Completed At']` history; one undo entry.
- `toggleDone(done)` returns `status: 'todo'`, `completedAt: null`, history length 4, two
  undo entries.
- undo 1 restores `done`; undo 2 deep-equals the pre-toggle row (`toEqual(before)`).
- Exercises the non-occurrence branch of `setStatus` (`itemActions.ts:207-209`) and its
  `patchItem` undo closure.

Occurrence (`:361-382`, with the shared `weeklyTask` fixture at `:56-79`):
- `toggleDone(before, OCC)` writes `occurrences[OCC] = { status: 'done', ... }` with a
  positive `completedAt`, leaves `occurrences[OTHER]` undefined, and leaves the series-level
  `status` at `todo`.
- `expandOccurrences` resolves the targeted occurrence to `done` and the sibling `OTHER` to
  exactly what it displayed before (`displayed(...)`, including title/notes/start/end/allDay/
  status), so the write does not leak.
- undo deep-equals the pre-toggle row.
- Exercises `resolveOccurrenceStatus` + the occurrence branch of `setStatus`
  (`itemActions.ts:196-205`), including the persisted-map merge.

### AC3 — `deleteItem` / `deleteItems` descendant restoration — **MET**

Already present at HEAD and verified meaningful:
- `:184-202` — `deleteItem(parent)` removes parent + child + grandchild; undo restores the
  same count and the exact `[id, parentId]` relationship set.
- `:204-216` — undo does not resurrect unrelated rows.
- `:219-230` — `deleteItems([parent])` removes every transitive descendant.
- `:232-249` — undo restores the selection + descendants and leaves a sibling untouched.
- `:251-267` — a selection containing both parent and child is de-duplicated and restored
  once. This exercises the `ids` set logic in `deleteItems` (`itemActions.ts:128-143`).

### AC4 — `updateRecurring` for `occurrence`, `future`, `all` — **MET**

Already present at HEAD:
- `occurrence` (`:479-681`): override-only write, series fields deep-equal via `seriesOf`,
  status routed to `occurrences` (not the override), legacy override status erased, draft
  rule ignored, no-op detection, undo restores the series, and every other occurrence
  displays unchanged values.
- `future` (`:683-774`): split anchors the tail on the split day, head `until` is the day
  before, head+tail occurrence keys union to the original 10, count preserved, an explicitly
  changed start is applied, a patch repeating the stored dates does not drag the tail back,
  and `head`/`tail` remain distinct rows.
- `all` (`:669-680`): the full patch lands on the series (`title`, `start`, `urgency`) and
  no overrides are created.

These tests exercise the three branches of `updateRecurring`
(`src/domain/itemActions.ts:281-348`) through real repository writes. The `future` undo gap
listed in REPO_PROFILE is pre-existing and outside IMP-025's ACs; the `occurrence` branch
does have an undo test (`:657-667`).

### AC5 — all pass via `npm run test` — **MET**

See gates below: 33 files / 378 tests passed.

---

## 3. Test quality assessment

- **Not vacuous:** every new test asserts exact persisted fields, ordered history entries,
  undo-stack depth, and either targeted-field or whole-row restoration. The occurrence test
  additionally asserts the sibling occurrence and the series row are unchanged.
- **Real storage:** `beforeEach` (`:110-114`) clears `db.items`, undo and toasts; the tests
  use the actual `itemRepo`/`patchItem`/`saveItem`/`deleteItem(s)`/`updateRecurring` code on
  fake-indexeddb, not mocks. `afterAll` deletes the DB.
- **Isolation:** fixed fixture dates (`2026-07-13`, `2026-07-20`, `2026-07-27`) and fixed
  ids; the habit tests use today-relative keys but are unaffected by this diff. No shared
  mutable state leaks between cases in the added tests.
- **Count arithmetic:** HEAD file had 38 tests; the diff adds exactly 3 `it` blocks → 41,
  matching `npx vitest run src/domain/itemActions.test.ts` (41 passed) and the suite
  baseline of 375 → 378. No test was removed.
- **Minor nuance (non-blocking):** the first undo in the plain-`toggleDone` test asserts only
  `status === 'done'`, while the second undo asserts full row equality. The closure is still
  meaningfully covered; a deeper first-undo assertion would be marginally stronger.

---

## 4. Gates

Run on the working tree (unstaged diff):

```
npm run typecheck  -> exit 0 (tsc --noEmit, no diagnostics)
npm run lint       -> exit 0 (eslint ., no output)
npm run test       -> 33 files / 378 tests passed
```

Additional determinism checks:

```
npx vitest run src/domain/itemActions.test.ts   -> 41/41 passed
 (repeated 3x: 41/41 each; durations 1.22-1.23s)
npm run test -- --reporter=dot (repeated 2x)    -> 33 files / 378 tests passed each
```

No test is skipped, todo, `.only`, or retried. No flake observed across three full-suite
runs and three targeted runs. No unexpected console warning beyond the known benign
`--localstorage-file` note.

---

## 5. Independent confirmation notes

I traced each AC to its production path and then ran the exact tests individually via
`--reporter=verbose`: `saveItem` cumulative history/undo, plain `toggleDone`,
occurrence `toggleDone`, `deleteItem`/`deleteItems` restoration, and all three
`updateRecurring` scopes pass. The assertions match the source semantics:

- `saveItem` edit branch appends `buildHistory(existing, patch)` and pushes
  `itemRepo.create(existing)` (`itemActions.ts:81-93`), which is what the new test verifies.
- `toggleDone` → `setStatus` → `patchItem` writes `status`/`completedAt` or the merged
  `occurrences` map (`itemActions.ts:187-234`); both tests pin exactly those writes.
- `deleteItem`/`deleteItems` snapshot `collectDescendants` and restore via `createMany`
  (`itemActions.ts:119-143`); the relationship assertions cover transitive restoration.
- `updateRecurring` occurrence/future/all branches (`itemActions.ts:287-346`) are covered
  as described in AC4.

The impl report's claims (file already covered AC3/AC4, +3 tests, no production changes,
commands green) are accurate. The only process nit is that `.improve/FEATURES.md` was moved
to `IN-PROGRESS`, not marked `DONE` with a completion note; that is bookkeeping for the
coordinator, not an acceptance criterion.

---

## 6. Health deltas (suggested)

| Dimension | Current | Suggested | Rationale |
|---|---|---|---|
| Tests/Tooling | 4 | 4.5 (+0.5) | IMP-025 closes the `itemActions` write-path gap with direct, assertion-heavy tests for all five mutations; IMP-026 (eisenhower) remains the other named gap, so not a full +1. |
| Bugs/Correctness | 4 | 4 (+0) | Test-only change; no behavior or regression surface modified. |
| Maintainability | 3 | 3 (+0.25) | One consolidated test file now documents the write-path contracts (history ordering, undo snapshots, occurrence isolation), making the recurrence/status seams harder to regress. |
| Risk | — | low | No production code, no schema/dependency changes, deterministic suite. |
