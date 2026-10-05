# verify-IMP-050 — Habit completion records undo/history and uses fresh state

**Reviewer:** independent verifier (did not write the change)
**Date:** 2026-10-05
**Item:** `.improve/FEATURES.md` → `### IMP-050`
**Impl report:** `.improve/reports/impl-IMP-050.md`
**Conventions:** `.improve/REPO_PROFILE.md`, `AGENTS.md`
**Branch / commit:** `improve/auto-20261003` @ `e6d2dc4` (change is **uncommitted**, working tree)

## VERDICT: PASS (2 non-blocking observations)

---

## 1. Scope of the diff

`git diff --stat`:

```
 .improve/FEATURES.md           | 21 ++++++++++-
 .improve/PROGRESS.log          |  1 +
 src/domain/itemActions.test.ts | 84 +++++++++++++++++++++++++++++++++++++++++-
 src/domain/itemActions.ts      | 41 +++++++++++----------
 4 files changed, 124 insertions(+), 23 deletions(-)
```

| File | Verdict |
|---|---|
| `src/domain/itemActions.ts` | In scope. `patchItem` gains the `trackUndo` option (`:90`, `:99-103`); `toggleDone` rewritten (`:173-193`). |
| `src/domain/itemActions.test.ts` | In scope. 3 new cases + 3 local helpers (`habit`, `dayOffset`, `storedHabit`). |
| `.improve/FEATURES.md` | **Unrelated to IMP-050's source scope** — adds a *new* backlog item `IMP-068` (boot smoke-test unhandled rejection, discovered during IMP-015 verification) and bumps "63 items" → "64 items". Harness bookkeeping, no product code. |
| `.improve/PROGRESS.log` | **Unrelated** — appends the `IMP-015 \| done (attempt 2) \| e6d2dc4` line left over from the previous item's verification retry. No `IMP-050` line (consistent with "not yet committed"). |

No new files in `src/`. No changes to `package.json`, lockfile, Dexie schema, migrations, labels,
styles, or any feature component. `git status` shows no stray files created by the change
(`.kilo/` is agent tooling, `discovered-IMP-050.md` / `impl-IMP-050.md` are the item's reports).

**Cleanliness checks (all clean):**

- `grep -n "console\.(log|debug|warn|error)|TODO|FIXME|XXX|debugger" src/domain/itemActions.ts src/domain/itemActions.test.ts` → no matches. No debug leftovers.
- No secrets/credentials introduced; no `.env*` touched.
- `npx prettier --check src/domain/itemActions.ts` → "All matched files use Prettier code style!".
  `itemActions.test.ts` reports one deviation, but it is **pre-existing**: it is in the
  `relationships()` helper (lines 38-42), untouched by this diff. `npx prettier --check` on
  `git show HEAD:src/domain/itemActions.test.ts` warns identically → confirmed pre-existing
  (and tracked as backlog IMP-066). `npm run lint` does not run Prettier and is clean.
- Comments added in `toggleDone` are 3 lines explaining *non-obvious intent* (why the re-read
  and why `trackUndo: false`), which AGENTS.md explicitly permits. Not comment noise.

---

## 2. Acceptance criteria

### AC1 — "After `setStatus`, `toggleDone` re-reads the item (`itemRepo.get`) and computes `habitStreak` from the persisted post-toggle occurrence state" — **MET**

`src/domain/itemActions.ts:182-184`:

```ts
const persisted = await itemRepo.get(item.id);
if (persisted?.kind !== 'habit') return;
const streak = habitStreak(persisted);
```

- The re-read happens **after** `await setStatus(...)` (`:176`), so it observes the persisted
  occurrence write.
- The stale `item` prop is no longer used for the streak at all.
- Guarded against a missing row (`persisted?.kind !== 'habit'`), so `toggleDone` cannot throw
  if the row vanished (verified: see §4, "missing row is a no-op").

**Independent proof that the persisted state (not the prop) drives the streak:**
the new test `computes the streak from the persisted occurrences, not the stale prop`
(`itemActions.test.ts:176-192`) passes a `stale` prop whose `occurrences` map is `{}` while two
prior days are persisted `done`, and asserts the persisted result `{current: 2, best: 2,
lastAt: <yesterday>}`. I reproduced this behaviour in isolation and in the browser.

### AC2 — "The streak update is persisted through `patchItem` (records history and pushes an undo entry), not a raw `itemRepo.update`" — **MET, with a documented, deliberate interpretation**

`src/domain/itemActions.ts:188-192`:

```ts
await patchItem(
  item.id,
  { data: { ...persisted.data, streak } },
  { silent: true, trackUndo: false },
);
```

- The raw `itemRepo.update(item.id, { data: … })` call **is gone** from the habit path
  (verified: `grep -n "itemRepo.update" src/domain/itemActions.ts` → no hit in `toggleDone`;
  the only `itemRepo.*` direct use left in the module is `create` in `updateRecurring`).
- **History is recorded**: `patchItem` still runs `buildHistory` (`trackHistory` defaults to
  on), so a `Data` entry is appended. Browser-verified persisted value after one toggle:

  ```json
  { "field": "Data",
    "oldValue": "{\"target\":{\"count\":1,\"per\":\"day\"},\"streak\":{\"current\":0,\"best\":0,\"lastAt\":null}}",
    "newValue": "{\"target\":{\"count\":1,\"per\":\"day\"},\"streak\":{\"current\":1,\"best\":1,\"lastAt\":\"2026-10-04\"}}" }
  ```

- **`trackUndo: false` is the correct reading of AC2, not a dodge.** AC2's parenthetical says
  "records history and pushes an undo entry"; AC3 requires "toggle, then undo: **both** the
  occurrence status and `data.streak` return to their pre-toggle values". Those two only hold
  together if the streak write contributes history but *shares* the occurrence write's undo
  entry. A literal second entry would make LIFO pop it first, restoring the intermediate
  snapshot (occurrence `done`, streak stale) and breaking AC3. I confirmed this empirically:
  mutation M3 below produces exactly `expected 'done' to be 'todo'` and
  `toHaveLength(1) but got 2`.
  - `setStatus` → `patchItem(..., { silent: true })` (no `trackUndo`) reads `existing` **before**
    its write (`itemActions.ts:92`) and pushes `pushUndo(…, async () => itemRepo.create(existing))`,
    so that snapshot is the **whole pre-toggle row**, including pre-toggle `occurrences` and
    pre-toggle `data.streak`. One undo therefore restores both fields atomically.
  - The implementer documented this reasoning in `impl-IMP-050.md` §"Why `trackUndo: false`"
    and §"Uncertainties". I agree with it and with the note that AC2 is satisfied at the toggle
    level.

### AC3 — "Toggle a habit, then undo: both the occurrence status and `data.streak` return to their pre-toggle values" — **MET**

- Unit: `records a streak history entry and restores status and streak on undo`
  (`itemActions.test.ts:143-163`) asserts after **one** `undo()`: occurrence back to `todo`,
  `data.streak` equal to the pre-toggle snapshot, and the whole persisted row
  `toEqual(before)` (which also re-asserts `history` is back to `[]`).
- Browser (real IndexedDB, preview build): after one Cmd+Z the row was
  `{ occurrences: {}, streak: {current:0,best:0,lastAt:null}, history: [] }` — byte-identical to
  the pre-toggle snapshot. See §5.

### Item note — "Keep the write silent (no duplicate toast)" — **MET**
`silent: true` on the streak write, and `setStatus` is already `silent: true`. Measured toast
count after a habit toggle: **0** (see §4). Same as before the change — no double toast, no new
toast.

---

## 3. Semantic review (the four required properties)

### (a) Streak is computed from the PERSISTED post-toggle state (re-read), not a stale prop — CONFIRMED
Code + unit test + mutation M1 (below) + browser. `habitStreak` itself is unchanged
(`src/domain/stats.ts:47`), so no risk was introduced in the streak maths.

### (b) Exactly ONE undo entry covering BOTH the occurrence status and `data.streak`; undo restores both; a second undo does not double-apply — CONFIRMED
- `undoStack.length === 1` after a habit toggle (asserted by the new test and by my scratch test).
- Undo #1 restores the entire pre-toggle row (status + streak + history).
- Undo #2 returns `false` and performs no write. `useUiStore.undo` (`src/store/useUiStore.ts:133-140`)
  returns `false` on an empty stack before touching anything, and `pushUndo` caps the stack at 24
  (`:130`). My scratch test asserted two consecutive extra `undo()` calls both return `false` and
  the row is unchanged.
- The single entry's label is `Change "Read 20 pages"` (`patchItem` default `undoLabel`,
  `itemActions.ts:100`) — the undo stack label shown in the UI is sensible.

### (c) No double toast, no lost update, non-habit behaviour unchanged — CONFIRMED
Scratch tests I wrote (all green, then removed):
1. Habit toggle → `toasts === []`, `undoStack.length === 1`, `history` fields `=== ['Data']`
   (i.e. exactly one history entry; `buildHistory` skips `occurrences`, `itemActions.ts:32`).
2. **Non-habit task** `toggleDone(task)` → `status: 'done'`, `undoStack.length === 1`,
   `toasts === []`, and one undo restores the pre-toggle row exactly. Identical to pre-change
   behaviour (`toggleDone` now just `return`s early for non-habits at `:178`, replacing the old
   `if (item.kind === 'habit') { … }` block — same control flow, same write count).
3. **Toggle-off** path (occurrence already `done`) → streak resets to `{0,0,null}`, still one
   undo entry, one undo restores the row including the occurrence's `done` state.
4. **Non-recurring habit** (`recurrence === undefined`) → `setStatus` takes the `item.status`
   branch and the streak is still written from the persisted row (`{current:1,best:1,lastAt:today}`);
   one undo restores it.
5. **Missing row** (`toggleDone` on a never-persisted item) → resolves without throwing; no undo
   entry and no write (because `patchItem` returns `undefined` before `pushUndo`, `:92-93`).

Browser cross-check of ordinary task completion (no regression): created "Regression check task",
toggled it done (`1/2 done`, 50 %, button flipped to "Mark as not done"), one Cmd+Z → `0/2 done`,
0 %, item back to not-done. Screenshot `06-task-toggle-undo-regression.png`.

No lost update introduced: the streak patch goes through `patchItem`, which re-reads `existing`
internally (`repository.mergeItem` does a shallow merge and always bumps `updatedAt`), i.e. it is
strictly fresher than the old raw `itemRepo.update` on the caller's `item.data`.

### (d) `trackUndo` does not break any other `patchItem` caller — CONFIRMED
- `trackUndo` is **optional** and defaults to the old behaviour via `options?.trackUndo !== false`
  (`:99`). Every existing caller passes only `silent` / `trackHistory` / `undoLabel`
  (`archiveItem:135`, `restoreItem:140`, `setStatus:163,170`, `setPriority:200`,
  `updateOccurrence:217`, `skipOccurrence:224`, `updateRecurring:254,259`) → all still push undo.
- Whole suite green (173 tests), including `deleteItem`/`deleteItems` undo tests, the
  `useKeyboardShortcuts` undo tests, and the Notes/Settings suites.
- Note: no test in the repo asserts undo-entry *counts* for those other callers (they only reset
  `undoStack`), so the guarantee rests on the default-parameter argument + green suite. The new
  IMP-050 tests do pin the count (1) for the habit toggle, which is the regression that matters.

---

## 4. Commands (all green)

```
$ npm run typecheck && npm run lint && npm run test && npm run build
tsc --noEmit                                  → no diagnostics
eslint .                                      → no output
vitest run                                    → Test Files 23 passed (23), Tests 173 passed (173)
vite build (PWA injectManifest)               → dist/sw.js generated, precache 18 entries (603.95 KiB)
```

Baseline is 170 tests → **+3 = 173**, i.e. exactly the three new cases and nothing else
unexpected. Re-ran the full chain a second time at the end (after removing my scratch file) —
identical results.

---

## 5. MUTATION-CHECK (each mutation reverted separately; file restored from a checksum-verified backup)

Backup taken before mutating: `md5 73a7ec8e4628d6fc7ecdc723eae20968`; after each mutation the file
was restored from it and `git diff --stat` + `md5` re-verified identical to the reviewed change.

| # | Mutation | Result — new tests that FAIL |
|---|---|---|
| **M1** | Revert the re-read: `const streak = habitStreak(item)` (feed the stale prop) | **2 of 3 new tests fail** — `records a streak history entry and restores status and streak on undo` (`expected [] to deeply equal [ 'Data' ]` — with a stale prop the streak is unchanged so `buildHistory` records nothing) and `computes the streak from the persisted occurrences, not the stale prop` (`expected {current:0,…} to deeply equal {current:2,…}`). Plus 4 of my scratch tests. |
| **M2** | Revert `patchItem`: streak written with a raw `itemRepo.update(item.id, { data: … })` (pre-change behaviour) | **1 of 3 new tests fails** — `records a streak history entry and restores status and streak on undo` (`streakEntry` is `undefined`, so `expect(undefined).toContain(...)` throws). This is the only test that pins AC2's "through `patchItem`" requirement; the other two pass because the old code also produced one undo entry from `setStatus`. Plus 1 scratch test. |
| **M3** | Revert `trackUndo`: remove the option from `patchItem` and drop `trackUndo: false` from the call, so the streak write pushes a second undo entry | **3 of 3 new tests fail** — `pushes a single undo entry so one undo reverts the whole toggle` (`toHaveLength(1)` → got 2), `records a streak history entry and restores status and streak on undo` (`expected 'done' to be 'todo'` — one undo leaves the toggle applied), and `records…`/`pushes a single…` row mismatch. Plus 3 scratch tests. |

Net: **every one of the three new tests is killed by at least one mutation, and the three
mutations map 1:1 onto the three acceptance criteria.** M2 killing only one new test is the one
slight weakness in the new test set (see Observations).

Additional scratch suite (written by me, run green, then deleted — `src/domain/zzscratchIMP050.test.ts`,
6/6 passed): zero toasts on habit toggle, single undo entry + `['Data']` history, double-undo
returns `false` twice with no write, toggle-off single-entry undo, non-habit task unchanged,
non-recurring habit, missing-row no-op. These were used for M1/M2/M3 too (they failed under every
mutation).

---

## 6. VISUAL (Playwright, production preview build)

```
npm run build && npx vite preview --port 4173     → HTTP 200 on
http://localhost:4173/eisenmatrix-calendar/#/habits
```

Flow: Habits → "New habit" → title "Read 20 pages" → Save → click the ○ "Complete today" button →
Cmd+Z.

| Step | Persisted IndexedDB row (read directly in-page) | UI | Artifact |
|---|---|---|---|
| Before toggle | `occurrences: {}`, `streak {0,0,null}`, `history: []` | `0 day streak` · `Best 0` · `○` | `01-before-toggle.png` |
| After toggle | `occurrences: {"2026-10-04": {status:"done", completedAt:1791163208467}}`, `streak {current:1,best:1,lastAt:"2026-10-04"}`, `history: [ {field:"Data", oldValue:…current:0…, newValue:…current:1…} ]`, **toasts: none** | `1 day streak` · `Best 1` · `✓` (button relabelled "Undo today") | `02-after-toggle-streak-1.png` |
| After 1× Cmd+Z | `occurrences: {}`, `streak {0,0,null}`, `history: []` — identical to the pre-toggle row | `0 day streak` · `Best 0` · `○`, and an **"Undone"** toast (bottom-right, info tone, `Dismiss notification`) | `03-after-cmdz-undone.png`, `04-cmdz-undone-toast.png`, `05-cmdz-streak-reverted-with-undo-toast.png` |
| Non-habit regression | task `status: 'done'` after toggle, then undone by one Cmd+Z | `1/2 done` 50 % → `0/2 done` 0 % | `06-task-toggle-undo-regression.png` |

Screenshots live in `.improve/artifacts/IMP-050/`. (The Playwright MCP writes to
`.playwright-mcp/-<path>.png`; I copied them to the canonical directory with clean names, matching
how IMP-012/013/015 artifacts are stored. `.playwright-mcp/` left as-is, consistent with prior items.)

**Console:** `playwright_browser_console_messages` returned an **empty list** after the whole
session (initial load, habit creation, 4× toggle/undo cycles, navigation to `#/today`, task create
+ toggle + undo) → **zero new console errors or warnings**.

Note on the toast: toggling a habit does **not** itself raise an "Undo" action toast — that is
pre-existing app behaviour (`toggleDone` has never toasted; `toastWithUndo` is only used by
`deleteItem`/`deleteItems`, `itemActions.ts:114,131`). The undo affordance on this path is the
Cmd+Z shortcut, which raises the "Undone" confirmation toast in
`src/hooks/useKeyboardShortcuts.ts:37` — captured in the a11y snapshot and in
`05-cmdz-streak-reverted-with-undo-toast.png`. Zero toasts on toggle is exactly what the item's
"keep the write silent (no duplicate toast)" note asks for, and it is unchanged from before.

---

## 7. Observations (non-blocking)

1. **Only 1 of 3 new tests pins AC2.** M2 (reverting to the raw `itemRepo.update`) is caught by a
   single test, and only indirectly — via `streakEntry` being `undefined`, which surfaces as a
   `toContain` TypeError rather than a crisp assertion. A dedicated
   "persists the streak through `patchItem`" case (e.g. asserting
   `history.map(e => e.field)` equals `['Data']`, which is what AC2's "records history" really
   means) would fail loudly under M2. The current first test does assert the `Data` entry's
   `oldValue`/`newValue`, so the intent is captured; this is a robustness nit, not a gap.
2. **`buildHistory` records one top-level `Data` entry, not a `Streak` entry.** `item.data.streak`
   is a nested field, and `buildHistory` (`itemActions.ts:28-50`) only walks top-level patch keys,
   so the recorded `oldValue`/`newValue` carry the *whole* `data` JSON (target + streak). Faithful
   to "records a history entry", but a per-field `Streak` entry would be more precise in the History
   tab. Nested-field history is correctly called out as out-of-scope in `impl-IMP-050.md`.
   Related: `item.data.streak` has no reader in the app (both habit views call `habitStreak`
   live), so the persisted streak is currently write-only — that is pre-existing (D1 in
   `.improve/reports/discovered-IMP-050.md`), not introduced here.
3. **`setStatus` still writes the caller's whole `occurrences` map** (`itemActions.ts:155-163`), so
   a genuinely concurrent write to another occurrence can still be clobbered by a stale prop. The
   new code reads *fresh* for the streak but does not fix the occurrence write. Correctly scoped
   out by IMP-050 (only the streak had to be derived from fresh state) and documented as D2.
4. **Bookkeeping drift.** `.improve/FEATURES.md` adds unrelated backlog item `IMP-068` and
   `.improve/PROGRESS.log` adds the leftover `IMP-015 (attempt 2)` line; `IMP-050` is still
   `Status: TODO` and has no `PROGRESS.log` line, which is expected pre-commit. Nothing to fix for
   this item, but the two unrelated doc edits should not be attributed to IMP-050.

No scope creep in product code, no unrelated source changes, no debug leftovers, no secrets.

---

## 8. Commands run (reproduction)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
npx vitest run src/domain/itemActions.test.ts            # 3 new cases
npx prettier --check src/domain/itemActions.ts           # clean
npx prettier --check <(git show HEAD:...)                # deviation is pre-existing
npm run build && npx vite preview --port 4173            # Playwright session
```

Artifacts: `.improve/artifacts/IMP-050/01..06*.png`