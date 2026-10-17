# IMP-073b — Regression fixes (attempt 2)

**Status:** done. Verifier PASS stands; the two findings are fixed and pinned by tests.

## Files changed (this attempt)

| File                          | Change                                                                                                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/quickadd.ts`      | Added `TAIL_SCHEDULE_RE` / `isScheduleTail()`: a lone weekday now counts as a hint when everything after it is only schedule tail tokens (time, `at <time>`, `today/tomorrow/tmr/tonight`, `next week/month`, `in N days/weeks/months`, ISO date) plus punctuation. `everyWeekday` is matched against `preRecurrence` (post tag/flag/quantity/prefix stripping) instead of raw `input`. |
| `src/domain/quickadd.test.ts` | Three regression tests: time/relative tails, trailing punctuation, and a tagged `every week` weekday (plain and timed).                                                                                                       |

## Defect 1 — time/tail before the lone-weekday gate

`isScheduleTail(after)` is evaluated in the hint gate alongside `after.trim() === ''`. It removes
recognised schedule tokens and punctuation from the tail; only an empty remainder keeps the
weekday as a hint. This restores HEAD for the suffix forms without reordering unrelated parsing:

| input                  | title   | start               | recurrence |
| ---------------------- | ------- | ------------------- | ---------- |
| `gym fri 7am`          | `Gym`   | `2024-06-14T07:00`  | null       |
| `gym fri at 7am`       | `Gym at`| `2024-06-14T07:00`  | null       |
| `gym fri tomorrow`     | `Gym`   | `2024-06-14`        | null       |
| `gym fri next week`    | `Gym`   | `2024-06-14`        | null       |
| `gym fri!` / `.` / `,` | `Gym !` etc. | `2024-06-14`   | null       |
| `gym fri 2024-06-21`   | `Gym`   | `2024-06-21`        | null       |

All match HEAD byte-for-byte (probe below). Non-final lone weekdays (`gym fri report`) keep their
AC3 behaviour.

## Defect 2 — tagged `every week` weekday

`everyWeekday` now runs on the snapshot taken after tags/flags/quantities/amounts/kind-prefix
removal and before recurrence tokens are stripped, so `#fitness` no longer breaks adjacency.
`gym every week #fitness fri` → title `Gym`, start today, weekly `byWeekday: [5]`, tag retained;
the `7am` variant → today 07:00, weekly `[5]`. Both equal HEAD. The interposed-word form
`gym every week gym fri` remains unchanged (out of scope for this fix).

## Differential sweep vs HEAD

Temporary Vitest harness imported `git show HEAD:src/domain/quickadd.ts` and compared a 67-input
corpus (AC4 controls, IMP-010/011 cases, the five fixed shapes, all new suffix/tag shapes, and
ordinary-word probes). Result: 14 diffs, all in the intended categories:

- bare `every` consumed: `gym every fri`, `every fri`, `task: gym every fri`;
- second group / non-hint lone weekday: `sun the tomatoes [fri]`, `sat the interview`,
  `we wed in June`, `mon dieu`, `check the wed report fri`, `gym fri report`,
  `gym the fri report`, `gym friday fri`;
- weekly weekday on a non-weekly rule (`gym every day fri`, `gym every month fri`) — previously
  flagged by the verifier as the more coherent AC3 outcome.

All AC4 controls (`gym fri`, `call mon`, `mon/wed/fri`, `next fri`, `on the 5th` forms) and every
new regression shape are byte-identical to HEAD. Harness removed afterwards.

## Gates

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS, 33 files / 368 tests (365 + 3)
- `npx prettier --check src/domain/quickadd.ts src/domain/quickadd.test.ts` — PASS

## Notes

- No changes to `.improve/FEATURES.md`, no commit.
- `isScheduleTail` intentionally accepts only recognised tail tokens, so arbitrary trailing prose
  (`gym fri at 7am with Sam`) still keeps `fri` under AC3; that shape was not in the reported
  regression set and diverges from HEAD by title only.
- Mutation sanity: removing either the `isScheduleTail` clause or the `preRecurrence` snapshot
  fails the corresponding new test.
