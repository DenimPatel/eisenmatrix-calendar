# verify-IMP-006 — Independent review

Verdict: **PASS** (with two minor coverage notes and two minor report inaccuracies).

Reviewer scope: tests-only item. No commit made. `src/domain/stats.ts` and
`src/domain/recurrence.ts` were temporarily mutated during the mutation check and
restored byte-for-byte (verified by `git status --porcelain` returning the same two
pre-existing modifications after every round).

## 1. Diff vs acceptance criteria — no production code changed

```
$ git status --porcelain
 M .improve/PROGRESS.log
 M src/domain/stats.test.ts
?? .improve/reports/discovered-IMP-006.md
?? .improve/reports/impl-IMP-006.md
?? .kilo/

$ git diff --name-only -- src/       → src/domain/stats.test.ts   (only)
$ git diff --cached --name-only      → (empty)
$ git ls-files --others --exclude-standard -- src/  → (empty)
```

`src/domain/stats.test.ts` is a test file (`*.test.ts`, 63 → 372 lines, +317/−7). **No
production code changed.** The only edit to pre-existing lines is a Prettier re-wrap of the
`makeHabit` signature (4 lines → 1, `src/domain/stats.test.ts:24`); all five IMP-001
`habitStreak` cases and the shared `markDone` helper are otherwise untouched.

`.improve/PROGRESS.log` gains one line — and it is the **IMP-005** row, a leftover from
the previous item in this worktree, not from IMP-006. Not production code, but it is an
uncommitted cross-item edit that should be reviewed with IMP-005, not folded in here.

| AC | Requirement | Met | Evidence |
| --- | --- | --- | --- |
| 1 | `goalProgress` for `numeric`, `binary`, `checklist`, incl. `children.length \|\| 1` | yes | 13 cases, `stats.test.ts:135-222`. Numeric: rounding 3/8→38 (`:136`), no-unit label (`:146`), 100% clamp 12/8 (`:152`), `target ?? 1` fallback (`:159`), `target===0` guard (`:164`). Binary: `status:'done'` wins over `metric.current` (`:171`), `metric.target` ignored (`:176`), `completedAt` without `status` (`:181`), untouched→0 (`:187`). Checklist: target from children length with mixed done signals → `2/3`/67 (`:192`), unit appended (`:207`), **zero-children `target = children.length \|\| 1`** with metric `current:4,target:9` ignored → `0/1` (`:213`). Plus the `kind!=='goal'` guard (`label:'0%'`, `:218`). |
| 2 | `completionStats` rounding + zero-total | yes | `:227` empty→`rate:0` (no `NaN`); `:231` asserts both rounding directions — 2/3→67, **1/6→17**, **5/6→83**; `:252` only `done` counts (`doing`/`cancelled`/`todo` are not done); `:262` all-done→100. |
| 3 | `itemCompletionStats` over a bounded window | yes | 7 cases `:271-319`: one-off inside (`:272`), one-off outside → all zeros (`:284`), inclusive window bounds 03-05..03-10 = 6 (`:290`), done share 3/6→50 (`:296`), `exceptions` drop (`:302`), `until` bound (`:308`), `interval: 3` (`:314`). Goes through the real `expandOccurrences`, not a stub. |
| 4 | All new tests pass via `npm run test` | yes | see §2. |

## 2. Gates — baseline green

```
$ npm run typecheck && npm run lint && npm run test
tsc --noEmit            → exit 0, no diagnostics
eslint .                → exit 0, no output
vitest run (v4.1.11)    → Test Files 12 passed (12) | Tests 93 passed (93) | 6.53s
```

93 = 62 at HEAD + 31 new. `npx prettier --check src/domain/stats.test.ts` → clean.

## 3. Non-overlap with IMP-001's `habitStreak` cases

`grep -n habitStreak src/domain/stats.test.ts` returns only line 6 (import) and lines
44–73 (the pre-existing IMP-001 block). Zero new cases inside `describe('habitStreak')`;
all new fixtures/cases live in `describe('goalProgress' | 'completionStats' |
'itemCompletionStats' | 'activeDayStreak' | 'overallCompletion')` at lines 135–372. The
report states a drafted `habitStreak` non-habit case was deliberately removed — consistent
with the diff. **No duplication.**

## 4. Determinism (no real clock / no timezone coupling)

- No `new Date()` (no-arg) anywhere in the file → `today` is always passed explicitly
  (`habitStreak(item, new Date(...))`, `activeDayStreak(items, today)`), so the
  `today = new Date()` defaults in `stats.ts:47,140` are never exercised.
- All fixtures use local `new Date(y, m, d)` or `parseLocalDate(key)`; no
  `toISOString()` for date keys (AGENTS.md rule).
- `Date.now()` appears once, at `stats.test.ts:39` inside the **pre-existing** `markDone`
  helper. It only fills `occurrences[key].completedAt`, which none of the new assertions
  read (`expandOccurrences` keys off `occKey`, `habitStreak` keys off `occKey`,
  `activeDayStreak` reads the key string) — inert.
- Timezone sweep, same 36 tests each time:

```
TZ=UTC                 → Tests 36 passed (36)
TZ=Pacific/Kiritimati  → Tests 36 passed (36)   (UTC+14)
TZ=Pacific/Midway      → Tests 36 passed (36)   (UTC-11)
TZ=Australia/Sydney    → Tests 36 passed (36)
```

## 5. Mutation check — 26 mutations, 23 caught / 3 missed

Each mutation was applied to `src/domain/stats.ts` (or, for one probe, `recurrence.ts`),
`npx vitest run src/domain/stats.test.ts` executed, then the file was restored.

**Caught (test suite failed):**

| # | Mutation | Failing new tests |
| --- | --- | --- |
| M01 | `goalProgress` percent `Math.round`→`Math.floor` | 2 (numeric rounding, checklist 67) |
| M02 | drop `Math.min(100, …)` clamp | 1 (over-target 12/8→100) |
| M03 | drop `target === 0 ? 0` divide guard | 1 (zero numeric target → `NaN`) |
| M04 | `metric.target ?? 1`→`?? 2` | 1 (omitted target fallback) |
| M05 | `children.length \|\| 1`→`\|\| 0` | 1 (zero-children checklist) |
| M06 | binary drops `\|\| goal.completedAt` | 1 (completedAt-only binary) |
| M07 | checklist filter drops `\|\| c.completedAt` | 1 (2/3 checklist) |
| M08 | remove `kind !== 'goal'` guard | 1 (non-goal item) |
| M09 | drop `unit` from label | 2 (numeric + checklist unit) |
| M11 | `completionStats` drop zero-total guard | 3 (empty list → `NaN`) |
| M12 | `completionStats` `Math.round`→`Math.floor` | 2 (17 and 83) |
| M13 | count `status !== 'cancelled'` as done | 4 |
| M14 | `total` = count of done only | 8 |
| M15 | `itemCompletionStats` ignore `[from,to]` (2000→2030) | 5 |
| M16 | `overallCompletion` pool only first item | 1 (pooling across items) |
| M17 | `activeDayStreak` ignore `item.completedAt` | 1 (one-off completed on day) |
| M18 | streak steps back 2 days | 2 |
| M20 | percent `Math.round`→`Math.trunc` | 2 |
| M23 | streak loop cap `1000`→`0` | 3 |
| M25 | *(probe, `recurrence.ts`)* `day < fromDay`→`<=` | 6 (proves the window cases are real, not tautological) |

**Missed (suite stayed green) — all three are gaps outside the stated ACs, none make a
required assertion vacuous:**

1. `let current = metric.current ?? 0` → `?? 7` (`stats.ts:123`) is never observed: the
   omitted-`current` numeric fixture (`stats.test.ts:160`) passes `current: 0` explicitly,
   and checklist/binary overwrite `current` anyway. Minor: the `?? 0` default has no test.
2. `if (state.status === 'done') doneDays.add(key)` → add unconditionally
   (`stats.ts:145`): no fixture ever stores a **non-done** entry in `item.occurrences`
   (`markDone` only writes `status:'done'`), so this filter is untested. Minor.
3. `activeDayStreak`'s `startOfDay(today)` → `today` (`stats.ts:149`): every `today`
   argument is already local midnight, so the normalization is a no-op in tests. Minor;
   a `new Date(2024, 2, 10, 15)` `today` case would pin it.

**Pre-existing gap, not this item's:** M24 — mutating `habitStreak`'s
`best = Math.max(best, current)` (`stats.ts:106`) left all 36 tests green, so that line is
not pinned by IMP-001's cases either. Out of IMP-006 scope; flag for a future streak item.

## 6. Tautology / implementation-hardcoding audit

No tautologies found. Every assertion is a literal expectation computed by hand from the
fixture (38, 67, 17, 83, 25, 100, `2/3`, `0/1`, `12/8`, total counts 6/5/6/4) and none is
derived by calling a `stats.ts` function. The rounding cases deliberately use hand-built
`Occurrence` literals (`:103`) so `17`/`83` are asserted without routing through the
recurrence engine — a defensible choice, not a re-implementation. Fixtures are built with
the real `createItem` and a real `RecurrenceRule`, so no assumption about `stats.ts`
internals is baked into the expectations.

## 7. Issues

1. *(minor, non-blocking)* `src/domain/stats.ts:123` `metric.current ?? 0`, `:145`
   `state.status === 'done'`, and `:149` `startOfDay(today)` are not pinned by any new
   case — see mutation misses 1–3. Optional follow-up; none contradict an AC.
2. *(minor, docs)* `impl-IMP-006.md` says "37 tests in that file" (actual: **36**) and
   "goalProgress — 12 cases" (actual: **13**); the "+31 new" figure is correct.
3. *(process)* `.improve/PROGRESS.log` carries an uncommitted **IMP-005** row; it should be
   reconciled with the IMP-005 commit rather than attributed to IMP-006.

None of these blocks acceptance: all four acceptance criteria are met, production code is
untouched, the suite is deterministic across four timezones, and 23 of 26 mutations —
including every branch the ACs name — are caught.