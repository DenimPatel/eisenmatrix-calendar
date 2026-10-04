# verify-IMP-001 — Fix habit best streak across missed periods

Independent, skeptical verification. Reviewer did not author the change.
Commit under review: working tree on `improve/auto-20261003` (uncommitted).

## 1. Spec & acceptance criteria (`.improve/FEATURES.md` IMP-001)

1. `best` iterates every consecutive period (day/week/month per `target.per`)
   between earliest and latest tracked period, resetting on absent/below-count.
2. Jan done, Feb missed, Mar done ⇒ `best === 1`.
3. Two adjacent completed periods ⇒ correct consecutive run (no regression).
4. `current` streak behavior for an in-progress current period unchanged.

## 2. Scope / diff review

`git diff --stat`: only `src/domain/stats.ts` (20 insertions, 7 deletions).
`git diff --name-only`: `src/domain/stats.ts`. New untracked `src/domain/stats.test.ts`
(+5 cases). Other untracked entries are report/agent scaffolding (`.improve/reports/*`,
`.kilo/`) — not implementation.

- No scope creep, no unrelated files, no direct Dexie/localStorage, no date-key
  regression (`formatISODate`/`parseLocalDate` used consistently), dates local.
- No debug leftovers: `grep -nE "console\.(log|debug)|debugger|TODO|FIXME|XXX"`
  over both files → none.
- `git diff --check` → exit 0 (no whitespace errors).
- No secrets introduced.
- Style: single explanatory comment mirrors the pre-existing comment it replaces;
  consistent with AGENTS.md ("no comments unless non-obvious intent").

## 3. Gate results (baseline per REPO_PROFILE §3/§7 is green: 10 files / 49 tests)

```
$ npm run typecheck && npm run lint && npm run test
> tsc --noEmit            # PASS, no diagnostics
> eslint .                # PASS, no output
> vitest run
 Test Files  11 passed (11)
      Tests  54 passed (54)
   Duration  7.79s
```

No new failures. +1 test file / +5 tests vs the 10/49 baseline; the only warning is
the known benign `--localstorage-file` Node warning.

## 4. Verification method executed

Item method: "Add `src/domain/stats.test.ts` ... assert the Jan/Feb/Mar scenario and
an adjacent-completion scenario. Run `npm run test`." The committed test file contains
exactly these (stats.test.ts:31-43) plus three more; all pass.

Independent throwaway probes under `/tmp/verify-imp001.ts` (run via `npx tsx`, not
committed) importing the real `@/domain/stats` module — all PASS:

```
PASS daily missed day best: got=1 want=1
PASS daily 3 adjacent best: got=3 want=3
PASS month count2 adjacent best: got=2 want=2
PASS week sunday-start gap best: got=1 want=1        # weekStartsOn=0, one missed week
PASS month jan+apr best: got=1 want=1
PASS month jan+apr current: got=1 want=1
PASS unmet single best: got=0 want=0                 # count=3, only 1 done
PASS lastAt latest: got="2024-03-10" want="2024-03-10"
PASS 12 adjacent months best: got=12 want=12
```

## 5. Criterion-by-criterion findings

- **AC1 — MET.** `stats.ts:88-105`: keys sorted; scan runs from
  `parseLocalDate(keys[0])` to `parseLocalDate(keys[at-1])`, stepping one period via
  `nextPeriod` (`stats.ts:35-38`) and resetting `run = 0` whenever `complete()` is
  false. `complete` (`stats.ts:64`) yields false for absent periods (map get → 0).
- **AC2 — MET.** Spec scenario `['2024-01-10','2024-03-10']`, `today=2024-03-31`:
  `best === 1` (stats.test.ts:31-36 and /tmp probe). Old code returned 2.
- **AC3 — MET.** Adjacent-month case → `best === 2` (stats.test.ts:38-43); daily
  adjacent → 3 and 12 adjacent months → 12 in /tmp probes. No regression.
- **AC4 — MET.** `git diff` touches only the best-streak block; the `current` loop
  (`stats.ts:66-84`) is byte-identical and `best = Math.max(best, current)`
  (`stats.ts:106`) is retained. In-progress-period case still reports `current === 1`
  (stats.test.ts:57-62).

## 6. Edge-case / unrelated-behavior confirmation

- The reported defect (fully-missed periods skipped) is genuinely fixed: absent
  periods now reset the run for day, week and month granularities, including
  `weekStartsOn = 0`.
- `target.count` thresholds and `lastAt` are unaffected (probes above).
- No other stats function (`completionStats`, `activeDayStreak`,
  `overallCompletion`, `habitStreak.current`) was modified.

## 7. Minor non-blocking observations

- `nextPeriod` (`stats.ts:35-38`) selects `addMonths` for month via the falsy `step`
  (0). This is correct because the cursor is always a period start (`startOfMonth`),
  so no end-of-month clamp is ever needed; the impl report's phrasing about clamping
  is moot but harmless.
- Loop guard (`40000`) and monotonic stop (`next <= cursor`) prevent runaway loops; a
  daily habit over ~100 years stays well under the cap.

## Verdict

PASS. All four acceptance criteria met; gates green; edge case verified independently;
no scope creep, unrelated changes, style violations, debug leftovers or secrets.

## Evidence index

- `.improve/FEATURES.md:23` (spec), `.improve/reports/impl-IMP-001.md` (report)
- `src/domain/stats.ts:35-38,88-106` (change)
- `src/domain/stats.test.ts:31-62` (new tests)
- Commands: `git diff`, `git diff --check`, `npm run typecheck`, `npm run lint`,
  `npm run test`, `npx tsx /tmp/verify-imp001.ts`
