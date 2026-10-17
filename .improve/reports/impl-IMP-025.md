# impl-IMP-025 — direct tests for the `itemActions` write path

## Files changed
- `src/domain/itemActions.test.ts` (extended; no production changes)

## Approach
- The file already existed and covered AC3 (`deleteItem` / `deleteItems` descendant
  restoration, including transitive descendants, selections containing a parent and child,
  and undo leaving siblings untouched) and AC4 (`updateRecurring` for `occurrence`,
  `future`, and `all`, including split anchoring, count preservation, no-op detection and
  undo). Those tests were left as-is.
- Added AC1 coverage: `saveItem` edit history accumulation. Three writes (create, two
  edits) produce exactly the three expected history entries with correct old/new values;
  the undo stack holds the create entry plus one entry per edit; undoing newest-first
  restores the intermediate row, then the original row with empty history, then removes
  the created row.
- Added AC2 coverage as two explicit tests:
  - plain task: `toggleDone` marks it done (status, `completedAt`, `Status` /
    `Completed At` history), then back to todo; one undo restores done, the second
    restores the pre-toggle row byte-for-byte.
  - occurrence: `toggleDone(item, occKey)` writes only that occurrence's state, leaves the
    series-level `status` at `todo` and the sibling occurrence untouched, and undo restores
    the pre-toggle row.
- No production behavior was changed; no test exposed a bug.
- Formatting: `prettier --write` on the test file also collapsed one pre-existing two-line
  `expect` (cosmetic only).

## Commands / results
- `npm run typecheck` — PASS (`tsc --noEmit`, no diagnostics)
- `npm run lint` — PASS (`eslint .`, no output)
- `npm run test` — PASS (33 files, 378 tests; baseline was 375, +3 new tests)
- `npx vitest run src/domain/itemActions.test.ts` — PASS (41 tests)

## Acceptance criteria
1. `saveItem` create + edit history accumulation and undo closure — covered.
2. `toggleDone` plain item and occurrence — covered explicitly.
3. `deleteItem` / `deleteItems` descendant restoration — covered (pre-existing tests).
4. `updateRecurring` `occurrence` / `future` / `all` scopes — covered (pre-existing tests).
5. All pass via `npm run test` — yes.

## Uncertain
- Nothing material. The full suite number (378) includes the four IMP-076-era tests that
  were already present in the same file; only the three tests added here are new.
