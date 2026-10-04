# discovered-IMP-006 — observations while testing `src/domain/stats.ts`

No blocking bug was found. All 31 new cases pass against current behaviour, and **no
production code was changed**. The following are recorded so a future item can decide
whether they are worth changing.

## 1. `goalProgress` appends the metric `unit` to checklist labels (cosmetic)

`src/domain/stats.ts:126-136`. For `metric.type === 'checklist'` the function overwrites
`current`/`target` with _counts of children_ but still appends `metric.unit`:

```
makeGoal({ type: 'checklist', unit: 'steps' }) + 2 children, 1 done
→ { current: 1, target: 2, percent: 50, label: '1/2 steps' }
```

The unit belongs to the goal's own metric ("run 30 km"), not to the number of finished
checklist items, so a Goals card can display a unit that does not describe the fraction.
`percent` is unaffected. Fixing it would mean only appending the unit in the `numeric`
branch — a label-only change. Left as-is; the behaviour is pinned by the test
`goalProgress > appends the unit to a checklist label`.

## 2. `binary` metrics accept a fractional `current` and jump straight to 100%

`src/domain/stats.ts:130-132`: for `binary`, `target` is forced to `1` and `current` is
`goal.status === 'done' || goal.completedAt ? 1 : (metric.current ?? 0)`. A goal with
`metric: { type: 'binary', current: 1 }` and no completion therefore reports `1/1` = 100%
while `status` is still `todo`. The percent is safe (`Math.min(100, …)` at `:134`), so this
is a cosmetic 0-or-100 display for what is meant to be a boolean metric, not a crash or a
range error. If the editor never writes a `current` for `binary` (it does not by default —
`defaultDataFor('goal')` is `{ metric: { type: 'binary' }, horizon: 'month' }`), the branch
is unreachable in practice. Pinned by `goalProgress > ignores the numeric target of a
binary metric`.

## 3. `goalProgress` returns a differently shaped result for a non-goal item

`src/domain/stats.ts:119-121` returns `{ current: 0, target: 1, percent: 0, label: '0%' }` —
the label is a percentage while every real goal returns `current/target`. Harmless today
(the only caller is Goals), and asserted as-is in
`goalProgress > returns a zeroed result for a non-goal item` so a future refactor is a
conscious change rather than an accident.

## Not bugs (checked, expected)

- `completionStats` rounds rather than truncates (`2/3 → 67`), which is the intended
  percentage display; both directions of rounding are now covered.
- `itemCompletionStats` / `overallCompletion` count a window's occurrences including the
  `from` and `to` days (inclusive), consistent with `expandOccurrences`' documented
  `[from, to]` contract in `src/domain/recurrence.ts`.
- An unbounded window on an infinite `daily` rule is bounded by the supplied `to` date, so
  there is no runaway expansion in the tested paths.
