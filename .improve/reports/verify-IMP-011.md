# Verify — IMP-011 — Keep "on the 5th" when not monthly (or don't strip it)

- **Item:** `### IMP-011` (`.improve/FEATURES.md:205-219`)
- **Implementation report:** `.improve/reports/impl-IMP-011.md` · **Discovery:** `.improve/reports/discovered-IMP-011.md`
- **Reviewed state:** uncommitted working-tree change on `improve/auto-20261003` (HEAD `35d4352`)
- **Verdict:** **PASS** — 3/3 acceptance criteria met; 0 blocking defects, 5 advisories, 1 report inaccuracy
- **Reviewer:** independent reviewer (did not author the change)
- **Date:** 2026-10-04

---

## 1. Change surface

| File                          | Change                                                                                                                    | LOC      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/domain/quickadd.ts`      | new module-local `nextMonthDay()`; deferred `on the <N>` consumption via `monthDayApplied`; new no-recurrence date branch | +34 / −3 |
| `src/domain/quickadd.test.ts` | 3 new `it` blocks in `describe('parseQuickAdd')`                                                                          | +26      |
| `.improve/PROGRESS.log`       | 1 bookkeeping line — for **IMP-010**, not IMP-011 (advisory A5)                                                           | +1       |

`git diff --stat` → `3 files changed, 58 insertions(+), 6 deletions(-)`. No other module, dependency,
schema, `src/db/`, or UI file touched. Consumer scan confirms one UI consumer
(`src/features/quickadd/QuickAdd.tsx`) which re-parses on every keystroke, so the chips/preview
reflect the new date without any UI change (as the impl report states).

Diff matches the backlog's stated file list (`FEATURES.md:207` → `quickadd.ts`; `:212` → test file).

### 1.1 Hygiene

- **Debug leftovers: none.** No `console.*`, `debugger`, `TODO`, `FIXME` anywhere in the diff.
- **Secrets: none.** No key/token/credential material; no `.env*` touched (REPO_PROFILE §6).
- **Style:** `npx prettier --check src/domain/quickadd.ts src/domain/quickadd.test.ts` →
  `All matched files use Prettier code style!`
- **Dates:** new helper builds dates with the local `new Date(y, m, d)` constructor and formats with
  `formatISODate` (`src/lib/date.ts:25`); **no `toISOString()`** — REPO_PROFILE §5 / AGENTS.md §Dates
  satisfied. Tests use fixed local `new Date('2024-…T12:00:00')` → clock- and TZ-independent.
- **Dependency direction:** `quickadd.ts` (domain) → `lib/date` (leaf) only; no Dexie, no
  `localStorage`, no feature imports.
- **Import churn:** `clampDayOfMonth` inserted alphabetically inside the existing `@/lib/date` group
  (`quickadd.ts:1-8`) — no reformatting of untouched lines.
- **Comments:** one added line (`quickadd.ts:234`) states the non-obvious intent; permitted by
  AGENTS.md ("no comments unless non-obvious intent").
- **Unrelated untracked noise:** `.kilo/` (Agent Manager scaffolding) — not part of this item, left
  untouched.

### 1.2 Code reading (`src/domain/quickadd.ts`)

```ts
61: function nextMonthDay(from: Date, day: number): Date {
62:   const d = startOfDay(from);
63:   const thisMonth = clampDayOfMonth(d.getFullYear(), d.getMonth(), day);
64:   if (thisMonth > d.getDate()) return new Date(d.getFullYear(), d.getMonth(), thisMonth);
65:   const next = addMonths(d, 1);
66:   return new Date(next.getFullYear(), next.getMonth(),
67:     clampDayOfMonth(next.getFullYear(), next.getMonth(), day));
68: }
```

- Placed immediately after `nextWeekday` (`:55-58`), module-local, consistent with that helper's shape.
- `clampDayOfMonth` (`src/lib/date.ts:150-154`) is the existing month-end clamp — reused, not
  reimplemented. `addMonths` is date-fns' (clamping) via the `src/lib/date.ts` re-export (`:106`), so
  `next.getMonth()` is always the true following month (e.g. 31 Jan → Feb) before the second clamp.
- **Today is not counted** (`:64` uses strict `>`), mirroring `nextWeekday`'s `(w - d.getDay() + 7) % 7
|| 7` (`:57`) — the same "next excludes today" convention IMP-010 established. Consistent.
- Parse side (`:234-241`) keeps the match but defers consumption; the monthly rule is set exactly as
  before (`:238-240`). Date fallback (`:305-317`) prefers `loneWeekday` (IMP-010) over the month day,
  then the new month-day branch, then the unchanged today/offset branch. Consumption happens once at
  `:319`, guarded by `monthDayApplied`.

---

## 2. Semantics — measured, not assumed

All rows are `parseQuickAdd(input, now)`, produced by a scratch Vitest probe run against the working
tree and then deleted (§7).

### 2.1 `on the <N>` with no recurrence (AC1)

| Input              | now                                 | `start`        | `title` | recurrence |
| ------------------ | ----------------------------------- | -------------- | ------- | ---------- |
| `party on the 5th` | 2024-06-10                          | **2024-07-05** | `Party` | null       |
| `party on the 5th` | **2024-06-05 (today _is_ the 5th)** | **2024-07-05** | `Party` | null       |
| `party on the 5th` | 2024-06-06                          | 2024-07-05     | `Party` | null       |
| `party on the 5th` | 2024-04-30                          | 2024-05-05     | `Party` | null       |
| `party on the 5th` | 2024-04-05                          | 2024-05-05     | `Party` | null       |
| `party on the 1st` | 2024-06-10                          | 2024-07-01     | `Party` | null       |
| `party on the 5th` | 2024-12-20                          | **2025-01-05** | `Party` | null       |

Today is correctly excluded and the year rolls over. `call mon` on a Monday → `2024-06-17`
(`quickadd.test.ts:64-66`) is the sibling convention; the two agree.

### 2.2 Month-end clamping and leap years

| Input               | now        | `start`        | Reading                                             |
| ------------------- | ---------- | -------------- | --------------------------------------------------- |
| `party on the 31st` | 2024-04-20 | **2024-04-30** | April has 30 days → clamped, **not skipped** to May |
| `party on the 31st` | 2024-04-30 | 2024-05-31     | April's 30th already reached                        |
| `party on the 31st` | 2024-01-31 | 2024-02-29     | leap-year Feb clamp                                 |
| `party on the 31st` | 2024-02-01 | 2024-02-29     | leap-year Feb clamp                                 |
| `party on the 31st` | 2023-02-01 | 2023-02-28     | non-leap Feb clamp                                  |
| `party on the 30th` | 2024-02-01 | 2024-02-29     | leap-year Feb clamp                                 |
| `party on the 29th` | 2024-02-01 | **2024-02-29** | leap day reached exactly                            |
| `party on the 29th` | 2023-02-01 | 2023-02-28     | non-leap clamp                                      |
| `party on the 30th` | 2024-02-29 | 2024-03-30     | Feb 30 clamped to 29 has passed → next month        |
| `party on the 31st` | 2024-12-31 | 2025-01-31     | year rollover                                       |

Clamping matches AGENTS.md / REPO_PROFILE §5 ("month-end is clamped, never skipped") and
`expandOccurrences`'s own rule. **Note the wording nuance in A3.**

### 2.3 Monthly recurrence (AC2) — `byMonthDay` set, anchor NOT moved

| Input                                                 | now        | `start`                    | `recurrence`                                             |
| ----------------------------------------------------- | ---------- | -------------------------- | -------------------------------------------------------- |
| `pay rent every month on the 5th`                     | 2024-06-10 | **2024-06-10 (unchanged)** | `monthly`, `byMonthDay [5]`, `title 'Pay rent'`          |
| `pay electricity $120 every month on the 5th !urgent` | 2024-06-10 | 2024-06-10                 | `monthly`, `byMonthDay [5]`, kind `bill`, `$120`, urgent |
| `pay rent monthly on the 5th`                         | 2024-06-10 | 2024-06-10                 | `monthly`, `byMonthDay [5]`                              |

Cross-checked against the engine, not just the parser: `quickAddToItem` →
`expandOccurrences(item, '2024-06-01', '2024-10-01')` for the monthly case yields
`2024-07-05, 2024-08-05, 2024-09-05` while `start` stays `2024-06-10`. So the anchor/first-occurrence
mismatch is real, **pre-existing**, out of AC1's scope ("no recurrence is present"), and correctly
recorded in `discovered-IMP-011.md` §1. The bare case expands to the single occurrence `2024-07-05`,
consistent with its `start`. Leaving the monthly anchor alone is the conservative, correct choice here.

### 2.4 Token stripped only when applied (AC3)

| Input                             | `title`                                | consumed?                         |
| --------------------------------- | -------------------------------------- | --------------------------------- |
| `party on the 5th`                | `Party`                                | yes (applied as start)            |
| `pay rent every month on the 5th` | `Pay rent`                             | yes (applied as `byMonthDay`)     |
| `party on the 5th 2024-03-04`     | `Party on the 5th`, start `2024-03-04` | no — explicit date wins           |
| `party on the 5th next fri`       | `Party on the 5th`, start `2024-06-14` | no — `next fri` wins              |
| `party on the 0th`                | `Party on the 0th`                     | no — day not in 1–31, not applied |
| `party on the 45th`               | `Party on the 45th`                    | no — ditto                        |

The last two are the documented appearance change in `discovered-IMP-011.md` §2 (least-lossy
behaviour, required by AC3).

---

## 3. Gates — green

```
npm run typecheck   → tsc --noEmit, no diagnostics
npm run lint        → eslint ., no output
npm run test        → Test Files 20 passed (20) | Tests 134 passed (134)  (11.68s)
```

Baseline for this item is 131 tests (`impl-IMP-010.md`, commit `35d4352`); +3 = 134, matching exactly
the 3 new `it` blocks. Benign pre-existing Node warning about `--localstorage-file` (REPO_PROFILE §7)
did not appear this run. Gates re-run after all scratch files were deleted — still 134/134.

---

## 4. Mutation check — the new logic is genuinely pinned

**4a. Full revert of the source logic** (`git stash push -- src/domain/quickadd.ts`, tests kept):

```
× schedules a bare "on the 5th" on the next 5th … → expected '2024-07-05' received '2024-06-10'
× keeps "on the 5th" in the title when an explicit date wins → expected 'Party on the 5th' received 'Party'
✓ applies "on the 5th" as byMonthDay for monthly rules        (passes on baseline too)
Tests 2 failed | 17 passed (19)
```

The third test passes on the pre-change code by design — AC2 pins _pre-existing_ monthly behaviour
(`byMonthDay` set, anchor unmoved), i.e. it is a regression guard, not new-logic coverage. AC1 and AC3
are each detected independently. Source restored byte-identical (`diff -q` vs backup).

**4b. Remove only the `!monthDayApplied` guard** (the "monthly anchor must not move" protection):

```
× applies "on the 5th" as byMonthDay for monthly rules → expected '2024-06-10' received '2024-07-05'
Tests 1 failed | 18 passed (19)
```

So the anchor-preservation requirement _is_ enforced by the suite — exactly the regression the impl
report says an intermediate iteration introduced (`impl-IMP-011.md:52-56`). Guard restored and
verified identical.

---

## 5. Regression check on other quick-add date parsing

A/B harness: `git show HEAD:src/domain/quickadd.ts` copied to `src/domain/__head.quickadd.ts`, both
parsers run over **40 inputs × 10 reference dates = 400 comparisons** of
`kind/title/start/allDay/time/recurrence/tags/urgency/amount/quantity/listName`, diffs only.

Reference dates included month-end (2024-01-31, 2024-04-20), leap Feb 1, year end (2024-12-31), and
"today is the 5th" (2024-06-05).

**Result: every one of the differing cases contains an `on the <N>` token. Zero differences for
weekday, relative-date, explicit-date, `next month`, or `every …` inputs.**

Unchanged (spot-verified identical to baseline):

| Path                 | Input                                                                               | `start`                        |
| -------------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| lone weekday         | `gym fri`                                                                           | 2024-06-14                     |
| lone weekday, today  | `call mon`                                                                          | 2024-06-17                     |
| multi-weekday + time | `gym mon/wed/fri 7am`                                                               | 2024-06-10T07:00               |
| every + weekday      | `gym every week fri 7am`                                                            | 2024-06-10T07:00, weekly `[5]` |
| relative             | `call mom tomorrow`                                                                 | 2024-06-11                     |
| relative             | `review in 3 days` / `in 2 weeks`                                                   | 2024-06-13 / 2024-06-24        |
| **`next month`**     | `retro next month`                                                                  | **2024-07-10**                 |
| `next week`          | `retro next week`                                                                   | 2024-06-17                     |
| explicit ISO + time  | `meeting 2024-03-04 2:30pm`                                                         | 2024-03-04T14:30               |
| recurrence words     | `gym every day 7am`, `water plants weekly`, `backup yearly`, `anniversary annually` | unchanged                      |
| shopping             | `buy milk 2L #groceries` → `Milk`                                                   | unchanged                      |

All 11 pre-existing `parseQuickAdd` tests in `quickadd.test.ts` (incl. the `every month on the 5th`
bill test at `:5-15`) pass untouched.

---

## 6. Acceptance-criteria scorecard

| AC  | Criterion                                                             | Result           | Evidence                                                                                               |
| --- | --------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Month day parsed, no recurrence → `start` = next such day-of-month    | **MET**          | §2.1 (`party on the 5th` → `2024-07-05`; today excluded; year rollover); `quickadd.test.ts:79-88`; §4a |
| 2   | Monthly recurrence → `byMonthDay` set                                 | **MET**          | §2.3 (`[5]`, anchor `2024-06-10` unmoved); `quickadd.test.ts:90-97`; §4b; §2.3 engine cross-check      |
| 3   | Token removed only when actually applied                              | **MET**          | §2.4 (applied → `Party`/`Pay rent`; not applied → `Party on the 5th`); `quickadd.test.ts:99-103`; §4a  |
| —   | Month-end clamp + leap years correct                                  | **MET**          | §2.2 (Apr 30 for "the 31st"; Feb 29 2024 / Feb 28 2023)                                                |
| —   | "next" convention consistent with the item                            | **MET** (see A3) | §2.1 vs `nextWeekday` `quickadd.ts:57`                                                                 |
| —   | No regression to weekday / relative / explicit / `next month` parsing | **MET**          | §5 — 400 A/B comparisons, 0 diffs outside month-day inputs                                             |
| —   | No scope creep, debug leftovers, secrets, style violations            | **MET**          | §1, §1.1 — 2 source files per the backlog; prettier clean                                              |
| —   | Gates green                                                           | **MET**          | §3 — 20 files / 134 tests, typecheck + lint clean                                                      |
| —   | New tests fail when logic reverted                                    | **MET**          | §4a (2 of 3) and §4b (guard)                                                                           |
| —   | Impl report accurate                                                  | **PARTIAL**      | A1 below                                                                                               |

**Final: PASS.** All three acceptance criteria are met; the change is minimal (2 source files named by
the backlog), semantically correct at month/leap boundaries, correctly mutation-tested, and provably
free of regression on the other date-parsing paths.

---

## 7. Advisories (non-blocking)

- **A1 — report inaccuracy / untested precedence change.** `impl-IMP-011.md:48-49` claims "Precedence is
  unchanged in shape". It is not: a month day now silently outranks the explicit relative-date words,
  because the new branch at `quickadd.ts:308` bypasses the `monthOffset`/`dayOffset` logic. Measured
  (HEAD → working tree, `@ 2024-06-10`): `party on the 5th today` 2024-06-10 → **2024-07-05**;
  `… tomorrow` 2024-06-11 → **2024-07-05**; `… next week` 2024-06-17 → **2024-07-05**;
  `… in 3 days` 2024-06-13 → **2024-07-05**; `… next month` 2024-07-10 → **2024-07-05**;
  `party in 2 months on the 5th` 2024-08-10 → **2024-07-05** (the 2-month offset is dropped entirely).
  This is not documented in `discovered-IMP-011.md` (whose §2 and §3 cover other residue). The inputs
  are self-contradictory and the new answer is the more useful one, so it is not a defect — but the
  precedence should be stated and, ideally, pinned by a test.
- **A2 — asymmetric day validation (pre-existing).** `pay rent every month on the 32nd` → `byMonthDay [32]`
  and title `Pay rent` (token eaten, impossible rule stored), while the new no-recurrence branch does
  validate 1–31 (`quickadd.ts:308`). Same class as the `0th`/`45th` residue in
  `discovered-IMP-011.md` §2 and belongs in that follow-up; strictly, AC3 is satisfied ("it was
  applied"), but the intent of not silently eating impossible days is not honoured on the monthly path.
- **A3 — AC wording vs clamping.** AC1 says "the next date whose day-of-month **equals** that number",
  but clamping means the resolved day can differ (`on the 31st` @ 2024-04-20 → `2024-04-30`). The
  implementation follows the repo-wide "clamp, never skip" rule (AGENTS.md, REPO_PROFILE §5) and the
  test at `quickadd.test.ts:86-87` pins it; the backlog wording should be reconciled so a future
  verifier does not read it as a defect. Also note "next" excludes today here, matching
  `nextWeekday` — a defensible reading of "next", stated in the impl report.
- **A4 — undocumented weekly side effect.** `gym every week on the 5th` moved from `start 2024-06-10`
  to `2024-07-05` (weekly rule with no `byWeekday`). Same cause as A1; reasonable, but unrecorded.
- **A5 — unrelated bookkeeping line.** The single `.improve/PROGRESS.log` hunk belongs to **IMP-010**
  (`2026-10-04T04:12Z | IMP-010 | done | 35d4352`, SHA verified correct). It is not part of IMP-011 —
  the previous item's log entry landed in this diff. IMP-011 itself has no `PROGRESS.log` line and
  `.improve/FEATURES.md:206` still reads `Status: TODO`; per the IMP-010 commit (`35d4352`) the status
  flip and log line belong to the item's own commit, which is correct while IMP-011 is uncommitted.

Non-blocking positives worth recording: the deferral design (keeping the token until the date is
resolved) is what makes AC3 implementable at all and is safe because no later pattern can match inside
`on the 5th`; the new helper reuses `clampDayOfMonth` rather than open-coding month-end logic; and the
monthly path was left byte-compatible apart from the flag.

## 8. Method / hygiene of this review

All probes were scratch Vitest files (`src/domain/__probe.imp011.test.ts`,
`src/domain/__probe.ab.test.ts`, `src/domain/__head.quickadd.ts`) used read-only for measurement and
then **deleted**; `git status` afterwards shows only the pre-existing
`M .improve/PROGRESS.log`, `M src/domain/quickadd.test.ts`, `M src/domain/quickadd.ts` plus the two
untracked `.improve/reports/*IMP-011.md` files and `.kilo/`. The mutated source was backed up to
`/tmp/quickadd.impl011.bak` and restored with `diff -q` verification. Nothing was committed; the only
file added by this review is `.improve/reports/verify-IMP-011.md`.
