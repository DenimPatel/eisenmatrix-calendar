# verify-IMP-003 — Undo of a deleted parent must restore its descendants

Reviewer verdict: **PASS** (2 non-blocking nits, 0 blocking issues).
Reviewed working tree only — nothing committed, no source file modified by this review.

Scope of the reviewed change (`git diff` + untracked):
- `M src/db/repository.ts` (+6)
- `M src/domain/itemActions.ts` (+3/−1)
- `?? src/domain/itemActions.test.ts` (new, 62 lines)
- `?? .improve/reports/impl-IMP-003.md`, `?? .improve/reports/discovered-IMP-003.md`
- `M .improve/PROGRESS.log` (+1, IMP-002 row — see Nit 2)
- `?? .kilo/` — pre-existing Kilo worktree dir (mtime 2026-10-03T22:09, before the 22:30
  source edits). Not part of this change; contains its own `.gitignore`.

---

## 1. Acceptance criteria

### AC1 — "Before deletion, `deleteItem` captures the full descendant set (same walker as IMP-002)" — MET

`src/domain/itemActions.ts:107` calls `itemRepo.collectDescendants(item.id)` *before*
`removeWithChildren` on line 108. `src/db/repository.ts:77-81`:

```ts
async collectDescendants(id: string): Promise<Item[]> {
  const ids = await collectDescendantIds(id);
  const descendants = await getDb().items.bulkGet(ids);
  return descendants.filter((item): item is Item => Boolean(item));
},
```

It calls the *same* exported IMP-002 walker (`collectDescendantIds`,
`src/db/repository.ts:16-33`) — no second traversal implementation. `bulkGet` +
`Boolean` filter drops ids with missing rows, so the restore payload can only contain
rows that actually existed at capture time.

### AC2 — "The pushed undo closure recreates the parent **and** every captured descendant via `createMany`" — MET

`src/domain/itemActions.ts:109-111`:

```ts
pushUndo(`Delete “${item.title}”`, async () => {
  await itemRepo.createMany([item, ...descendants]);
});
```

`createMany` → `items.bulkPut` (`src/db/repository.ts:49-51`). Full `Item` snapshots are
held in the closure, so `parentId` survives without a second walk at undo time. Parent is
placed first in the array; Dexie declares no foreign keys (`src/db/schema.ts:32-38`), so
insert order is irrelevant to referential integrity.

### AC3 — "After delete → undo, the item count and parent/child relationships match the pre-delete state exactly" — MET

Shipped test `src/domain/itemActions.test.ts:30-47` asserts count + `(id, parentId)` set.
My independent V1 test additionally proved **byte-exact** round-trip of the whole table
(4-level chain + rich field payload), not just count/links — see §3.

---

## 2. Gates — all green, no new failures

Baseline per `.improve/REPO_PROFILE.md` §3/§7 is green, so any failure would be a regression.

```
$ npm run typecheck   → exit 0   (tsc --noEmit, no diagnostics)
$ npm run lint        → exit 0   (eslint ., no output)
$ npm run test        → exit 0
    Test Files  12 passed (12)
         Tests  59 passed (59)
    Duration  7.17s
$ npm run build       → exit 0   (precache 18 entries, dist/sw.js generated)
```

Progression is consistent with the item history: 49 (baseline) → 54 (IMP-001 `stats.test.ts`)
→ 57 (IMP-002 `repository.test.ts`) → 59 (this item's 2 tests). No test was deleted or
weakened; `git diff --stat` shows 3 files / 9 insertions / 1 deletion.

`npm run test` also emitted the known benign warning `--localstorage-file was provided
without a valid path` (REPO_PROFILE §7) — pre-existing, not introduced.

---

## 3. Executed the item's verification method (independently, not by trusting the shipped test)

The item's method is "seed parent+child+grandchild; call `deleteItem`; invoke the pushed undo
closure from `useUiStore`; assert all three exist." I did that and went further with a
throwaway spec (`src/domain/__verify-IMP-003.test.ts`, **created and deleted by this review** —
`git status` confirms the tree is back to the implementer's file set only). 9 additional
cases, all passing:

| # | Probe | Result |
|---|---|---|
| V1 | 4-level chain (p→c→g→gg) + unrelated item; asserts count, links, **full-table JSON equality** (status, completedAt, archivedAt, tags, notes, history[], occurrences{}, dueAt/start), undo label `Delete “Parent”`, stack length 1 | PASS — full JSON round-trip identical |
| V2 | **No duplication of already-present items**: re-creates child `c` with the same id *after* delete, then undoes | PASS — count stays 3, ids unique, links `[c→p, g→c, p→null]` (bulkPut overwrites, no ConstraintError, no dup row) |
| V3 | **Undo invoked twice** via the store: 1st → `true`, 2nd → `false` | PASS — count 3 → 3, stack empty; no re-insert, no duplicate |
| V4 | Same captured closure re-run directly | PASS — count stays 3, idempotent |
| V5 | Undo stack with a *later* entry pushed | PASS — 2nd undo unwinds the **later** action (correct LIFO), not the same delete; 3rd undo → `false` |
| V6 | **Cycle safety** a↔b (parent cycle) | PASS — terminates, deletes both, undo restores exactly 3 rows with `a→b`, `b→a` |
| V7 | Self-parent `s→s` | PASS — `s` is **not** duplicated into its own restore payload (root id is pre-seeded in `visited`); count 1 after undo |
| V8 | Leaf delete (no descendants) | PASS — restores only the leaf, parent untouched |
| V9 | Non-`task` kind (goal → milestone) | PASS — descendant kind and `parentId` preserved |

`useUiStore.undo()` pops the entry *before* awaiting `run` (`src/store/useUiStore.ts:121-128`),
which is what makes V3/V5 safe: the closure can never be reached twice through the store path.
`toastWithUndo('Deleted')` also routes through `undo()`
(`src/domain/itemActions.ts:17-26`), so the toast button and ⌘Z share the same pop-once
semantics — no path can double-restore.

### Mutation test — the tests actually catch the bug

Reverted only the closure body to the pre-fix `await itemRepo.create(item);`, re-ran the
specs, then restored the file (`shasum` before `44b164010720e14e497984e3562e859f67b070df`
== after; `git diff --stat` back to `3 files changed, 9 insertions(+), 1 deletion(-)`):

```
Test Files  2 failed (2)
     Tests  9 failed | 2 passed (11)
FAIL src/domain/itemActions.test.ts > restores the parent and every descendant on undo
  - Expected  3   + Received  1        (src/domain/itemActions.test.ts:45)
FAIL src/domain/itemActions.test.ts > does not restore unrelated items that were never deleted
  - Expected [c, other, p]  + Received [other, p]   (src/domain/itemActions.test.ts:60)
```

Both shipped tests fail on the old code, so the coverage is meaningful, not tautological.

---

## 4. Interaction with IMP-002's cycle-safe helper — consistent

- One walker, two callers: `collectDescendantIds` is exported and used by both
  `removeWithChildren` (`src/db/repository.ts:86`) and the new `collectDescendants`
  (`src/db/repository.ts:78`). Capture and delete therefore agree on the descendant set
  *by construction* — the undo payload can never drift from what was deleted.
- `visited` is pre-seeded with the root id (`src/db/repository.ts:19`), which is what makes
  the root's absence from its own payload and the self-parent case correct (V7).
- IMP-002's own cycle tests are untouched and still pass
  (`src/db/repository.test.ts:71-87`).
- Naming is consistent with the existing seam (`collectDescendantIds` → ids,
  `collectDescendants` → hydrated rows), and it is a read-only method, so IMP-004 can reuse
  it for the bulk `deleteItems` cascade exactly as `discovered-IMP-003.md:5-8` notes.

---

## 5. Scope / style / hygiene audit

Clean:
- **No scope creep.** 3 source lines of production change, all inside the item's declared
  area (`src/domain/itemActions.ts` `deleteItem`, `src/db/repository.ts`).
- **No unrelated behavior change.** `deleteItems` (bulk) is untouched and still
  non-cascading — correctly left to IMP-004, not silently "fixed".
- **Conventions honored:** all Dexie access stays in `src/db/` (`getDb()` only);
  `itemActions` still goes through the repository; no `localStorage`; no new deps
  (`package.json`/`package-lock.json` untouched); no `toISOString()` date keys; no
  `newId()` misuse; no new enums or UI copy.
- **No comments added** (REPO_PROFILE §5: comments only for non-obvious intent).
- **No debug leftovers** — no `console.*`, no `.only`/`.skip`, no commented-out blocks, no
  `TODO`/`FIXME` in the diff.
- **No secrets** — no `.env*` touched, no key-like strings; `.kilo/worktrees/…` was only
  listed, never read or printed.
- Layer direction preserved (features → domain → db → types).

Nits (both non-blocking, neither affects the verdict):

**Nit 1 — Prettier deviation in the new test file (baseline noise, not a regression).**
`npx prettier --check src/domain/itemActions.test.ts` flags one spot,
`src/domain/itemActions.test.ts:14-17`, where the chained `.map().sort()` should break
across lines. **However** `npx prettier --check "src/**/*.{ts,tsx}"` also flags
`src/db/repository.test.ts`, `src/domain/stats.test.ts` and `src/pwa/ReminderRuntime.tsx`
— i.e. the pre-existing IMP-001/IMP-002 test files and untouched app code are equally
unformatted, and Prettier is *not* part of the documented gate chain
(REPO_PROFILE §2 / FEATURES.md legend: typecheck → lint → test → build). So this is a
repo-wide unenforced invariant rather than a new violation; `npm run lint` is clean. Worth
a follow-up `npm run format` sweep, not a re-review.

**Nit 2 — Backlog bookkeeping incomplete for IMP-003.** `git show --stat HEAD` (IMP-002)
shows the prior item updated `.improve/FEATURES.md` (Status → DONE + Notes),
`.improve/STATE.md` and `.improve/PROGRESS.log` together with its code. For IMP-003 only
`PROGRESS.log` is touched, and that row is the *IMP-002* entry (line 9). Still outstanding:
`.improve/FEATURES.md:58` reads `**Status:** TODO` with no `Notes:` line, and
`.improve/STATE.md:6-8,14` still says `Last commit: IMP-002`, `done=2`,
`DONE: IMP-001`. The missing PROGRESS.log row for IMP-003 is expected — the log is appended
*after* the commit with its SHA, and no commit exists yet — so only FEATURES.md/STATE.md need
updating at commit time.

---

## 6. Non-blocking observation (no action required, no regression)

`deleteItem` now awaits the capture (`itemActions.ts:107`) *outside* the
`removeWithChildren` read-write transaction (`repository.ts:83-89`), so capture+delete is two
awaits rather than one atomic unit. IMP-002's AC4 constrains only the delete, which remains
inside a single `db.transaction('rw', db.items, …)`. The `SyncAdapter` is still an
unimplemented seam (REPO_PROFILE §7) and the app is single-user local-first, so no realistic
interleaving exists. The pre-fix code was equally non-atomic (delete-then-push-undo), so this
is not a new risk — just the shape of the seam to keep in mind when sync lands.

Similarly, `ItemEditorSheet.tsx:108` passes the in-memory `draft` to `deleteItem`, so undo
restores the parent's draft state while descendants come from the persisted snapshot. That
asymmetry is pre-existing (the old closure also did `create(item)` on the draft) and is not
part of this item's intent.

---

## 7. Commands run

```bash
git status --porcelain
git diff -- src/db/repository.ts src/domain/itemActions.ts .improve/PROGRESS.log
npm run typecheck                                  # exit 0
npm run lint                                       # exit 0
npm run test                                       # exit 0 — 12 files, 59 tests
npm run build                                      # exit 0 — dist/sw.js, 18 precache entries
npx vitest run src/domain/__verify-IMP-003.test.ts src/domain/itemActions.test.ts
npx prettier --check "src/**/*.{ts,tsx}"
# temporary: reverted itemActions.ts:110 to `create(item)` to re-run the suite (mutation test),
# then restored from /tmp/itemActions.ts.bak — sha1 44b1640… verified identical
rm -f src/domain/__verify-IMP-003.test.ts           # review artifact removed
```

Files added by this review: `.improve/reports/verify-IMP-003.md` only. Nothing committed.
