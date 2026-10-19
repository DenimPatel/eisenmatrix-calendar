# discovered-IMP-139 — unrelated findings

## `RecurrenceRule.overrides` is not partitioned by `splitSeries`

`src/domain/recurrence.ts` (`splitSeries`) spreads the whole rule (`...rule`) onto both the
head and the tail, so `rule.overrides` (keyed by occurrence key, like `occurrences`) is
copied wholesale onto both rows: the head keeps override keys `>= K` it can no longer
expand (dead), and the tail keeps keys `< K` it never expands. This is the same class of
"per-occurrence map not partitioned" bug just fixed for `occurrences`, but for the
`overrides` map. `exceptions` (IMP-023) is the tracked sibling; no item currently covers
`overrides`. Not fixed here to keep IMP-139 scoped and because the task said not to attempt
IMP-023's head-exception copying.
