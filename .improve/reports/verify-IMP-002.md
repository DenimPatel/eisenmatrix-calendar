# verify-IMP-002 (re-verification, retry 2) — Delete deep descendants

Reviewer: independent (did not author). Branch: `improve/auto-20261003` @ HEAD `a20b684`.
Scope under review: working-tree diff (uncommitted); prior verdict FAIL at `a20b684`.

## Summary

**VERDICT: PASS.** The previously blocking defect — infinite loop on a self-parent row
or parent/child cycle in `collectDescendantIds` — is fixed. The walker now seeds a
`visited` set with the root id, skips already-seen ids, and advances the frontier only
with newly visited children. Self-parent rows terminate, the root is excluded from its
own descendants, and cycles of any length terminate. All four acceptance criteria are
met, and the full gate is green.

## Prior issue: confirmed fixed

- Old (failing): no visited set → frontier never emptied on a cycle, `rw` transaction
  never committed (prior report `verify-IMP-002.md:57-72`).
- New (`src/db/repository.ts:16-33`):
  ```ts
  const visited = new Set<string>([id]);
  let frontier = [id];
  while (frontier.length > 0) {
    const children = await db.items.where('parentId').anyOf(frontier).toArray();
    const next: string[] = [];
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      ids.push(child.id);
      next.push(child.id);
    }
    frontier = next;
  }
  ```
- Root exclusion: `visited` is seeded with `id`, so a self-parent row
  (`child.id === id`) is skipped and never pushed to `ids`; `collectDescendantIds('s')`
  returns `[]`. Confirmed by the committed test
  `src/db/repository.test.ts:71-76` and by the throwaway check below.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Deletes item + **all** transitive descendants, not only immediate children | MET | BFS/queue walker `src/db/repository.ts:16-33`; `removeWithChildren` bulk-deletes `[id, ...descendants]` at `:77-83` |
| 2 | Grandchildren/deeper removed for a 3-level fixture | MET | `src/db/repository.test.ts:57-69` seeds `p→c→g→gg` (4 levels) + unrelated pair; asserts only `['other','other-child']` remain |
| 3 | Items sharing an unrelated `parentId` untouched | MET | same test; plus self-parent test keeps `keep` (`:71-76`) |
| 4 | Remains inside a single read-write transaction | MET | `db.transaction('rw', db.items, ...)` wraps the awaited walk + bulkDelete (`:79-82`) |

## Gate results (baseline green)

`npm run typecheck && npm run lint && npm run test` → all pass:

```
tsc --noEmit        (no diagnostics)
eslint .            (no output)
 Test Files  11 passed (11)
      Tests  57 passed (57)
```

No new or pre-existing failures. (`57/11` includes IMP-002's 2 added tests;
prior IMP-001 baseline was 55/11, original 49/10.)

## Focused cycle/self-parent check (throwaway, `/tmp` only)

Temp config `/tmp/imp002b/...` + `vitest.imp002.config.ts` (deleted after run), seeding
self-parent, 2-node and 3-node cycles; each delete raced against a 3s bound. Raw output:

```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Cases:
- self-parent `s.parentId='s'`: `collectDescendantIds('s')` → `[]` (root excluded),
  `removeWithChildren('s')` terminates, only `keep` remains.
- 2-node cycle `a↔b`: terminates, both removed, `keep` remains.
- 3-node cycle `a→b→c→a`: `collectDescendantIds('a')` → `['b','c']`, terminates,
  `keep` remains.

## Scope / style / hygiene

```
 .improve/PROGRESS.log     |  1 +
 src/db/repository.test.ts | 32 ++++++++++++++++++++++++++++++++
 src/db/repository.ts      | 23 +++++++++++++++++++++--
 3 files changed, 54 insertions(+), 2 deletions(-)
```

- No debug leftovers, no `console.*`, no secrets, no comment spam.
- `.improve/PROGRESS.log` adds one IMP-001 line (`02:24Z | IMP-001 | done | a20b684`);
  confirmed as IMP-001's own log entry, not IMP-002 code. Minor, non-blocking.
- Untracked `discovered-IMP-002.md`, `impl-IMP-002.md`, this report, and `.kilo/` are
  outside the diff. No scope creep.
- `collectDescendantIds` is exported for reuse by IMP-003/IMP-004 per the item notes;
  unused elsewhere is intended.

## Verdict rationale

The only blocker from the prior FAIL is resolved and directly reproduced as passing
committed tests plus an independent throwaway check. Criteria 1-4 met, gate green, no
new issues. PASS.
