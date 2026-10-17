# impl-IMP-026 — unit tests for `src/domain/eisenhower.ts`

## Files changed
- New `src/domain/eisenhower.test.ts` (15 tests). No production changes.

## Coverage
- `quadrantOf`: parameterised over all four urgency/importance combinations
  (high/high -> q1, low/high -> q2, high/low -> q3, low/low -> q4); defaults from
  `createItem` (low/low) land in q4; every `QUADRANTS` entry maps back to its own id.
- `priorityScore`: q1..q4 scores are strictly descending and pairwise distinct;
  the score increases strictly when urgency flips low -> high at either importance
  level, and when importance flips low -> high at either urgency level.
- `itemsInQuadrant`: each quadrant returns only matching items, preserving input
  order; the four calls together partition every item into exactly one quadrant;
  a quadrant with no matches returns an empty array.
- No functional bug was exposed; no source fix was needed.

## Commands / results
- `npm run typecheck` — PASS (`tsc --noEmit`, no diagnostics)
- `npm run lint` — PASS (`eslint .`, no output)
- `npm run test` — PASS (39 files, 419 tests; baseline 404, +15 new tests)
- `npx prettier --check src/domain/eisenhower.test.ts` — PASS after formatting

## Acceptance criteria
1. `quadrantOf` all four combinations plus defaults — covered.
2. `priorityScore` ordering and monotonicity — covered.
3. `itemsInQuadrant` partitioning — covered.
4. All pass via `npm run test` — yes.

## Notes
- The existing `priorityScore` JSDoc says "4 = important+urgent … 1 = neither",
  while the implementation returns 3/2/1/0. Only relative order feeds the Matrix
  and List sorting, so this is a stale comment, not a behavioural defect. The
  tests assert ordering/distinctness rather than pinning the documented numbers,
  and the source was left unchanged per the smallest-change/no-comments rules.
