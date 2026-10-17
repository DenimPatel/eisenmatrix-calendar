# verify-IMP-089 — atomic occurrence status writes

**Date:** 2026-10-17
**Branch:** `improve/auto-20261017` (working tree, uncommitted)
**Reviewer:** independent verifier

## VERDICT: PASS

All three acceptance criteria hold. The fix is targeted, the concurrency test is
non-vacuous, and all four gates plus the build pass.

## 1. Review of the diff

`itemRepo.updateAtomic(id, build)` (`src/db/repository.ts:75-91`) opens one
`db.transaction('rw', db.items, ...)`, reads the row, normalizes it, runs `build`
synchronously, merges with `mergeItem`, and `put`s the row before the callback resolves.
The callback is synchronous; the only awaits inside the transaction are Dexie table
operations (`items.get`, `items.put`), so Dexie's transaction zone is preserved and the
write cannot run outside the transaction. It does not call `itemRepo.update` or any other
transaction-opening helper, so no nesting occurs; it has exactly one caller.
`before`/`after` are captured inside the transaction, and a missing row or `build`
returning `null` returns `undefined` without a `put`. If `build` or `put` throws, Dexie
aborts the transaction and `updateAtomic` rejects; `patchItemAtomic` then does not push
undo or toast. History and undo are derived from the transactional `before` snapshot.

`setStatus` (`src/domain/itemActions.ts:207-238`) now performs the merge, legacy override
cleanup, completion timestamp preservation, and no-op decision inside the transaction via
`patchItemAtomic`. `patchItem` itself is byte-unchanged; only `setStatus` was migrated, so
other callers keep their previous semantics. The undo closure restores the full `before`
snapshot; push happens after commit, one entry per real write. Observable toast/undo
labels are unchanged.

## 2. Gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 42 files / **455 tests** (baseline 454 + 1) |
| `npm run build` | PASS — main `built in 2.45s`, SW precache 18 entries |
| `npm run format:check` | PASS |

## 3. Concurrency test quality

`itemActions.test.ts:503-519` awaits
`Promise.all([setStatus(stale, 'done', K1), setStatus(stale, 'done', K2)])` with the
unawaited calls sharing one pre-write snapshot. It asserts both occurrence keys are
`done`, the undo stack has exactly two entries, the first undo leaves exactly one key,
and the second restores an empty occurrence map.

**Non-vacuous:** copied the new test file onto a pristine `git archive HEAD` tree and ran
it against the previous implementation; it fails with
`expected undefined to be 'done'` for `K1` (the lost update). Against the changed tree it
passes.

**Determinism:** the focused test was run 10 times; 10/10 passed (1 passed, 44 skipped).
No flakes.

## 4. Issues / residual risk

- No blocking issues. No scope creep: one repository primitive, one internal action
  helper, the `setStatus` refactor, and one test.
- Undo stack order relies on IndexedDB serializing read-write transactions on `items`;
  the concurrent test exercises that ordering and was stable 10/10.
- Other occurrence writers (`updateRecurring`, `skipOccurrence`, habit streak, etc.)
  remain non-atomic, as documented in `discovered-IMP-089.md` and outside this spec.

## Suggested Bugs/Correctness health delta

**+1** — removes a reproducible lost-update/data-loss path on occurrence status writes;
narrow scope and low residual risk.
