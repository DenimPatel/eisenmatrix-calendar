# IMP-061 — Implementation report

**Status:** implemented (all gates pass; `.improve/` state files untouched)

## Files changed

| File | Change |
| --- | --- |
| `src/domain/itemActions.ts` | `deleteItems` now returns immediately when `items` is empty, before any descendant lookup, repository write, undo push, or toast. Non-empty path is byte-identical. |
| `src/domain/itemActions.test.ts` | Added `does nothing for an empty selection` under the `deleteItems` describe: seeds two related rows, pushes a real `Prior` undo entry, calls `deleteItems([])`, and asserts the undo stack still has exactly that one entry, the toast list is unchanged, and both rows still exist with their original contents. |

## Approach

- The guard is the first statement of `deleteItems`, so an empty array cannot reach
  `collectDescendants`, `removeMany`, `pushUndo`, or `toastWithUndo`. This preserves the
  user's existing top undo entry instead of replacing it with a `"Delete 0 items"` claim.
- Non-empty selections keep the existing descendant cascade, undo snapshot of selection +
  descendants, and `Deleted N items` toast. No other call sites or exported behavior changed.

## Verification

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run test` — PASS, 39 files / 420 tests (baseline 419; one new test).
- Targeted: `npx vitest run src/domain/itemActions.test.ts` (included in the full run above).

## Uncertainties / notes

- No unrelated findings; no `discovered-IMP-061.md` was created.
