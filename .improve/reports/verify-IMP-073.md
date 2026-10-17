# Verify — IMP-073: Consume every schedule token in quick add; stop eating ordinary words

**Verifier:** independent; did not write the change
**Branch:** `improve/auto-20261017` (working tree, uncommitted; HEAD `ad61d18`)
**Date:** 2026-10-17
**VERDICT: PASS** (with two non-blocking regression/follow-up findings and one spec-wording defect)

## Scope reviewed

`git diff` against HEAD:

```
src/domain/quickadd.ts      | 54 ++++++++++++++++++++++++-------------
src/domain/quickadd.test.ts | 77 +++++++++++++++++++++++++++++++++++++++
.improve/FEATURES.md        |  2 +-   (TODO -> IN-PROGRESS)
.improve/PROGRESS.log       |  2 +-   (IMP-072 SHA backfill)
.improve/STATE.md           |  6 +++--- (orchestration)
```

- The weekday list is now matched with global `matchAll` and every group is decided from its own
  `before`/`after` context; consumed ranges are spliced in reverse index order.
- A lone weekday is consumed only when: it is preceded by `next` (deferred to the existing
  `next <weekday>` branch), preceded by `every`, belongs to a `every [N] week(s) [on] <weekday>`
  phrase, follows `on|at|start`, or ends the (current) working string. Otherwise it stays in the
  title and `loneWeekday` is not set.
- Multi-weekday groups still produce a weekly `byWeekday` rule.
- After a weekday recurrence exists, the first remaining `\bevery\b` is removed.
- No debug output, `console.*`, `debugger`, TODO/FIXME, new dependency, comment, or unrelated
  production edit. `git diff --check` clean; Prettier clean on both files.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | A leftover bare `every` is consumed once a weekday/`every <unit>` recurrence is established; `gym every fri` -> title `Gym`, weekly `byWeekday [5]` | **Met** | Independent probe: `Gym`, `2024-06-10`, `weekly interval 1 byWeekday [5]`. Preview: Title `Gym`, chip `every week on Fri`; created row in IndexedDB has `byWeekday: [5]`. Mutation (remove the `every` strip) fails the new test. |
| 2 | Every weekday group is consumed via a loop (not one `exec`); `sun the tomatoes fri` leaves no weekday token in the title | **Mechanism met; literal example not met** | The loop consumes the trailing `fri` group (`matchAll` + all groups; mutation `slice(0,1)` fails the second-group test). But `sun the tomatoes fri` yields title `Sun the tomatoes`: `Sun` is retained because AC3 explicitly requires a non-hint lone weekday to stay. The added test only asserts `not /\bfri\b/i`, not `not /\b(sun|mon|...)\b/i`. AC2 and AC3 are **mutually contradictory** for this exact input; the implementation follows the stricter AC3 gate, which this verification also treats as authoritative. Recommend amending AC2 to "no leftover *schedule* weekday token". |
| 3 | A lone weekday is consumed as a date hint only at end-of-input or immediately after `on|every|at|start`; otherwise it stays and the item is not re-dated | **Met** | Gate inspected at `quickadd.ts:237-249`. Probes: `sat the interview`, `we wed in June`, `mon dieu`, `check the wed report fri` (only trailing `fri`) keep the ordinary word and `start` stays `2024-06-10`; `sun the tomatoes` stays today. Triggers: `call on fri`, `call at fri`, `call start fri` consume `fri`, date `2024-06-14`. End-of-input: `sun`, `sat`, `mon` each re-date to that weekday. `next` is correctly excluded and handled by the existing branch. The extra `weeklyEvery` path only fires for the weekday captured immediately after `every [N] week(s)`, i.e. semantically after `every`. No path re-dates a non-hint weekday. |
| 4 | IMP-010/011 verified cases unchanged: `gym fri`, `call mon`, `mon/wed/fri`, `next fri`, every `on the <N>` case | **Met** | Independent outputs (now = 2024-06-10 Mon): `gym fri` -> `Gym` / 2024-06-14 / null; `call mon` -> `Call` / 2024-06-17 / null; `mon/wed/fri` -> title `''` / 2024-06-10 / weekly [1,3,5]; `next fri` -> `''` / 2024-06-14 / null; `party on the 5th` -> `Party` / 2024-07-05 / null; `pay rent every month on the 5th` -> `Pay rent` / 2024-06-10 / monthly byMonthDay [5]; `party on the 31st` from 2024-04-20 -> 2024-04-30. All match HEAD. |

## Independent parser execution

Temporary Vitest probe (`src/domain/__verify-073.test.ts`, removed afterwards) imported
`parseQuickAdd` and dumped the results; a second probe compared the new parser against
`git show HEAD:src/domain/quickadd.ts` over a 58-input corpus.

Required repros/controls:

| input | title | start | recurrence |
|---|---|---|---|
| `gym every fri` | Gym | 2024-06-10 | weekly byWeekday [5] |
| `sun the tomatoes fri` | Sun the tomatoes | 2024-06-14 | null |
| `sun the tomatoes` | Sun the tomatoes | 2024-06-10 | null |
| `sun` | (empty) | 2024-06-16 | null |
| `gym fri` | Gym | 2024-06-14 | null |
| `call mon` | Call | 2024-06-17 | null |
| `mon/wed/fri` | (empty) | 2024-06-10 | weekly [1,3,5] |
| `next fri` | (empty) | 2024-06-14 | null |
| `party on the 5th` | Party | 2024-07-05 | null |
| `pay rent every month on the 5th` | Pay rent | 2024-06-10 | monthly byMonthDay [5] |
| `call on fri` / `call at fri` / `call start fri` | Call on / Call at / Call start | 2024-06-14 | null |
| `gym every week fri 7am` | Gym | 2024-06-10T07:00 | weekly [5] |
| `gym every 2 weeks fri` | Gym | 2024-06-10 | weekly interval 2 [5] |
| `gym every fri 7am` | Gym | 2024-06-10T07:00 | weekly [5] |
| `sat the interview` | Sat the interview | 2024-06-10 | null |
| `we wed in June` | We wed in June | 2024-06-10 | null |
| `mon dieu` | Mon dieu | 2024-06-10 | null |
| `check the wed report fri` | Check the wed report | 2024-06-14 | null |
| `standup tue and thu` | Standup | 2024-06-10 | weekly [2,4] |
| `gym next fri 7am` | Gym | 2024-06-14T07:00 | null |
| `review the every thing` | Review the every thing | 2024-06-10 | null |

Additional ordinary-word/trailing-hint checks are consistent with AC3: a non-final
`sat`/`wed`/`mon` is preserved; a final one is treated as a date hint. The inherent ambiguity
(`we sat` -> title `We`, date Saturday) is exactly the end-of-input rule AC3 mandates.

## Differential sweep vs HEAD (outside the listed controls)

All AC4 controls are byte-identical. Differences found, classified:

**Intended (the three reported shapes):**
`gym every fri`, `gym every fri 7am`, `every fri`, `task:/event: … every fri` lose the stray
`every`; `sun the tomatoes`, `sun the tomatoes fri`, `sat the interview`, `we wed in June`,
`mon dieu` keep ordinary words and stop re-dating; `gym fri!`/`gym fri.` now keep the whole
title but no longer date (see finding 1).

**Side effects not covered by the new tests:**
- `gym fri 7am`: HEAD `Gym` / Friday 07:00 / null -> now `Gym fri` / today 07:00 / null.
  Same for `gym fri at 7am`, `gym fri tomorrow`, `gym fri next week`. Cause: the
  `after.trim() === ''` gate runs before time/relative-date parsing, so a trailing time or
  relative date makes the weekday "non-final". This follows the literal AC3 wording
  ("ends the input") and the brief's "must not re-date otherwise", but it is a usability
  regression for a natural form (`gym fri 7am`) and is not listed in the impl report's
  uncertainties. Actionable: move time extraction before the weekday gate (fixes the
  `7am` forms) or define end-of-input as "followed only by other schedule tokens"; add tests.
- `gym every week #fitness fri`: HEAD weekly `byWeekday [5]`, start today -> now weekly with no
  `byWeekday`, start Friday. `everyWeekday` is matched against raw `input` (`:210-213`) and
  requires adjacency, but tags/amounts were already removed from `working`; `#fitness` breaks
  the match, so `fri` is downgraded to a date hint. `gym every week gym fri` and
  `gym every week gym fri 7am` behave the same way. Actionable: run the `everyWeekday` probe on
  the post-tag/pre-recurrence working string, or derive it before removing `every week`; add a
  test with an interposed tag/word.
- `gym every day fri`: HEAD daily + `byWeekday [5]`, now daily with no weekday, start Friday.
  `byWeekday` on a daily rule was arguably meaningless; the new result is more coherent and
  consistent with AC3. Not flagged.

## Mutation checks (independently reproduced, each restored)

1. Remove `working.replace(/\bevery\b/i, ' ')` -> 1 failure:
   `consumes a bare "every" once a weekday recurrence is established`.
2. `matchAll(...).slice(0, 1)` -> 1 failure:
   `consumes a second weekday group while retaining a non-hint lone weekday`.
3. Bypass `if (!isHint) continue;` -> 2 failures: the second-group test and
   `leaves a lone weekday in the title and date when it is not a hint`.

Post-restore targeted run: 31/31 pass; diff stat unchanged.

## Gates

```
npm run typecheck   PASS  (tsc --noEmit, no diagnostics)
npm run lint        PASS  (eslint ., no output)
npm run test        PASS  33 files / 365 tests (360 baseline + 5 new)
npm run build       PASS  tsc + vite build; dist/sw.js, 18 precache entries (616.69 KiB)
npx prettier --check src/domain/quickadd.ts src/domain/quickadd.test.ts   PASS
```

The impl report's "(baseline 365; five new cases replace none)" is inaccurate: the pre-change
baseline was 360 (IMP-072 verify + STATE), so the five tests take it to 365.

## Browser check (`npm run preview`, port 4173)

- Known stale-SW caveat reproduced: the first load was still the old bundle
  (`assets/index-CKMAQt79.js`) and showed the old preview (`Gym every`). After unregistering
  the SW, deleting caches, and reloading through a CDP cache-disabled session with a
  cache-busting query, the document loaded `assets/index-DePsNbjf.js` (this build).
- With the fresh bundle, `C` -> Quick add -> typed `gym every fri`:
  Title `Gym`; chips `task`, `2026-10-17`, `every week on Fri`; Add enabled.
- Enter created the item (`Added "Gym"` toast). IndexedDB row:
  `title: "Gym"`, `start: "2026-10-17"`, `recurrence: {freq:"weekly", interval:1, weekStartsOn:1,
  byWeekday:[5], exceptions:[], overrides:{}}`.
- Console after the fresh load and the create: **0 errors / 0 warnings**. (The stale load was
  also console-clean; the "A new version is available" banner is the known SW-update caveat.)
- `.playwright-mcp/` artifacts and the temp probes were removed; `git status` is back to the
  intended two source files plus `.improve` orchestration/report files.

## Findings / follow-ups (non-blocking)

1. **`gym fri 7am` and similar suffix forms no longer date.** `gym fri 7am` -> `Gym fri`,
   today; `gym fri at 7am` -> `Gym fri at`, today. This is a direct consequence of the AC3
   gate checked before time parsing. The AC is met literally, but this is the most likely
   real-user regression and should be resolved by spec amendment or a follow-up
   (time-before-hint ordering). `gym fri tomorrow` / `gym fri next week` also keep `fri`.
2. **A weekday separated from `every week` by a tag or word loses its `byWeekday`**
   (`gym every week #fitness fri`, `gym every week gym fri`). Low frequency but a real
   behavior loss; the raw-input `everyWeekday` probe is the cause and the fix is small.
3. **AC2 vs AC3 contradiction.** `sun the tomatoes fri` cannot both retain `sun` (AC3) and
   leave no weekday token (AC2). The implementation and this verification follow AC3. Amend
   AC2's wording (and ideally pin `sun`'s retention explicitly in the test) before marking the
   item DONE.
4. Trigger words remain in the title: `call on fri` -> `Call on`, `gym at fri` -> `Gym at`,
   `call start fri` -> `Call start`. This is explicitly allowed by the item notes ("nothing here
   trims a preposition"), and the new test only asserts the weekday is absent; note as UX
   oddity, not a defect.
5. Process: `FEATURES.md` is still `IN-PROGRESS` and no DONE note was added; the impl report
   deliberately left it untouched. The coordinator should update status/notes only after the
   AC2 wording is resolved.

## Suggested health deltas

| Dimension | Current | Suggested | Rationale |
|---|---|---|---|
| Bugs/Correctness | 4 | 4 (hold; +0.2 credit) | Fixes the three reported token leaks with a well-scoped gate and mutation-proven tests; leaves the time-suffix form and the `every week <tag> fri` attachment as documented residuals. |
| Tests/Tooling | 4 | 4 (hold; +0.15) | +5 focused tests including the AC4 guard and three mutation-sensitive cases; no test yet for `gym fri 7am` or `every week <tag> fri`. |
| UX/Interaction | 3 | 3 (hold) | Ordinary-title words are no longer eaten/re-dated, but `gym fri 7am` now silently fails to schedule and trigger words remain in titles. |

## Files produced

- `.improve/reports/verify-IMP-073.md` (this file)
