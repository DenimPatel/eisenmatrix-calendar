# impl-IMP-006 — Unit tests for `stats.ts` goal progress, completion, and streaks

## Files

- `src/domain/stats.test.ts` (modified): 31 new cases in 5 new `describe` blocks appended
  after the existing `habitStreak` block; import list extended with `goalProgress`,
  `completionStats`, `itemCompletionStats`, `overallCompletion`, `activeDayStreak` and the
  fixture types (`GoalData`, `GoalItem`, `ItemStatus`, `Occurrence`, `OccurrenceStatus`,
  `RecurrenceRule`, `TaskItem`) plus `parseLocalDate` from `@/lib/date`.
- `.improve/reports/impl-IMP-006.md` (this file),
  `.improve/reports/discovered-IMP-006.md` (new).
- `.improve/FEATURES.md`: **not** modified — the orchestrator owns item status.
- No production file changed (`git status`: only `src/domain/stats.test.ts` +
  `.improve/PROGRESS.log`).

## Approach

Pure fixtures only — no Dexie, no fake-indexeddb, no store, no network. Every case builds
items with `createItem` and mutates the plain object, so the tests exercise `stats.ts`
through its real inputs (`expandOccurrences` included) without a browser. Three new helpers:

- `makeGoal(metric, status)` — a goal whose `data.metric` is supplied verbatim, so each
  `metric.type` branch is driven explicitly.
- `makeChild(goal, title, done)` — a task with `parentId` set and one of the three ways a
  checklist child can count as done (`status === 'done'`, `completedAt` only, neither);
  this is what proves the `c.status === 'done' || c.completedAt` disjunction.
- `occurrence(item, key, status)` — a hand-built `Occurrence` for the pure `completionStats`
  cases (17% and 83% need exactly 1/6 and 5/6 done; building them via a recurrence would make
  the rounding cases indirect).

Recurrence-dependent cases use `dailyTask(start, rule)` + the pre-existing `markDone`, so
`itemCompletionStats`/`overallCompletion` go through the real `expandOccurrences` windowing.
Every date is built with `new Date(y, m, d)` (local), never `toISOString()`, per AGENTS.md.

Non-overlap with IMP-001: the five existing `habitStreak` cases are untouched and no new case
was added inside that `describe`. I did draft a `habitStreak` non-habit guard case and
**removed it** — that function is explicitly out of this item's scope, so it belongs to
IMP-001's file, not this set. The new cases cover the other five exports.

## Acceptance criteria

1. **`goalProgress` for `numeric`, `binary`, `checklist`, incl. `target = children.length || 1`**
   — 12 cases. Numeric: rounding (3/8 → 38), no-unit label (`3/4`), 100% clamp
   (12/8 → 100), `target ?? 1` fallback, `target === 0` divide guard. Binary: `status:'done'`
   wins over `metric.current`, `metric.target` ignored, `completedAt` without `status`,
   untouched metric. Checklist: target from children length with mixed done signals
   (2/3 → 67), unit appended, and the zero-children case where `children.length || 1`
   forces `target: 1` even though the metric carries `current: 4, target: 9` (i.e. the
   metric is fully ignored). Plus the `kind !== 'goal'` guard, whose label is `'0%'` — a
   different shape from every real goal.
2. **`completionStats` rate rounding and zero-total** — 4 cases: empty list → `rate: 0`
   (no `NaN`); `2/3 → 67`, `1/6 → 17`, `5/6 → 83` (both rounding directions, since
   `Math.round` is not symmetric); only `done` counted (`doing`/`cancelled`/`todo` are not);
   all-done → 100.
3. **`itemCompletionStats` over a bounded window** — 7 cases: one-off inside the window,
   one-off outside it (→ all zeros), inclusive window bounds, done share of a daily series,
   `exceptions` exclusion, `until` bound, and `interval: 3`.
4. **All new tests pass via `npm run test`** — yes (see Verification).

## Verification

- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (no output; `@typescript-eslint/no-explicit-any` is off, and the
  file uses only `as` downcasts to `GoalItem`/`TaskItem`, matching IMP-001's `as HabitData`).
- `npm run test` — exit 0: **12 files / 93 tests passed** (62 before this change, +31; the
  5 IMP-001 streak cases are the only `habitStreak` tests and still pass).
- `npx vitest run src/domain/stats.test.ts --reporter=verbose` — 37 tests in that file, all
  green.
- `npx prettier --write src/domain/stats.test.ts` run before the gates (line-wrap only).

Two initial failures were **my arithmetic in the fixtures**, not product bugs: I first
expected `overallCompletion` over a 5-day window of a daily series to total 5 when the window
was 03-01..03-05 → 5 occurrences plus a one-off = 6 total / 4 done = 67%, and I used a
series starting 2024-01-01 to assert an empty window (a daily series has no empty window
there). Corrected in the fixtures; no production file was touched.

## Notes / uncertainties

- `discovered-IMP-006.md` records one cosmetic oddity (`goalProgress` appends the metric
  `unit` to checklist labels, where `current`/`target` are child counts rather than the
  unit's magnitude) and the deliberate `binary` fractional-`current` behaviour, which reads as
  a quirk but is consistent and clamp-protected. Neither is fixed here.
- The `goalProgress` non-goal guard returns a differently shaped label (`'0%'` vs
  `'current/target'`) — asserted as-is so a future refactor has to be deliberate.
- Not committed, per run instructions.
