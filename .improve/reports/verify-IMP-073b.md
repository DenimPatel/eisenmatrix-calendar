# Verify — IMP-073b (independent re-verification)

**Verifier:** fresh, independent; did not write the change
**Branch:** `improve/auto-20261017` (working tree, HEAD `ad61d18`)
**Date:** 2026-10-17
**VERDICT: PASS**

## Criteria

| # | Criterion | Result |
|---|---|---|
| 1 | `gym fri 7am`, `gym fri at 7am`, `gym fri tomorrow`, `gym fri next week`, trailing punctuation keep HEAD title/date (Friday, parsed time/relative date) | **Met** |
| 2 | `gym every week #fitness fri` keeps title `Gym`, today's start, weekly `byWeekday: [5]` and the tag (also timed variant) | **Met** |
| 3 | IMP-073 (a) `gym every fri` -> `Gym`, weekly `[5]`; (b) `sun the tomatoes fri` -> no schedule weekday left, Friday date; (c) non-hint lone weekdays retained and not re-dated | **Met** (AC2/AC3 contradiction unchanged: `Sun` is retained by AC3) |
| 4 | IMP-010/011 controls unchanged (`gym fri`, `call mon`, `mon/wed/fri`, `next fri`, every `on the <N>` form) | **Met**, byte-identical to HEAD |
| 5 | No new over-consumption/title truncation; existing gates still pass | **Met** |

## Independent parser probe (new + HEAD side by side, 80+ inputs)

Both parsers imported into one temporary Vitest file; `now = 2024-06-10T12:00`.

| input | parser | title | start | recurrence |
|---|---|---|---|---|
| `gym fri 7am` | new / HEAD | `Gym` / `Gym` | `2024-06-14T07:00` | null |
| `gym fri at 7am` | new / HEAD | `Gym at` / `Gym at` | `2024-06-14T07:00` | null |
| `gym fri tomorrow` | new / HEAD | `Gym` | `2024-06-14` | null |
| `gym fri next week` | new / HEAD | `Gym` | `2024-06-14` | null |
| `gym fri!` / `.` / `,` / `?` / `;` / `…` | new = HEAD | `Gym !` etc. (punctuation retained; HEAD parity) | `2024-06-14` | null |
| `gym fri 7am!` | new = HEAD | `Gym !` | `2024-06-14T07:00` | null |
| `gym fri in 2 days` / `gym fri 2024-06-21` | new = HEAD | `Gym` | `2024-06-14` / `2024-06-21` | null |
| `gym every week #fitness fri` | new = HEAD | `Gym` | `2024-06-10` | weekly `[5]`, tag `fitness` |
| `gym every week #fitness fri 7am` | new = HEAD | `Gym` | `2024-06-10T07:00` | weekly `[5]` |
| `gym every fri` | new / HEAD | `Gym` / `Gym every` | `2024-06-10` | weekly `[5]` |
| `sun the tomatoes fri` | new | `Sun the tomatoes` | `2024-06-14` | null |
| `sun the tomatoes` | new | `Sun the tomatoes` | `2024-06-10` | null |
| `sun` | new = HEAD | `''` | `2024-06-16` | null |
| `sat the interview` / `we wed in June` / `mon dieu` | new | retained word | `2024-06-10` | null |
| `check the wed report fri` | new | `Check the wed report` | `2024-06-14` | null |
| `gym fri` / `call mon` / `next fri` | new = HEAD | `Gym` / `Call` / `''` | `2024-06-14` / `2024-06-17` / `2024-06-14` | null |
| `mon/wed/fri` | new = HEAD | `''` | `2024-06-10` | weekly `[1,3,5]` |
| `party on the 5th` / `pay rent every month on the 5th` | new = HEAD | `Party` / `Pay rent` | `2024-07-05` / `2024-06-10` | null / monthly `[5]` |
| `standup tue and thu` | new = HEAD | `Standup` | `2024-06-10` | weekly `[2,4]` |

No new title truncation or schedule-token over-consumption. Residuals, all pre-existing
from the first attempt and documented in `impl-IMP-073b.md`:
`gym every week gym fri` still loses `byWeekday` (interposed word, out of scope);
`gym fri at 7am with Sam`, `gym fri at 7` and `fri 7am standup` retain `fri`
(AC3: weekday is not at end and tail is not purely schedule tokens).
The newly added `isScheduleTail` only changes pure-tail shapes and restores HEAD there.

## Mutation checks (independently reproduced, restored)

- `isScheduleTail` -> `false`: 2 failures (`lone weekday hint before trailing time/relative date`,
  `... before trailing punctuation`).
- `preRecurrence` -> `working` in the `everyWeekday` probe: 2 failures (tagged `every week`
  plain and timed).
- Post-restore checksum `39722fb1…` and diff unchanged.

## Gates

```
npm run typecheck   PASS
npm run lint        PASS
npm run test        PASS  33 files / 368 tests
npm run build       PASS  dist/sw.js, 18 precache entries (617.06 KiB)
npx prettier --check src/domain/quickadd.ts src/domain/quickadd.test.ts   PASS
git diff --check    clean
```

Temporary `__verify073*` modules and the mutation backup were removed; `git status` is back to
the two intended source files plus `.improve` orchestration/report files.

## Notes

- Strict reading of "title `Gym`" for `gym fri!` is `Gym !`; this is exactly HEAD and was not a
  regression in the prior verification (only the lost date was). No action required.
- AC2 vs AC3 wording contradiction remains; verification follows AC3 as before.
