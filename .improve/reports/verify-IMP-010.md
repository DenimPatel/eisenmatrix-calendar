# Verify — IMP-010 — Parse a lone weekday in quick add ("gym fri")

- **Item:** `### IMP-010` (`.improve/FEATURES.md:189-203`)
- **Implementation report:** `.improve/reports/impl-IMP-010.md`
- **Reviewed state:** uncommitted working-tree change on `improve/auto-20261003` (HEAD `015814a`)
- **Verdict:** **PASS** (3/3 acceptance criteria met; 0 blocking defects, 4 advisories, 2 report inaccuracies)
- **Reviewer:** independent reviewer (did not author the change)
- **Date:** 2026-10-04

---

## 1. Change surface

| File                          | Change                                                                                             | LOC      |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| `src/domain/quickadd.ts`      | new `loneWeekday` state; lone-weekday branch of the weekday lexer; date fallback branch            | +14 / −4 |
| `src/domain/quickadd.test.ts` | 3 new `it` blocks (4 assertions paths: `gym fri`, `call mon`, `every`, multi-weekday + `next fri`) | +36      |
| `.improve/PROGRESS.log`       | 1 bookkeeping line (see §1.3)                                                                      | +1       |

`git diff --stat` → `3 files changed, 51 insertions(+), 4 deletions(-)`. No other module touched;
no dependency/`package.json`/schema/UI changes. Blast radius confirmed by consumer scan:
`rg 'parseQuickAdd|quickAddToItem' src` → definition (`quickadd.ts:85`, `:370`), tests, and the
single UI consumer `src/features/quickadd/QuickAdd.tsx:35,47`.

The diff matches the backlog's stated file list exactly (`FEATURES.md:193` names
`src/domain/quickadd.ts`; `:199` names `src/domain/quickadd.test.ts`).

### 1.1 Scope creep / unrelated changes / hygiene

- **Unrelated source changes: none.** Only the two files the item names.
- **Debug leftovers: none.** `rg 'console\.|debugger|TODO|FIXME'` over both files → no matches.
- **Secrets: none.** `git diff` adds no key/token/credential material; no `.env*` touched.
- **Hygiene:** `npx prettier --check src/domain/quickadd.ts src/domain/quickadd.test.ts` →
  `All matched files use Prettier code style!`.
- **Unrelated untracked noise:** `.kilo/` (Agent Manager scaffolding) — not part of IMP-010,
  left untouched.
- **No direct `localStorage`/Dexie** added; dates use `formatISODate` (local), never
  `toISOString()` — REPO_PROFILE §5 satisfied.

### 1.2 Code reading (`src/domain/quickadd.ts:191-213`, `:285-294`)

```ts
191:  const weekdayListMatch = weekdayListRe.exec(working);
193:  let loneWeekday: number | null = null;
199:    const before = working.slice(0, weekdayListMatch.index);
200:    if (weekdays.length > 1 || /every/i.test(input)) { … }
202:    } else if (weekdays.length === 1 && !/\bnext\s*$/i.test(before)) {
203:      loneWeekday = weekdays[0];
204:      weekdays = [];
205:      working = working.replace(weekdayListMatch[0], ' ');
```

- Clearing `weekdays = []` in the lone branch is load-bearing: without it the `if (weekdays.length)`
  block at `:210` would synthesise `weekly + byWeekday:[5]` (the report documents hitting exactly
  this). Confirmed by re-deriving the branch: the assignment is present in the shipped code.
- The `next` look-behind is correct for the intended case: for `" gym next fri"`,
  `before = " gym next "`, `/\bnext\s*$/i` matches → lone branch skipped, token left in `working`
  for the `next <weekday>` branch at `:277-283`.
- `loneWeekday` is applied only in the **final** fallback, so an explicit ISO date
  (`gym fri 2024-03-04`) still wins — verified in §2.3.

### 1.3 Bookkeeping drift (informational, not a defect)

`.improve/PROGRESS.log:18` records `DISCOVERY | done | 015814a`, i.e. the already-committed
discovery commit — not IMP-010. IMP-010 has no PROGRESS line. This matches the repo's observed
convention (entries are written at commit time, once a SHA exists — see IMP-007/008/009 lines),
and `FEATURES.md:190` still reads `Status: TODO`. Both flip only on commit. Not blocking.

---

## 2. Semantics — A/B against the pre-change parser

Method: materialized `git show HEAD:src/domain/quickadd.ts` as a temporary
`src/domain/quickadd.baseline.ts` and ran both parsers over 35 inputs at
`now = new Date('2024-06-10T12:00:00')` (a **Monday**) in a throwaway vitest file
(`--disable-console-intercept`). Both probe files were deleted afterwards; `git status` is back to
the 3 expected files (§1).

### 2.1 AC1 — lone weekday consumed, `dateKey` = next occurrence, today NOT counted — **MET**

| input            | NEW title / start / rec        | BASELINE title / start         | verdict                   |
| ---------------- | ------------------------------ | ------------------------------ | ------------------------- |
| `gym fri` (Mon)  | `Gym` / `2024-06-14` / `null`  | `Gym fri` / `2024-06-10`       | next Friday ✓             |
| `call mon` (Mon) | `Call` / `2024-06-17` / `null` | `Call mon` / `2024-06-10`      | today excluded ✓          |
| `gym fri 7am`    | `Gym` / `2024-06-14T07:00`     | `Gym fri` / `2024-06-10T07:00` | time composed correctly ✓ |

`call mon` on a Monday resolving to **06-17**, not 06-10, is the direct proof that today is not
counted. Mechanically: `nextWeekday` uses `(weekday - d.getDay() + 7) % 7 || 7`
(`quickadd.ts:48-52`) — the `|| 7` forces a 7-day jump on a same-day match — and it is the same
helper the `next <weekday>` path uses, as the item's Notes require.

### 2.2 AC2 — two or more weekdays still yield weekly + `byWeekday` — **MET (byte-identical)**

| input                    | NEW                                                  | BASELINE  | diff                       |
| ------------------------ | ---------------------------------------------------- | --------- | -------------------------- |
| `standup tue and thu`    | `Standup`, `weekly`, `byWeekday [2,4]`, `2024-06-10` | identical | title/start/rec all `same` |
| `gym mon/wed/fri 7am`    | `Gym`, `weekly`, `[1,3,5]`, `2024-06-10T07:00`       | identical | all `same`                 |
| `gym every week fri 7am` | `Gym`, `weekly`, `[5]`, `2024-06-10T07:00`           | identical | all `same`                 |

The pre-existing `gym mon/wed/fri 7am` test (`:28`) still passes unmodified. `standup tue and thu`
was newly pinned; both `title` and `start` are unchanged from baseline, so no anchor drift.

### 2.3 AC3 — weekday token removed from title — **MET**

Asserted in all four new test paths: `Gym` (`gym fri`), `Call` (`call mon`), `Gym`
(`gym every week fri 7am`), `Standup` / `Gym` (`tue and thu`, `next fri`).
Combination with an explicit ISO date also strips correctly (`gym fri 2024-03-04` → title `Gym`,
`start 2024-03-04`, unchanged from baseline).

### 2.4 `next <weekday>` and `every <weekday>` paths — **UNCHANGED**

| input                    | NEW                                       | BASELINE  | diff       |
| ------------------------ | ----------------------------------------- | --------- | ---------- |
| `gym next fri`           | `Gym` / `2024-06-14` / `null`             | identical | all `same` |
| `next fri`               | `` / `2024-06-14` / `null`                | identical | all `same` |
| `gym every week fri 7am` | see §2.2                                  | identical | all `same` |
| `gym every fri`          | `Gym every` / `2024-06-10` / `weekly [5]` | identical | all `same` |

`gym every fri` leaking `every` into the title is **pre-existing** (the recurrence lexer at
`:157-184` has no bare-`every` branch) and is byte-identical to baseline — correctly logged as
discovered finding #1, not a regression.

### 2.5 Regression scan — weekday words NOT intended as dates

The review brief's named case is **safe**:

| input                   | NEW                             | BASELINE  | diff       |
| ----------------------- | ------------------------------- | --------- | ---------- |
| `friday report`         | `Friday report` / `2024-06-10`  | identical | all `same` |
| `friday reports`        | `Friday reports` / `2024-06-10` | identical | all `same` |
| `monday standup notes`  | unchanged                       | identical | all `same` |
| `wednesday report due`  | unchanged                       | identical | all `same` |
| `review saturday plans` | unchanged                       | identical | all `same` |

Reason: `WEEKDAY_PATTERN` (`quickadd.ts:42`) is 3-letter and the list regex is `\b(...)\b`
(`:187-190`), so `\bfri\b` cannot match inside `friday`. Full weekday names are unaffected.

**But bare 3-letter ambiguous words used as ordinary English now regress:**

| input                | NEW title / start               | BASELINE title / start              | impact                           |
| -------------------- | ------------------------------- | ----------------------------------- | -------------------------------- |
| `we wed in June`     | `We in June` / `2024-06-12`     | `We wed in June` / `2024-06-10`     | title text destroyed             |
| `sat the interview`  | `The interview` / `2024-06-15`  | `Sat the interview` / `2024-06-10`  | title text destroyed             |
| `sun the tomatoes`   | `The tomatoes` / `2024-06-16`   | `Sun the tomatoes` / `2024-06-10`   | title text destroyed             |
| `renew passport sat` | `Renew passport` / `2024-06-15` | `Renew passport sat` / `2024-06-10` | arguably intended; token dropped |
| `buy milk wed`       | `Milk` / `2024-06-12`           | `Milk wed` / `2024-06-10`           | arguably intended                |

These are **new** consequences of IMP-010 (baseline preserved the text). They are disclosed in
`.improve/reports/discovered-IMP-010.md` §3(b) with a suggested hardening (require the token to look
like a schedule hint), so they are a known, scoped-out design consequence rather than a hidden
regression — but the impl report's phrasing that these "are pre-existing or out of scope"
(`impl-IMP-010.md:101-103`) is imprecise: (b) is explicitly new. See advisory A1.

### 2.6 Second regression class — lone weekday silently overrides explicit relative dates

`loneWeekday` is applied in the final fallback (`:285-294`) and short-circuits the
`monthOffset`/`dayOffset` branch, so a relative date in the same input is discarded:

| input                | NEW start          | BASELINE start          | delta                       |
| -------------------- | ------------------ | ----------------------- | --------------------------- |
| `gym fri tomorrow`   | `2024-06-14` (Fri) | `2024-06-11` (tomorrow) | explicit relative word lost |
| `gym fri in 3 days`  | `2024-06-14`       | `2024-06-13`            | explicit relative word lost |
| `gym fri next week`  | `2024-06-14`       | `2024-06-17`            | explicit relative word lost |
| `gym fri next month` | `2024-06-14`       | `2024-07-10`            | explicit relative word lost |
| `gym fri tonight`    | `2024-06-14T20:00` | `2024-06-10T20:00`      | relative word lost          |

**This directly contradicts the implementation report.** `impl-IMP-010.md:61` claims
"(`gym fri tomorrow` → tomorrow)" and `:63-64` claims the placement was chosen "so that
'tomorrow'/'in 3 days' are not silently ignored when both are present". Measured behaviour is the
exact opposite: the relative date is silently ignored in all five cases above, and **no test covers
any of them**. The ACs do not specify this interaction, so it is not a criterion failure — but the
report states a rationale the code does not implement. See advisory A2.

### 2.7 Minor behavioral delta — bare weekday input yields an empty title

`fri` → NEW `title ""`, `start 2024-06-14`; BASELINE `title "Fri"`, `start 2024-06-10`.
`quickAddToItem` already guards with `parsed.title || 'Untitled'` (`quickadd.ts:399`) and
`QuickAdd.commit` only rejects empty **input** (`QuickAdd.tsx:46`), so the user gets an item titled
`Untitled` on next Friday instead of an item titled `Fri` on today. Consistent with AC3 (the token
must leave the title); noted for the record. See advisory A3.

---

## 3. Gates

```
npm run typecheck   → exit 0, no output
npm run lint        → exit 0, no output
npm run test        → Test Files 20 passed (20) | Tests 131 passed (131)   [HEAD baseline 20 files / 127 tests]
npm run build       → exit 0, built in 97ms, dist/sw.js emitted, PWA injectManifest precache 18 entries (603.15 KiB)
npx prettier --check→ All matched files use Prettier code style!
```

Baseline is green, so all four gates pass and nothing is masked. Delta is exactly +4 tests
(127 → 131) and no pre-existing test was modified or deleted — the new block is appended after
`quickadd.test.ts:53` inside the existing `describe('parseQuickAdd')`. `dist/` is gitignored
(`.gitignore:11`), so the build left no tracked residue. All gates re-run **after** the mutations
of §4 were reverted (§5) — the tree I measured is the tree I verified.

---

## 4. Mutation check

### 4a. Revert the new logic (the requested check)

`git show HEAD:src/domain/quickadd.ts > src/domain/quickadd.ts` (whole new logic removed), tests
left as-is:

```
npx vitest run src/domain/quickadd.test.ts
→ Test Files  1 failed (1)
→ Tests       1 failed | 15 passed (16)
FAIL  parseQuickAdd > schedules a lone weekday on the next occurrence of that weekday
AssertionError: expected 'Gym fri' to be 'Gym'
 ❯ src/domain/quickadd.test.ts:60
```

The new tests are not vacuous: AC1's test fails without the change.

### 4b. Finer mutation — resolve the lone weekday to today

`formatISODate(nextWeekday(now, loneWeekday))` → `formatISODate(now)` (token still consumed, so
the title assertion passes and only the date assertion can catch it):

```
→ Tests  1 failed | 15 passed (16)
AssertionError: expected '2024-06-10' to be '2024-06-14'
 ❯ src/domain/quickadd.test.ts:61
```

This isolates and proves the "**next** occurrence, today not counted" half of AC1 is independently
pinned by a failing assertion — not merely implied by the title assertion.

### 4c. Why only 1 of the 4 new tests fails on revert (expected)

The other new tests are deliberately regression guards for _unchanged_ behavior (`every`-with-lone-
weekday, multi-weekday, `next <weekday>`), so surviving a revert is correct, not a gap: their
purpose is to prove the change does not alter those paths. §2.2/§2.4 confirm they pass both before
and after, which is exactly what they assert.

### 4d. Restoration

`src/domain/quickadd.ts` restored from a byte backup taken before mutation 4b; probe files
(`quickadd.baseline.ts`, `zzprobe.test.ts`, `zzprobe2.test.ts`) deleted. Final state:

```
git status --porcelain=v1
 M .improve/PROGRESS.log
 M src/domain/quickadd.test.ts
 M src/domain/quickadd.ts
?? .improve/reports/discovered-IMP-010.md
?? .improve/reports/impl-IMP-010.md
?? .kilo/
git diff --stat → 3 files changed, 51 insertions(+), 4 deletions(-)   (identical to §1)
```

**No mutation residue. Nothing committed.**

---

## 5. Findings

### Blocking

None.

### Non-blocking advisories

- **A1 — Ambiguous bare weekday words are consumed and dropped from titles** (`wed`, `sat`, `sun`
  used as ordinary words): `we wed in June` → `We in June` (06-12), `sat the interview` →
  `The interview` (06-15). Disclosed in `discovered-IMP-010.md` §3(b), but `impl-IMP-010.md:101`
  files these under "pre-existing", which is inaccurate for this subset.
  _Suggested:_ require the lone token to look like a schedule hint (trailing token, or preceded by
  `on|at|every|start`), as the discovered report itself recommends; log as a follow-up item.
- **A2 — Report rationale is not implemented, and the interaction is untested.**
  `impl-IMP-010.md:61,63-64` asserts relative dates win and that the chosen placement prevents them
  being "silently ignored"; measured `gym fri tomorrow|in 3 days|next week|next month|tonight` all
  resolve to the lone weekday (§2.6). Either fix the precedence (apply `dayOffset`/`monthOffset`
  first, then fall back to `loneWeekday`) or correct the report and add tests pinning whichever
  behavior is intended.
- **A3 — Bare-weekday input produces an empty title** (`fri` → `""` → `Untitled` at commit).
  Inherent to AC3; worth a `QuickAdd` guard or a doc line.
- **A4 — Readability nits in the new code.** `before` (`quickadd.ts:199`) is a vague name
  (`prefix` / `textBeforeMatch` would read better), and the `next` look-behind at `:202` is exactly
  the "non-obvious intent" case AGENTS.md permits a comment for, yet carries none — a future reader
  could "simplify" it away and silently break `next <weekday>`. Prettier and eslint are clean, so
  this is style-only.

### Informational

- The `every`-present condition still tests the **raw** `input` (`:200`), not `working`, so an
  unrelated occurrence of "every" (e.g. `every time i run mon`) suppresses lone-weekday
  consumption. Pre-existing; unchanged from baseline.
- Only the leftmost weekday group is consumed (single `exec` at `:191`) — pre-existing, correctly
  recorded as discovered finding #3(a).
- `every` + lone weekday leaves the series anchor on today rather than the weekday — pre-existing,
  recorded as discovered finding #2. Correctly kept out of this low-risk item.

---

## 6. Acceptance-criteria scorecard

| AC  | Criterion                                                                                                           | Result                     | Evidence                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Lone weekday consumed from title; `dateKey` = next occurrence, today not counted (same convention as `nextWeekday`) | **MET**                    | §2.1 (`gym fri`→`2024-06-14`, `call mon` on Monday→`2024-06-17`); `quickadd.test.ts:57-67`; mutations 4a + 4b   |
| 2   | Two or more weekdays still produce a weekly recurrence with `byWeekday`                                             | **MET**                    | §2.2 — `tue and thu` → `weekly [2,4]` and `mon/wed/fri` byte-identical to baseline; pre-existing test untouched |
| 3   | Title no longer contains the weekday token                                                                          | **MET**                    | §2.3 — `Gym` / `Call` / `Standup` asserted in all four new tests                                                |
| —   | "next <weekday>" / "every <weekday>" paths unchanged                                                                | **MET**                    | §2.4 — identical title/start/recurrence vs baseline for 4 inputs                                                |
| —   | No regression for non-date weekday words                                                                            | **MET** (with advisory A1) | §2.5 — `friday report` & full weekday names unaffected; bare `wed`/`sat`/`sun` are the advisory                 |
| —   | No scope creep / debug leftovers / secrets / style violations                                                       | **MET**                    | §1 — 2 source files matching the backlog's file list; no logs/TODOs/secrets; prettier clean (A4 is style-only)  |
| —   | Gates green (typecheck, lint, test)                                                                                 | **MET**                    | §3 — 20 files / 131 tests, typecheck + lint clean (+ build clean)                                               |
| —   | New tests fail when the logic is reverted                                                                           | **MET**                    | §4a 1 fail / 4b 1 fail — both discriminating assertions independently pinned                                    |
| —   | Impl report accurate                                                                                                | **PARTIAL**                | A2: `impl-IMP-010.md:61,63-64` contradicted by measurement                                                      |

**Final: PASS** — all three acceptance criteria are met and the change is minimal, correct, and
correctly tested. The two report inaccuracies (A2's contradicted rationale, A1's "pre-existing"
label) should be corrected in `impl-IMP-010.md`; neither blocks the item.
