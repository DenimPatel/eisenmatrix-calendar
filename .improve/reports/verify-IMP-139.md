# Verify IMP-139 — Preserve per-occurrence state when splitting a series

Independent, skeptical verification of the uncommitted change. I did not write it.

- **Verdict: PASS** — all acceptance criteria met; all five gates green; mutation-checked.
- **Method:** read the spec (`.improve/FEATURES.md` IMP-139, `impl-IMP-139.md`,
  `discover4-quality.md` C1, `REPO_PROFILE.md`, `AGENTS.md`); inspected `git diff`/`git status`;
  ran the gates; wrote a throwaway probe test (`src/domain/__probe_imp139.test.ts`, since
  deleted) exercising every edge case directly and through `updateRecurring`.

## Scope inspected

```
 M .improve/FEATURES.md
 M src/domain/itemActions.test.ts
 M src/domain/recurrence.test.ts
 M src/domain/recurrence.ts
?? .improve/reports/discovered-IMP-139.md
?? .improve/reports/impl-IMP-139.md
```

Diff is +74/−7. The only production change is `splitSeries` in
`src/domain/recurrence.ts:447-474`: the source `occurrences` map is partitioned by a plain
string compare of local `YYYY-MM-DD` keys — head keeps `key < fromKey`, tail keeps
`key >= fromKey` with identical values. No other production behavior changed; the
IMP-023/037/113 count/until/byWeekday/byMonthDay and tail-anchor logic is untouched (the diff
adds only the two partition locals and the two `occurrences:` assignments). No dead code,
no `console.log`, no unrelated source edits.

## Acceptance criteria

1. **Tail `>= K`, head `< K`, no wrong-side keys — MET.** Direct probe: head `occurrences`
   = only the two pre-split keys; tail = the three post-split keys byte-identical to source,
   including the key **exactly equal to K** (`2026-07-27`), which is carried by the tail.
   `for k of head: k < K` and `for k of tail: k >= K` both hold.
2. **Re-expansion reproduces original statuses — MET.** Re-expanded head+tail over
   `2000..2100`, union of keys equals the unsplit series' keys, and
   `resolveOccurrenceStatus` of every key matches the unsplit series (including
   `cancelled`/`completedAt:null` and post-split `done`). Verified directly **and** through
   `updateRecurring(stored, 'future', K, {title})` (two rows persisted; union and statuses
   match the pre-split row).
3. **Vacuous assertion replaced by the partition assertion; existing split tests pass — MET.**
   `recurrence.test.ts:524-544` now marks a *post-split* `done` state and asserts the real
   head/tail partition; a new test (`:547-566`) re-expands head+tail and compares every
   status. `itemActions.test.ts:869-898` adds the action-path partition case. Full suite: 74
   files / 739 tests pass.

**Edge cases reproduced:** key exactly `== K` (tail); empty `occurrences` map (both sides
`{}`); series with no post-split state (tail stays `{}`, head keeps all); count+until+
byWeekday series (union and totals preserved).

## Gates

`npm run typecheck` ✅ · `npm run lint` ✅ · `npm run test` ✅ (74 files / 739 tests) ·
`npm run format:check` ✅ · `npm run build` ✅ (`dist/sw.js` generated, 28 precache entries).
Health delta vs. IMP-138 baseline (737 tests): **+2 tests, all green.**

## Mutation-check

Backed up `recurrence.ts`, applied each mutation, ran `recurrence.test.ts` +
`itemActions.test.ts` + the probe, then restored.

- **Revert tail partition** (`occurrences: tailOccurrences` → `{}`): **3 in-repo tests fail** —
  `recurrence.test.ts > splitSeries > keeps a skipped day consuming count`,
  `recurrence.test.ts > splitSeries > re-expands a split series…`,
  `itemActions.test.ts > updateRecurring (scope: future) > partitions per-occurrence state…`
  (+2 probe tests). Matches the impl report's claim of 3.
- **Revert head partition** (drop `occurrences: headOccurrences`): **2 in-repo tests fail** —
  `keeps a skipped day consuming count` and `partitions per-occurrence state…` (+2 probe).
  Matches the impl report's claim of 2.

Both partitions are independently load-bearing and covered. `git diff` after restore is
byte-identical to the implementation (`recurrence.ts` diff hash
`ddc0a401717bf799d347423e6388bba34e4f7e7d`); the probe file was deleted.

## Criterion 5 — state/backlog files

Only `.improve/FEATURES.md` changed among state files; `STATE.md`, `PROGRESS.log`,
`CHANGELOG.md`, `LOCK` are untouched. The status flip is `IMP-139: TODO → IN-PROGRESS`
(correct for a verify-pending item; the verifier flips to DONE, matching the IMP-138
convention). **Minor observation:** the same FEATURES.md hunk also corrects the *unrelated*
IMP-138 note `Commit pending.` → `Commit fc84462.` (a stale bookkeeping fix for the already-
committed IMP-138). Harmless, within FEATURES.md, but it is an extra edit beyond the IMP-139
status flip.

## Notes / residuals

- `discovered-IMP-139.md` documents that `rule.overrides` (keyed by occurrence key) is *also*
  spread wholesale onto both head and tail, so the head keeps dead override keys `>= K`.
  Correctly left out of scope (the acceptance criteria cover only `occurrences`; IMP-023
  tracks the sibling exception concern) and documented rather than silently fixed.
- Browser check skipped: this is pure domain logic fully covered by fake-indexeddb unit tests
  and the gates; no UI surface changed.
