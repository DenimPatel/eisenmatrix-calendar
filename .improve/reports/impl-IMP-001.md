# impl-IMP-001 — Fix habit best streak across missed periods

## Status: done

## Files changed
- `src/domain/stats.ts` — added `nextPeriod()` helper; rewrote the best-streak
  scan to iterate every consecutive period between the earliest and latest
  tracked period.
- `src/domain/stats.test.ts` (new) — 5 `habitStreak` cases.

## Approach
The old best-streak loop iterated only `doneByPeriod` keys, so a fully-missed
period (absent from the map) was skipped instead of resetting `run`, inflating
`best` (Jan + Mar with no Feb reported 2).

`nextPeriod(date, per, weekStartsOn)` advances a period start by one
day/week/month (month uses `addMonths` to preserve end-of-month clamping).
The best scan now walks from `parseLocalDate(keys[0])` to
`parseLocalDate(keys[at end])`, stepping one period at a time and calling the
existing `complete(key)` check. Any period that is absent or below
`target.count` resets `run`. A guard cap (40000) prevents runaway loops.

The `current` streak loop is untouched, so criterion 4 is preserved. The
existing `best = Math.max(best, current)` is retained.

## Acceptance criteria
1. Best iterates every consecutive period per `target.per`, resetting on absent
   or below-count periods — done.
2. Jan/Feb/Mar miss scenario reports `best === 1` — covered by test
   "resets the best run across a fully-missed month".
3. Adjacent completed periods report the correct run — covered by
   "keeps the run across adjacent completed months" (`best === 2`).
4. `current` behavior for an in-progress period unchanged — covered by
   "does not break the current streak on an in-progress period".

## Commands run
- `npm run typecheck` → PASS, no diagnostics.
- `npm run lint` → PASS, no output.
- `npm run test` → PASS, 11 files / 54 tests (baseline 10 / 49; +5 new tests).
  Benign pre-existing warning `--localstorage-file ...` unchanged.

## Uncertainties
- "Tracked period" is interpreted as periods present in `doneByPeriod` (i.e.
  periods with at least one done occurrence), since a period with no done
  occurrence has no data to track. Iteration therefore starts at the earliest
  done period and ends at the latest done period; trailing all-missed periods
  after the last completion cannot increase `best`.
- `npm run build` was not run; the item's verification method specifies
  `npm run test`, and typecheck/lint/tests all pass.
