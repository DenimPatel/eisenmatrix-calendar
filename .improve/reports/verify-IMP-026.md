# verify-IMP-026 — unit tests for `src/domain/eisenhower.ts`

**Reviewer:** independent verifier (did not write the change)
**Date:** 2026-10-17
**Item:** `.improve/FEATURES.md` → `### IMP-026` (`:747-762`)
**Impl report:** `.improve/reports/impl-IMP-026.md`
**Conventions:** `.improve/REPO_PROFILE.md`, `AGENTS.md`
**Branch:** `improve/auto-20261017` (HEAD `c52c7b8`; IMP-026 change uncommitted/untracked)

## VERDICT: PASS

All four acceptance criteria are met. The change is test-only: a new
`src/domain/eisenhower.test.ts` with 15 non-vacuous tests over the real module, plus harness
bookkeeping. No production code changed. `typecheck`, `lint`, `test` (39 files / 419 tests,
+15 vs the 404 baseline) and `build` all pass. The reported `priorityScore` JSDoc `4..1`
mismatch is a stale comment, not a behavioural defect and not a blocker for this item.

---

## 1. Scope of the diff

`git status --porcelain`:

```
 M .improve/CHANGELOG.md
 M .improve/FEATURES.md
 M .improve/PROGRESS.log
?? .improve/reports/impl-IMP-026.md
?? src/domain/eisenhower.test.ts
```

| File | Verdict |
|---|---|
| `src/domain/eisenhower.test.ts` | In scope. New, 108 lines, 15 tests. Only `src/` change. |
| `.improve/FEATURES.md` | Harness bookkeeping: IMP-026 `TODO` → `IN-PROGRESS` (one line). |
| `.improve/reports/impl-IMP-026.md` | New impl report (untracked), as expected. |
| `.improve/CHANGELOG.md`, `.improve/PROGRESS.log` | **Not IMP-026**: the uncommitted lines describe IMP-032 (`c52c7b8`). Pre-existing working-tree carry-over from the previous item, not authored by this change. Harmless to this review; the coordinator may want to fold them into IMP-032 bookkeeping. |

`git diff HEAD -- src/` is empty, confirming no tracked production changes. No dependency,
schema, styling, or config changes. No scope creep in product code.

**Style:** no comments in the new file, no `console.*`, `debugger`, `.only`, `.skip`, or
`.todo`. `npx prettier --check src/domain/eisenhower.test.ts` passes. Imports follow the
existing `@/types` alias and `it.each` style used elsewhere in `src/domain`. The impl report
is not Prettier-clean, but neither are the existing impl/verify reports or `FEATURES.md`
(checked IMP-025 and IMP-032), so this matches repo convention and is not a regression.

---

## 2. Acceptance criteria

### AC1 — `quadrantOf` all four urgency/importance combinations, ties/defaults — **MET**

`eisenhower.test.ts:13-45`:

- `:13-18` defines an independent literal expectation table (not derived from `QUADRANTS`):
  high/high → q1, low/high → q2, high/low → q3, low/low → q4.
- `:25-30` `it.each(CASES)` asserts each of the four exhaustive combinations.
- `:32-38` creates a default item via `createItem({ kind: 'task' })` and asserts
  `urgency === 'low'`, `importance === 'low'`, and `quadrantOf(item) === 'q4'`, so the
  default path is pinned rather than assumed.
- `:40-44` round-trips every `QUADRANT_IDS` entry through its `QUADRANTS` metadata and back
  to the same id, catching metadata/function drift used by the Matrix.

`Priority` is exactly `'high' | 'low'` (`src/types/item.ts:5`), so there is no third value
and no literal "tie" state; the four cases are the complete input space. Swapping any branch
of `quadrantOf` (`src/domain/eisenhower.ts:51-54`) fails at least one named case.

### AC2 — `priorityScore` ordering and monotonicity — **MET**

`eisenhower.test.ts:47-71`:

- `:48-54` maps q1..q4 through `QUADRANTS` and asserts the scores are in non-increasing
  footprint order, are pairwise distinct (`Set(scores).size === 4`), and `scores[0]` is
  strictly greater than the last. Distinctness rules out a constant or partially collapsed
  score.
- `:56-62` asserts flipping urgency low → high strictly increases the score at **both**
  importance levels.
- `:64-70` asserts flipping importance low → high strictly increases the score at **both**
  urgency levels.

These assertions are non-vacuous against the actual implementation
(`eisenhower.ts:57-59`): urgency-only, importance-only, inverted, or constant mutations each
fail at least one of the three tests. The tests deliberately assert relative order, not the
literal `3/2/1/0` values — exactly what AC2 asks for and what all consumers use (see §4).

### AC3 — `itemsInQuadrant` partitioning — **MET**

`eisenhower.test.ts:73-107`:

- `:74-82` builds seven real items covering all quadrants, with two q1, two q2, two q3 and
  one q4 item so membership and order are observable.
- `:84-91` runs once per quadrant and asserts every returned item maps back to that quadrant
  **and** that ids exactly match an independent filter of the input, i.e. input order is
  preserved (a sort or reverse mutation fails).
- `:93-103` flattens the four quadrant calls and asserts total length equals the input length
  plus set equality with the input ids. Together these prove exactly-one membership (no
  duplicates, no drops), i.e. a true partition.
- `:105-107` asserts a non-matching quadrant returns `[]`.

### AC4 — all pass via `npm run test` — **MET**

See gates in §5: 39 files / 419 tests passed, including 15/15 for the new file.

---

## 3. Test quality assessment

- **Non-vacuous:** every test asserts a concrete mapping, ordering relation, or exact id
  sequence; there are no truthiness-only or snapshot-only assertions.
- **Real code, no mocks:** imports the actual `eisenhower` module and `createItem`; there is
  no reimplementation of the logic under test in the test file. The expectation table for
  `quadrantOf` is independently written.
- **Deterministic:** pure functions and fixed literals; no dates, randomness, IndexedDB, or
  shared mutable state. The 15 targeted tests run in a few ms.
- **Coverage shape:** 4 quadrant cases + defaults + metadata round-trip; 3 score properties;
  4 per-quadrant filters + partition + empty case = 15 tests, matching the 404 → 419 delta.
- **Minor nuance (non-blocking):** the exact score values are not pinned, so the tests would
  allow a future change from `3/2/1/0` to another strictly ordered scale (e.g. `4/2/1/0`).
  That is acceptable for AC2 and is arguably desirable while the JSDoc disagreement is
  unresolved; if the numeric scale is intended to be a contract, add an exact-value test when
  the comment/implementation is reconciled.

---

## 4. The `priorityScore` JSDoc `4..1` vs `3..0` mismatch

- Source comment: `src/domain/eisenhower.ts:56` — `/** 4 = important+urgent … 1 = neither. */`.
- Implementation: `eisenhower.ts:58` —
  `(importance === 'high' ? 2 : 0) + (urgency === 'high' ? 1 : 0)`, producing q1=3, q2=2,
  q3=1, q4=0.
- Consumers: `src/features/matrix/MatrixView.tsx:30` and
  `src/features/list/ListView.tsx:55` use only differences/comparisons
  (`priorityScore(b) - priorityScore(a)`), never absolute values. Nothing persists or exports
  the score; `grep` finds no other consumer or documentation of the number.
- **Conclusion:** this is a stale JSDoc comment, documentation-only. The observable contract
  (strict ordering q1 > q2 > q3 > q4) is correct and is what the tests pin. It does **not**
  block IMP-026, whose AC2 explicitly asks for ordering/monotonicity. It remains a genuine
  doc bug worth a one-line follow-up (fix the comment, or change the implementation to
  `4/2/1/0` if the four-point scale was intended — consumers would be unaffected either way).

---

## 5. Gates

Run on the working tree:

```
npm run typecheck  -> exit 0 (tsc --noEmit, no diagnostics)
npm run lint       -> exit 0 (eslint ., no output)
npm run test       -> 39 files / 419 tests passed (baseline 404, +15)
npm run build      -> exit 0; vite build + injectManifest SW, dist/sw.js, 18 precache entries
```

Additional checks:

```
npx vitest run src/domain/eisenhower.test.ts --reporter=verbose -> 15/15 passed
npx prettier --check src/domain/eisenhower.test.ts              -> clean
```

No test is skipped, todo, or `.only`. `dist/` shows no tracked changes after the build. The
only console noise is the known benign `--localstorage-file` warning described in
`REPO_PROFILE.md`.

---

## 6. Health deltas (suggested)

| Dimension | Current | Suggested | Rationale |
|---|---|---|---|
| Tests/Tooling | 4 | 4.5 (+0.5) | IMP-026 closes the eisenhower half of the remaining named domain gap with 15 meaningful tests; hook coverage (IMP-066) still remains, so not a full +1. |
| Bugs/Correctness | 4 | 4 (+0) | Test-only; no behaviour changed. The stale JSDoc is a docs nit, not a defect. |
| Maintainability | 3 | 3 (+0.25) | Quadrant mapping, score ordering and partition semantics are now executable documentation, making Matrix/List sort regressions visible. |
| Risk | — | low | No production code, no schema/dependency changes, deterministic pure-function tests. |
