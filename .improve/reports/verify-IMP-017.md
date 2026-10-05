# IMP-017 — Independent re-verification (attempt 3, final)

**Reviewer:** independent review pass (did not author the change)
**Branch / HEAD:** `improve/auto-20261003` @ `1d05687`
**Change under review:** uncommitted working-tree diff (`git diff`, 3 files)
**Verdict:** **FAIL** — every gate is green, both attempt-2 blockers are structurally
**gone** and the redesign is a real improvement, but the sweep still deletes a phrasal
particle on **96 ordinary inputs** (`"Something to look at 3pm"` → `"Something to look"`),
which is the same defect class that failed attempts 1 and 2, and it has **zero test
coverage** — a 6-line fix for it leaves all 228 tests green (§4). The submission's own
account of this limit is also factually wrong (§6, issue 2).

---

## 1. Diff scope review

```
$ git status --porcelain
 M .improve/PROGRESS.log
 M src/domain/quickadd.test.ts
 M src/domain/quickadd.ts
?? .improve/reports/discovered-IMP-017.md
?? .improve/reports/impl-IMP-017.md
?? .improve/reports/verify-IMP-017.md
?? .kilo/

$ git diff --stat
 .improve/PROGRESS.log       |   1 +
 src/domain/quickadd.test.ts | 127 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 src/domain/quickadd.ts      |  94 +++++++++++++++++++++++++++++---
```

| Check | Result |
| --- | --- |
| Scope creep in `src/` | **None.** New code is `TRAILING_NOISE`, `TIME_OR_DATE_PREP`, `WEEKDAY_PREP`, `removeExpression`, a monotone `removedSchedule` flag, and 6 call-site swaps. `quickAddToItem`, `chips`, `kind`, `amount`, `quantity`, `unit`, `listName` and `monthDayMatch` untouched. No new imports. |
| Unrelated changes | **1**, not authored here: the uncommitted `IMP-016` row in `.improve/PROGRESS.log` (present at verify-2). Keep out of an IMP-017 commit. |
| Debug leftovers | None — `git diff \| grep -E "^\+.*(console\.\|debugger\|\.only(\|xit(\|fdescribe\|TODO\|FIXME\|XXX)"` → no match. |
| Secrets | None. No keys, tokens, `.env*`. |
| Conventions (`AGENTS.md`) | No Dexie, no `localStorage`, no `Date.toISOString()`, no hardcoded styling. The added comments explain non-obvious intent, which the style guide permits. |
| Formatting | `npx prettier --check src/domain/quickadd.ts src/domain/quickadd.test.ts` → `All matched files use Prettier code style!` |
| Prior report issue 4 (`discovered-IMP-017.md` claimed `the` → `""`) | **Fixed** — `discovered-IMP-017.md` §5 now states `"The"` correctly and lists `at`/`in`/`by`/`on`. |

---

## 2. Required behaviour — the redesign holds for every input the brief names

Probe: `git show HEAD:src/domain/quickadd.ts` materialised as `src/domain/zzhead017.ts`,
both modules run in the same Vitest process, `now = 2024-06-10T12:00:00`.
`SAME` = working tree byte-identical to `HEAD` for that title.

**Spec sample — MET** (`start`/`end`/`allDay` identical to `HEAD`):

```
>>CHG "Call dentist tomorrow at 3pm !urgent #health"
     HEAD="Call dentist at"   WT="Call dentist"
     (time=15:00, urgency=high, tags=['health'] — asserted at quickadd.test.ts:118-125)
```

**Brief's UNCHANGED list — MET (9/9 byte-identical, 4/4 particle-preserving).**

```
SAME "Log in"                     -> "Log in"
SAME "Sign in"                    -> "Sign in"
SAME "Check in"                   -> "Check in"
SAME "Something to look at"       -> "Something to look at"
SAME "Find out what it came in"   -> "Find out what it came in"
SAME "Follow up in"               -> "Follow up in"
SAME "Call about the dentist"     -> "Call about the dentist"

"Sign in at 3pm"       HEAD="Sign in at"  -> WT="Sign in"    (particle kept; attempt-2 gave "Sign")
"Log in on 2024-03-04" HEAD="Log in on"   -> WT="Log in"     (attempt-2 gave "Log")
"Check in by 2024-03-04" HEAD="Check in by" -> WT="Check in" (attempt-2 gave "Check")
"Check in on tue"      HEAD="Check in on" -> WT="Check in"   (attempt-2 gave "Check")
```

**Brief's named dangling cases — MET.**

```
>>CHG "Dinner at 7pm next fri"          HEAD="Dinner at"          WT="Dinner"
>>CHG "Call the plumber at 9am next mon" HEAD="Call the plumber at" WT="Call the plumber"
```

**Constructed multi-clause cases — MET.**

| Shape | Input | HEAD | WT |
| --- | --- | --- | --- |
| two times in one input | `Call dentist at 3pm then gym at 5pm` | `Call dentist at then gym at 5pm` | `Call dentist then gym at 5pm` |
| two times | `Breakfast at 7am lunch at 12pm dinner at 7pm` | `Breakfast at lunch at …` | `Breakfast lunch at 12pm dinner at 7pm` |
| time+weekday+relative | `Team sync at 10am tomorrow on wed` | `Team sync at on` | `Team sync` |
| time+weekday+relative | `Retro at 4pm next mon in 3 days` | `Retro at` | `Retro` |
| ISO + time | `Dentist on 2024-03-04 at 2:30pm` | `Dentist on at` | `Dentist` |
| ISO + time | `Pay rent by 2024-03-04 at 9am` | `Pay rent by at` | `Pay rent` |
| `in N days` + time | `Dentist in 3 days at 3pm` | `Dentist at` | `Dentist` |
| `on the 5th` + time | `Pay rent on the 5th at 9am` | `Pay rent at` | `Pay rent` |

The un-extracted *second* token in the two-time rows (`… gym at 5pm`) stays because the
parser only extracts one time per input — identical substring on `HEAD`, so no residue
and no regression.

**Title never empty — MET** (0 empty titles in 945 probe inputs; `at`→`At`,
`on`→`On`, `in`→`In`, `by`→`By`, `the`→`The`, `at 3pm`→`At`, `on 2024-03-04`→`On`,
`the 3pm`→`The`, `at 3pm!`→`At`). The pre-existing `"on the 5th"`→`""` case is
byte-identical to `HEAD` (`monthDayApplied` removes the whole match) — unchanged, not
introduced here.

**Trailing punctuation consistent — MET.**

```
>>CHG "Call dentist at 3pm,"    HEAD="Call dentist at ,"   WT="Call dentist"
>>CHG "Dentist on 2024-03-04."  HEAD="Dentist on ."        WT="Dentist"
>>CHG "Dentist in 3 days!"      HEAD="Dentist !"           WT="Dentist"
>>CHG "Dentist on next fri -"   HEAD="Dentist on -"        WT="Dentist"
>>CHG "Check in tue!"           HEAD="Check in !"          WT="Check in"
SAME  "Call dentist at,"        (nothing cut -> comma kept)
```

**Interior prepositions preserved — MET.**

```
SAME  "Call about the dentist tomorrow at 3pm"  -> "Call about the dentist"
>>CHG "Read the report on the table tomorrow at 9am" -> "Read the report on the table"
SAME  "Pick up the package at the store tomorrow at 4pm" -> "Pick up the package at the store"
SAME  "Lunch with the team tomorrow"              -> "Lunch with the team"
SAME  "Read the book on the shelf tomorrow"       -> "Read the book on the shelf"
```

---

## 3. Flag accumulation — structurally gone; per-expression lists are correct

`removedSchedule` is **monotone**: 1 initialiser + **14 unconditional `= true`** sites
(`quickadd.ts:246,269,279,306,312,323,327,331,335,339,350,358,372,392`), read once at
`:417`. No `= false`, no conditional write, no later branch that can clear it, so no
ordering can disable the trim. The attempt-2 `extractedDateOrTime` overwrite and the
whole `trimDanglingTail` / `DANGLING_TAIL` sweep are gone (`grep` → no matches).

```
$ grep -nE "removedSchedule\s*=" src/domain/quickadd.ts | grep -v "= true"
246:  let removedSchedule = false;
$ grep -n "extractedDateOrTime\|trimDanglingTail\|DANGLING_TAIL" src/domain/quickadd.ts
none - confirmed removed
```

Per-expression lists:

| Requirement | Result |
| --- | --- |
| `in` excluded from every list, so the `in` particle is never a candidate | MET — `Check in 3pm`→`Check in`, `Turn in 3pm`→`Turn in`, `Call in 3pm`→`Call in`, `Fill in 3pm`→`Fill in`, `Look into 3pm`→`Look into`, `Follow up 3pm`→`Follow up`, `Log in in 3 days`→`Log in`, `Check in in 3 days`→`Check in` (all `SAME` vs `HEAD`, i.e. attempt-2's documented `"Sign"` limit is genuinely withdrawn). |
| `prep the` shape does **not** eat a meaningful bare `the` | MET — the list is `(?:(?:at\|on\|by)\s+the\|at\|on\|by)`; a bare `the` is in no list, so `Dentist the 3pm`→`Dentist the`, `Dentist the 2024-03-04`→`Dentist the` (all `SAME`), while the reachable article forms are removed: `Dentist on the 2024-03-04`→`Dentist`, `Dentist at the 3pm`→`Dentist`. AC1's `the` is satisfied on every reachable shape. |
| a time introduced by `before`/`after` | **N/A — the parser has no `before`/`after` support at all.** `grep -nE "\b(before\|after)\b" src/domain/quickadd.ts` matches only a local variable and the `prep the`/`removedSchedule` comments. `Dentist before 3pm`→`Dentist before`, `Dentist after 3pm`→`Dentist after` are byte-identical to `HEAD`. Same for `until`, `around`, `till`, `during`. Out of scope for IMP-017 (a parsing gap, not a trim gap). |
| weekday list is `on`-only, so `Check in tue` keeps its particle | MET — `Check in tue`→`Check in`, `Sign in fri`→`Sign in`, `Look at tue`→`Look at`. |

---

## 4. BLOCKER — phrasal particles spelled `at`/`on`/`by` are still deleted

When the schedule token carries **no preposition of its own**, `TIME_OR_DATE_PREP` eats
whatever word happens to sit immediately before it — including the particle of a
phrasal verb. `Dentist at 3pm`→`Dentist` and `Look at 3pm`→`Look` are structurally
identical; the design prefers the common case and the particle loses.

Exact tally (18 particle heads × bare tokens, run in-process against `HEAD`):

```
DEFECTIVE (phrasal particle deleted): 96 inputs
Look at 3pm                    HEAD="Look at"                    WT="Look"
Look at 9am                    HEAD="Look at"                    WT="Look"
Look at 15:00                  HEAD="Look at"                    WT="Look"
Look at 2024-03-04             HEAD="Look at"                    WT="Look"
Something to look at 3pm       HEAD="Something to look at"       WT="Something to look"
Something to look at 9am       HEAD="Something to look at"       WT="Something to look"
Something to look at 15:00     HEAD="Something to look at"       WT="Something to look"
Something to look at 2024-03-04 HEAD="Something to look at"      WT="Something to look"
Check on 3pm / 9am / 15:00 / 2024-03-04 / tue   -> "Check"
Move on 3pm …  Carry on …  Sign on …  Hang on …  Hold on …
Bring on …  Turn on …  Get on …  Switch on …  Read up on …  Look out on …
Hold by 3pm  Drop by 3pm  Get by 3pm  Stand by 3pm   -> "Hold" / "Drop" / "Get" / "Stand"
```

With its own preposition the particle survives correctly, so the defect is confined to
the bare-token form: `Look at on tue`→`Look at`, `Something to look at on 2024-03-04`→
`Something to look at`, `Read up on 3pm`→`Read up on`, `Look out on 3pm`→`Look out on`.

Why this blocks: `"Something to look at"` is one of the nine titles the brief names as
must-be-preserved, and this is the same user-visible defect that failed attempt 1
(`"Check in"`→`"Check"`) and attempt 2 (`"Sign in at 3pm"`→`"Sign"`) — a meaningful word
deleted from a plausible real title. It is also a **title-worsening change vs pre-change
`HEAD`** on all 96 inputs.

**Zero test coverage.** A correct fix is small and keeps every required behaviour
(applied, then reverted — file restored to `shasum 3b4567750a290c2a249f8fd03b8915474a8d47b6`):

```ts
const PARTICLE_TAIL =
  /(?:\b(?:look|check|move|carry|sign|hang|hold|bring|turn|get|switch|drop|stand)\s+(?:at|on|by)|\b(?:read|look|drop|stand|get|hold)\s+up\s+(?:on|by)|\bup\s+(?:on|by))$/i;
// in removeExpression:
const match = PARTICLE_TAIL.test(head.trim()) ? null : prep.exec(head);
```

```
$ npm run typecheck   # clean
$ npm run lint        # clean
$ npm run test        # Test Files 26 passed (26) · Tests 228 passed (228)

Something to look at 3pm  -> "Something to look at"     Dentist at 3pm          -> "Dentist"
Look at 3pm               -> "Look at"                  Call dentist tomorrow at 3pm -> "Call dentist"
Check on 3pm              -> "Check on"                 Check in on tue         -> "Check in"
Move on 3pm               -> "Move on"                  Sign in at 3pm          -> "Sign in"
Look at 2024-03-04        -> "Look at"                  Pay rent on the 5th at 9am   -> "Pay rent"
                                                         Dentist on the 2024-03-04  -> "Dentist"
```

**All 228 tests pass with the fix.** Nothing in the suite detects the defect, and nothing
in `impl-IMP-017.md` prevents it from being considered settled. Required: add the
particle guard **and** regression assertions for the 96-input shape (at minimum
`"Something to look at 3pm"`, `"Look at 15:00"`, `"Check on 2024-03-04"`,
`"Move on 3pm"`, `"Stand by 3pm"`), so the fix is pinned rather than accidental.

---

## 5. No parsing regression — A/B vs pre-change `HEAD`

945 inputs across three probes (spec sample, brief's required lists, 42×18 head×tail
matrix, plus unrelated-feature inputs: kinds, amounts, tags, recurrence, `every N units`).

| Corpus | Inputs | Title changes | **`start`/`end`/`allDay`/`time`/`dueAt`/`recurrence` diffs** | Empty titles |
| --- | --- | --- | --- | --- |
| Probe A (spec + prior-report cases + regression set) | 145 | 71 | **0** | 0 |
| Probe B (particles, `before`/`after`, bare `the`, punctuation-only) | 98 | 39 | **0** | 0 |
| Probe C (42 heads × 18 tails matrix) | 702 | 252 | **0** | 0 |
| **Total** | **945** | **362** | **0** | **0** |

**No schedule diff found.** All 362 title changes are single-word deletions of
`at`/`on`/`in`/`by`/punctuation, or (in the 96 cases above) the wrong deletion. The
existing residue rules still hold: `party on the 5th 2024-03-04`→`Party on the 5th`,
`gym next fri`→`Gym`, `gym mon/wed/fri 7am`→`Gym`, `call mon`→`Call`,
`standup tue and thu`→`Standup`, `pay rent every month on the 5th`→`Pay rent`,
`Buy milk at the store`→`Milk at the store`.

---

## 6. Gates

```
$ npm run typecheck   # tsc --noEmit  -> clean
$ npm run lint        # eslint .      -> clean, 0 errors 0 warnings
$ npm run test        # Test Files 26 passed (26) · Tests 228 passed (228)
                       baseline 218 -> +10
$ npm run build       # OK · dist/sw.js · injectManifest · 18 precache entries · 607.71 KiB
$ npx prettier --check src/domain/quickadd.ts src/domain/quickadd.test.ts  # clean
```

`--localstorage-file was provided without a valid path` is the known benign baseline
warning (`REPO_PROFILE.md` §7).

---

## 7. Mutation check

`src/domain/quickadd.ts` restored to `shasum 3b4567750a290c2a249f8fd03b8915474a8d47b6`
before and after every mutation; final state re-verified at 26 files / 228 tests.

| # | Mutation | Result |
| --- | --- | --- |
| **A** | **Revert to attempt-2 architecture** — `removeExpression(…)` → plain `match.replace(' ')`, then a trailing-preposition sweep `trimDanglingTail` gated on the flag | **`Tests 4 failed \| 25 passed (29)`**<br>`× drops trailing prepositions and articles left by date extraction` — Expected `"Dentist"`, Received `"Dentist on"`<br>`× trims the dangling preposition past trailing punctuation` — Expected `"Call dentist"`, Received `"Call dentist at ,"`<br>`× keeps the trailing preposition when only a bare date adverbial was consumed` — Expected `"Check in"`, Received `"Check"`<br>`× keeps a phrasal-verb particle when a time or date is extracted` — Expected `"Log in"`, Received `"Log"`<br>**Reverting to attempt-2 logic fails the suite — brief §5 MET.** (My reconstruction is architecturally faithful, not byte-identical to attempt 2; it reproduces both attempt-2 symptoms, `"Check in tomorrow"`→`"Check"` and `"Log in on 2024-03-04"`→`"Log"`.) |
| B | Reintroduce the attempt-2 order-dependent overwrite at the `next <weekday>` site (`removedSchedule ? token-only : removeExpression`) | `29 passed (29)` — **equivalent mutant.** Confirms the architectural claim: with no shared flag there is no ordering that can disable the trim, so the attempt-2 defect class cannot recur. |
| C | Time branch (`ampm` + `hh:mm`) stops consuming its preposition | `Tests 6 failed \| 23 passed (29)` |
| D | `TIME_OR_DATE_PREP` widened with `in` (the particle killer) | `29 passed (29)` — **equivalent mutant.** Bare-token particles are unpinned by any test (see issue 4). |
| **G** | **Add the §4 particle guard** | `29 passed (29)`, and `26 files / 228 tests` green with `typecheck` and `lint` clean — **the §4 defect is invisible to the suite** |

Mutation coverage: the flag/ordering design (B) is provably order-independent; each
per-expression arm has a detector (A, C). Two gaps: the bare-token particle protection
(D) and the `at`/`on`/`by` particle class (G) have **no** detector.

---

## 8. Issues

| # | Severity | Issue | Fix |
| --- | --- | --- | --- |
| 1 | **blocking** | `quickadd.ts:80-89` — `TIME_OR_DATE_PREP` eats the preposition immediately before a schedule token that carries none of its own, deleting the phrasal particle on **96 ordinary inputs**: `"Something to look at 3pm"`→`"Something to look"`, `"Look at 3pm"`→`"Look"`, `"Check on 3pm"`→`"Check"`, `"Move on 3pm"`→`"Move"`, `"Stand by 3pm"`→`"Stand"` (full list §4). Same defect class that failed attempts 1 and 2; worse than `HEAD` on all 96. **Zero test coverage** — the verified fix leaves 228/228 green. | Add the `PARTICLE_TAIL` guard in `removeExpression` (§4) **and** regression assertions for the shape. |
| 2 | medium | `impl-IMP-017.md:201-203` states *"Both limits are pre-existing on `HEAD` and unchanged by this attempt."* **False for the second limit.** A/B: `HEAD("Something to look at 3pm") = "Something to look at"`, `WT = "Something to look"`. Only the first limit (`"Dentist by next fri"`→`"Dentist by"`) is genuinely `SAME`. The example itself is printed correctly, but the HEAD-parity claim hides a 96-input title-worsening delta from the reviewer and from whoever picks this up next. | Correct the claim to state the parity delta and its size. |
| 3 | medium | `FEATURES.md` `### IMP-017` is still `**Status:** TODO` with empty `**Notes:**`; `.improve/STATE.md` still reads `Last commit: IMP-016` / `Current item: (none)`. Every prior DONE item updates both in the same commit (`git show --stat ab0499e`, `1d05687`). The implementer deferred this deliberately because it must not commit. | Update both at commit time, with the IMP-016 SHA. |
| 4 | low | Bare-token `in`-particle protection is unpinned: widening `TIME_OR_DATE_PREP` with `in` (mutation D) keeps 29/29 green, even though `"Check in 3pm"`, `"Sign in 3pm"`, `"Fill in 3pm"`, `"Look into 3pm"` all rely on it today. | Add those four inputs to the particle test. |
| 5 | low | Uncommitted `IMP-016` row in `.improve/PROGRESS.log` is an unrelated modified file in this tree (pre-existing at verify-2). | Keep it out of an IMP-017 commit, or commit separately. |
| 6 | low | AC1 read literally leaves `at`/`by` before a weekday untrimmed: `Dentist at tue`→`Dentist at`, `Dentist by next fri`→`Dentist by`. Both byte-identical to `HEAD`, documented by the implementer, and widening `WEEKDAY_PREP` is exactly what broke `Check in tue`. Accepted. | None; document. |

**Cleared from the prior report:** attempt-2 blocker 1 (order-dependent overwrite) — gone
structurally and proven by mutation B; attempt-2 blocker 2 (particle deletion on the
`at <time>`/`on <iso>`/`by <iso>`/weekday-`on` arms) — gone, all five named inputs now
keep their particle; the `the`→`""` inaccuracy in `discovered-IMP-017.md` — corrected.

Scratch files `src/domain/zzhead017.ts`, `zzprobe017.test.ts`, `zzprobe017b.test.ts`,
`zzmass017.test.ts`, `zzfinal017.test.ts`, `zzcount017.test.ts`, `zzg.test.ts` and
`/tmp/zzorig017.ts` are deleted; `git status --porcelain` matches the §1 snapshot
exactly. **Nothing committed. Only `.improve/reports/verify-IMP-017.md` rewritten.**