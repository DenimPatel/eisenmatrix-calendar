# Verify — IMP-061: `deleteItems([])` is a no-op

Reviewer: independent (did not author the change)
Branch: `improve/auto-20261017` (HEAD `3afe7fb`), working tree uncommitted
Date: 2026-10-17

**VERDICT: PASS** — all three acceptance criteria are met.

## Scope reviewed

| File | Change |
|---|---|
| `src/domain/itemActions.ts` | One guard line: `if (!items.length) return;`, first statement of `deleteItems` |
| `src/domain/itemActions.test.ts` | New `does nothing for an empty selection` case in the `deleteItems` describe |

Production diff is exactly one line. No call sites, exports, comments, logging or
dependencies changed. Unrelated `.improve/CHANGELOG.md` / `PROGRESS.log` IMP-026 entries
and the `FEATURES.md` status flip are session metadata, not implementation scope; the
implementation report's claim that `.improve/` was untouched is inaccurate only as to
those pre-existing workflow edits.

## Acceptance criteria

1. **PASS — guard precedes all side effects.** The guard is `itemActions.ts:129`, before
   `collectDescendants`, `removeMany`, `pushUndo` and `toastWithUndo` (`:130-142`). No
   repository, undo or toast call can run for `[]`.
2. **PASS — undo stack and toasts unchanged.** The test seeds rows, pushes a real
   `Prior` undo entry, calls `deleteItems([])`, then asserts exactly one undo entry
   labelled `Prior`, unchanged toasts, and unchanged rows. With one entry, `stack[0]` is
   both the sole and top entry; the assertion would be clearer as `stack.at(-1)`, but it
   is adequate. Non-blocking style note only.
3. **PASS — non-empty path untouched.** `git diff` adds no statement after the guard.
   The descendant cascade, `removeMany([...ids])`, undo snapshot of selection plus
   descendants, and `Deleted ${items.length} items` toast are byte-identical. Existing
   `deleteItems` cascade/selection tests all pass.

## Non-vacuous test check

Ran the modified test file against a temporary `git archive HEAD` copy (no workspace
edits) with only the new test copied in: **1 failed / 41 passed**. Failure:

```
AssertionError: expected [ { label: 'Prior', …(2) }, …(1) ] to have a length of 1 but got 2
  src/domain/itemActions.test.ts:260
```

HEAD's `deleteItems([])` pushes `Delete 0 items` onto the prior entry and fires
`Deleted 0 items`, so the test fails for the intended reason. The test also checks the
toast list and rows, covering the other AC2/no-write requirements.

## Gates

```
npm run typecheck   PASS
npm run lint        PASS
npm run test        PASS  39 files / 420 tests
```

420 matches the implementation report and the expected 419 baseline + 1.

## Suggested health delta

**Bugs/Correctness: 4 → 4 (hold; +0.5 candidate)** — closes a latent undo-clobbering
hazard, but every current caller already guards empty input, so there is no user-facing
defect fixed.
