# verify-IMP-004 — Cascade delete in bulk `deleteItems`

Independent review of the uncommitted change for backlog item IMP-004
(`.improve/FEATURES.md:73-87`, **Status: TODO**). The implementer's
`.improve/reports/impl-IMP-004.md` claims DONE; the orchestrator reverted that, and this
verdict is based on the diff and executed evidence only.

Reviewer artifacts: scratch test `src/domain/__verify_scratch_imp004.test.ts` (8 cases,
created and **deleted** during this review; final tree confirmed clean) and a mutation-test
backup at `/tmp/ia.orig.ts`.

---

## 0. Change under review

`git diff --stat` (working tree vs `96c5936`):

```
 .improve/PROGRESS.log          |  1 +
 src/domain/itemActions.test.ts | 53 +++++++++++++++++++++++++++++++++++++++++-
 src/domain/itemActions.ts      | 13 +++++++++--
 3 files changed, 64 insertions(+), 3 deletions(-)
```

Untracked: `.improve/reports/impl-IMP-004.md`, `.improve/reports/discovered-IMP-004.md`,
`.kilo/` (harness tooling, contains its own `.gitignore`, not part of the fix).

The functional change is `src/domain/itemActions.ts:115-130`:

```ts
export async function deleteItems(items: Item[]): Promise<void> {
  const deleted = [...items];
  const ids = new Set(items.map((i) => i.id));
  for (const item of items) {
    for (const descendant of await itemRepo.collectDescendants(item.id)) {
      if (ids.has(descendant.id)) continue;
      ids.add(descendant.id);
      deleted.push(descendant);
    }
  }
  await itemRepo.removeMany([...ids]);
  pushUndo(`Delete ${items.length} items`, async () => {
    await itemRepo.createMany(deleted);
  });
  toastWithUndo(`Deleted ${items.length} items`);
}
```

No repository, schema, type, or feature-file change. `ListView.tsx` needs none: its bulk
action is `await deleteItems(selectedItems); setSelection(new Set())`
(`src/features/list/ListView.tsx:92-95`), so fixing the action fixes the reported bug.

---

## 1. Acceptance criteria

### AC1 — "`deleteItems` deletes each selected item and all its transitive descendants" — **MET**

Shipped test `deletes the selection and every transitive descendant`
(`src/domain/itemActions.test.ts:65-75`) covers one root. My independent case **A** (scratch,
deleted) covered two roots with independent descendant chains, one 4 levels deep:

fixture `hold`(root) → `sib1`,`sib2`; `p1`→`c1`→`g1`→`gg1`; `p2`→`c2`→`g2`; `free`(root).
`deleteItems([p1, p2])` → remaining ids `['free','hold','sib1','sib2']`; after `undo()` →
all 11 ids restored. PASS.

Independent case **B** (mixed selection `goal`→`m1`,`m2` + `sibM` under unselected `hold2` +
`bill` `keep`): `deleteItems([goal, m1, keep])` → remaining `['hold2','sibM']`. PASS.

### AC2 — "The undo closure restores every deleted item (selection + descendants)" — **MET**

The closure captures `deleted`, not `items`. Independent cases assert **whole-object**
equality (`toEqual(b)`), not just ids: case **B** restored all 6 items byte-identical
(including `kind`, `data`, `reminders`, `tags`, `history`, `occurrences`, `createdAt`).
Case **H** restored a recurring habit (`recurrence {freq:'daily'}`, one completion in
`occurrences`) and its tagged child with an `id`-keyed reminder, both `toEqual` to the
originals, with `hc.parentId === 'h'`.

Parent links: cases A/B/F/H assert `relationships`/`parentId` explicitly —
`after.get('m1').parentId === 'goal'`, `after.get('m2').parentId === 'goal'`,
`after.get('c').parentId === 'p'`. `createMany` is a single `bulkPut`, so insertion order in
the closure is irrelevant; no dangling `parentId` after undo.

Repeat-undo safety: case **F** — a second `undo()` is a no-op (`['c','p','u']` unchanged).
Case **G** — `deleteItems([])` resolves without throwing and leaves data untouched.

### AC3 — "Non-selected sibling items are untouched" — **MET**

`removeMany` receives only `ids` (selection ∪ descendants); siblings are never in that set.
Evidence: case **A** (`sib1`,`sib2`,`hold` survived), case **B** (`sibM`,`hold2` survived),
case **D** (only `['c','c2','g','p','p2']` passed to `removeMany`; `u` survived). The
shipped test `restores the selection and descendants on undo, leaving siblings untouched`
(`:77-94`) also asserts an unrelated item survives.

### No double-delete of descendants already in the selection — confirmed

Case **D** (`vi.spyOn(itemRepo, 'removeMany')`) proves **exactly one** call, carrying the
deduped union:

```
expect(spy).toHaveBeenCalledTimes(1);
spy.mock.calls[0][0] === ['c','c2','g','p','p2']   // parent 'p' + its own child 'c' selected
new Set(ids).size === ids.length                   // no duplicate keys
```
PASS. Case **C** passes the same item twice (`[p, p, u]`): resolves without throwing,
nothing left after delete, exactly `['c','p','u']` after undo, `c.parentId === 'p'` — no
duplicate restore rows.

I also mutation-tested the *absence* of the guard (M3 below): Dexie's `bulkDelete`/`bulkPut`
tolerate duplicate keys, so no `ConstraintError` either way. The guard is cheap insurance
plus it keeps the restore array duplicate-free; it is not load-bearing.

---

## 2. Gates — all green, no new failures (baseline green per REPO_PROFILE §3/§7)

Run in the final, restored state (scratch file removed):

| Gate | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck` | exit 0, no diagnostics |
| lint | `npm run lint` | exit 0, no output |
| test | `npm run test` | **12 files / 62 tests passed** (was 59 at `96c5936`) |
| build | `npm run build` | PASS — `injectManifest` → `dist/sw.js`, precache **18 entries** (602.62 KiB), matching the REPO_PROFILE baseline of 18 |

No pre-existing failures encountered; the only stderr noise is the known benign Node warning
`--localstorage-file was provided without a valid path` (REPO_PROFILE §7). `dist/` is
untracked (`git ls-files dist` empty), so the build left no tracked artifacts dirty.

---

## 3. Executed the item's verification method — independently, plus mutation testing

Verification method: "Add a test in `src/domain/itemActions.test.ts` selecting a parent in a
multi-item set; assert descendants removed and restored on undo. Run `npm run test`." Done by
the implementer (3 tests, `:64-113`) and reproduced by me, then stress-tested beyond it with
8 independent cases.

**Mutation tests** (temporary edits to `deleteItems`, each reverted from `/tmp/ia.orig.ts`;
`git diff src/domain/itemActions.ts | md5` = `ee4fa01ae4d0cdb6c874dfc970e1b98f` after restore):

| Mutation | Expectation | Observed |
|---|---|---|
| **M1** revert to pre-fix body (`removeMany(items.map(i=>i.id))`, undo `createMany(items)`) | 3 shipped tests fail | `3 failed | 2 passed (5)` — all 3 `deleteItems` tests fail; tests are **non-vacuous** |
| **M2** keep cascade, undo restores `items` only | AC2 tests fail | `2 failed | 3 passed (5)` — both restore tests fail |
| **M3** drop the `ids.has` dedupe guard | ideally caught | `5 passed (5)` — **not** caught; see note below |

M3 finding: the dedupe branch is *not* covered by the shipped tests, but the guard is also not
required for correctness (Dexie bulk ops are duplicate-key tolerant). Not a defect — a
coverage nuance. The shipped test `handles a selection containing both a parent and its child`
(`:96-112`) exercises the branch's code path but would pass either way.

Note on fixture discipline: my first attempt at cases A and B mislabelled siblings — it gave
them `parentId` equal to the *selected* item, which makes them descendants. The cascade
correctly deleted them, and my expectations were wrong, not the code. Corrected fixtures put
siblings under a shared **unselected** parent. Worth flagging because the shipped tests never
assert a true same-parent sibling survives (`:77-94` uses a rootless `other`), so AC3 is
verified here only by my independent cases.

---

## 4. Consistency with IMP-002 / IMP-003 helpers, and `removeMany` soundness

- **IMP-002 (cycle-safe walker).** `deleteItems` calls the hydrated wrapper
  `itemRepo.collectDescendants` (`src/db/repository.ts:77-81`), which delegates to
  `collectDescendantIds` (`:16-33`) — the same IMP-002 BFS with the `visited` set. No new
  traversal logic, no duplicated walker. Cycle safety confirmed end-to-end by independent
  case **E**: `a→b→a` seeded, `deleteItems([a])` returns (no hang) and removes both; `undo()`
  restores `['a','b']`.
- **IMP-003 (capture-before-delete).** Mirrors `deleteItem`
  (`src/domain/itemActions.ts:106-113`): capture descendants → delete → undo `createMany`.
  Same `pushUndo` + `toastWithUndo` pair, so toast/undo UX is uniform.
- **Reuse over new API.** AC note "reuse the descendant-aware repository method" is satisfied
  by `collectDescendants`; adding `removeManyWithChildren` would have been redundant scope.
- **Single `removeMany` — sound.** One call, one Dexie transaction, so the delete itself is
  atomic (proved in case D). N+1 reads happen *before* it (one indexed `parentId` lookup walk
  per selected item), so the read phase is not in the same transaction as the write — unlike
  `removeWithChildren` (`repository.ts:83-89`), which recomputes descendants *inside* its
  transaction. Consequence: an item created in the sub-millisecond window between capture and
  delete would be orphaned. For a local-first single-user IndexedDB app with no concurrent
  writer this is acceptable and matches the existing `deleteItem` pattern; it is a known
  trade-off, not a regression. A repository-level `removeManyWithChildren(ids)` with one
  seeded BFS inside a transaction would close it if it ever matters — already logged by the
  implementer in `.improve/reports/discovered-IMP-004.md:11-14`.

---

## 5. Scope / style / hygiene audit

- **No scope creep.** Two source files, both inside the item's declared area. No repository,
  schema, migration, `types/`, feature, or styling change. No dependency/lockfile change
  (`package.json`/`package-lock.json` untouched). No `metadata.json` / `agents.md` /
  `.env*` contact, per REPO_PROFILE §6.
- **Conventions honoured.** Mutation only in `domain/itemActions.ts` (repository untouched,
  so "no direct Dexie outside `src/db/`" holds); no new localStorage; IDs untouched (existing
  items only); no UI copy persisted. `deleteItems`/`deleteItem` remain the only delete paths,
  so the change cannot bypass history/undo/toast.
- **No comments added** (REPO_PROFILE §5 / AGENTS.md).
- **No debug leftovers.** `git diff | grep -nE "console\.(log|debug)|debugger|TODO|FIXME|XXX|api[_-]?key|secret|token"` matches only the pre-existing word "TODO" inside the PROGRESS.log BACKLOG line. **No secrets.**
- **Formatting.** `npx prettier --check src/domain/itemActions.ts` → clean. The test file
  warns, but `diff` against prettier output shows the sole deviation is the **pre-existing**
  `relationships` helper (`:13-17`, introduced by IMP-003) — the newly added tests are
  prettier-clean. Not a regression; the repo-wide format sweep is still pending.
- **Unrelated change in the diff (bookkeeping, non-blocking):** `.improve/PROGRESS.log` adds
  the **IMP-003** line (`2026-10-04T02:36Z | IMP-003 | done | 96c5936 | …`). IMP-003's commit
  `96c5936` touched PROGRESS.log but shipped the *IMP-002* line, so this line is a leftover
  from that run, not part of IMP-004. Harmless, but it should be attributed to IMP-003 (or
  dropped) before the change is committed so IMP-004's diff is purely its own.
- **Report accuracy:** `impl-IMP-004.md:12` claims "`.improve/FEATURES.md`: IMP-004 marked
  DONE" — no longer true in the tree (`FEATURES.md:74` is `TODO`, reverted by the
  orchestrator). The claim also should not have been made; every other claim in that report
  reproduced exactly (62 tests, `dist/sw.js`, 18 precache entries, `ShoppingView` note,
  `ListView` needs no change).

---

## 6. Non-blocking observations (no action required, no regression)

1. Undo label/toast counts only the **selected** rows (`Delete ${items.length} items`), not the
   rows actually removed — deleting one goal reports "Deleted 1 items" while removing its
   milestones. Pre-existing copy; cosmetic, matches AC wording. Already logged in
   `discovered-IMP-004.md:15-17`.
2. `deleteItems([])` still pushes a no-op undo entry and clobbers prior undo history, which
   `ShoppingView.clearPurchased` (`src/features/shopping/ShoppingView.tsx:87-92`) can trigger
   on an empty cart. **Pre-existing**, untouched by this diff; verified not to throw or lose
   data (case G). Already logged in `discovered-IMP-004.md:5-10`.
3. `ShoppingView.clearPurchased` now cascades too — behaviourally correct (shopping items
   normally have no children), no visible change expected.

---

## 7. Commands run

```bash
git status --porcelain; git diff --stat; git diff          # change review
npm run typecheck && npm run lint && npm run test          # 0 / 0 / 12 files 62 tests
npm run build                                              # dist/sw.js, precache 18
npx vitest run src/domain/__verify_scratch_imp004.test.ts   # 8 passed (independent; file deleted)
# M1/M2/M3 mutations of deleteItems, each reverted from /tmp/ia.orig.ts
npx prettier --check src/domain/itemActions.ts src/domain/itemActions.test.ts
git diff | grep -nE "console\.(log|debug)|debugger|TODO|FIXME|XXX|api[_-]?key|secret|token"
```

---

# VERDICT: **PASS**

AC1 / AC2 / AC3 all met. Bulk delete cascades to the descendants of every selected item,
never double-deletes or double-restores a descendant that is itself selected, leaves
siblings and unrelated items untouched, and the single `removeMany` carries the deduped union
in one atomic Dexie transaction whose undo closure restores every row byte-identical with
correct `parentId` links. All four gates green with zero new failures; the shipped tests are
proven non-vacuous by mutation. Reuse of the IMP-002 cycle-safe walker and the IMP-003
capture-before-delete pattern is correct and adds no new traversal logic.

Nothing blocking. Non-blocking cleanups before commit: attribute or drop the stray
IMP-003 `PROGRESS.log` line, and correct `impl-IMP-004.md:12`'s stale DONE claim.
Do **not** treat the two observations in §6 as regressions — both predate this diff.