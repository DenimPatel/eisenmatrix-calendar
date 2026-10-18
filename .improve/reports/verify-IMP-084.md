# verify-IMP-084 — Remap `parentId` for every incoming item under the duplicate strategy

Independent skeptical review. I did not write this change.

## Diff under review
`git diff HEAD` = 2 files, +32 lines:
- `src/lib/backup.ts` (+4): in `mergeImportedItems`, after the colliding-id branch, a new
  non-colliding branch under `strategy === 'duplicate'` rewrites `parentId` when it resolves
  in `idMap`, then `continue`s; otherwise falls through to the untouched `toPut.push(item)`.
- `src/lib/backup.test.ts` (+28): 2 cases in the existing `parentId remapping on duplicate`
  block.

Untracked: `impl-IMP-084.md`, `discovered-IMP-084.md` (reports only).

## Acceptance criteria
1. **Every incoming item whose `parentId` resolves in `idMap` is rewritten.** PASS. The new
   branch at `src/lib/backup.ts:136-139` is reached only for non-colliding items under
   `duplicate` and rewrites whenever `idMap.has(item.parentId)`. `idMap` is prebuilt over the
   whole `incoming` array (`:110-115`), so it is order-independent. Confirmed with a
   throwaway probe: fresh child before its colliding parent still repoints
   (`[c,p]` and `[p,c]` both yield `child.parentId === duplicatedParent.id`). A fresh child
   chained through a fresh parent up to a colliding grandparent also resolves correctly
   (`GC→new-p`, `new-p→dup(gp)`), because the fresh parent itself flows through the new branch.
2. **Fresh-id child with an out-of-set parent keeps `parentId`.** PASS. `idMap.has` is false
   (`ghost`), item pushed verbatim; pre-existing tests at `backup.test.ts:196,209` still pass.
   Probe confirmed `parentId: 'ghost'` preserved.
3. **`skip`/`overwrite` byte-identical.** PASS. The new branch is guarded by
   `strategy === 'duplicate'`, so both strategies reach the original `toPut.push(item)` by
   reference. Probe confirmed `overwrite.toPut[0] === p`, `[1] === c`, and JSON equality;
   existing test `:250` passes.
4. **A twice-present parent id resolves to one canonical target.** PASS. The pre-pass uses
   `!idMap.has` (`:113`), unchanged, so `idMap` holds one new id per colliding id; both
   colliding rows and the fresh child converge on it. New test `:235` asserts a single
   non-`'p'` target id.

## Scope / leftovers / order dependence
- No scope creep: only the residual gap D1 is addressed; D2/D3 explicitly left with their
  owners (matches `discovered-IMP-084.md` and the spec Notes).
- No leftovers: no debug code, no stray files; only the 2 source files + reports.
- Order dependence: none, verified by probe (child-before-parent) and by the pre-pass design.
- `FEATURES.md` status left `TODO` — consistent with the IMP-051 precedent noted in the
  impl report; not a defect.

## Gates (all PASS)
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test` — 43 files / 486 tests pass (+2).
- `npm run format:check` — "All matched files use Prettier code style".
- `npm run build` — succeeds (tsc + vite + SW); the impl report skipped it, I ran it.

## Throwaway probes (deleted afterwards)
`src/lib/__probe_imp084.test.ts` (5 cases: child-before-parent, fresh-parent chain, skip/
overwrite identity + JSON equality, out-of-set parent, self-referencing colliding parent) —
all 5 passed, then removed. `git status` shows no residual file.

## VERDICT: PASS
All four acceptance criteria met, gates green, no scope creep, no leftovers, order-independent.
