# Verify — IMP-014 (Emit RFC-5545-valid `UNTIL` for all-day (DATE) recurrence)

**VERDICT: PASS** — all 3 acceptance criteria met. Independent review, no code changed.

Reviewer did not author the change. Scope: working-tree diff vs `905aa6a`
(`improve/auto-20261003`), item text from `.improve/FEATURES.md` `### IMP-014`,
conventions from `.improve/REPO_PROFILE.md`.

---

## 1. Acceptance criteria

### AC1 — all-day/date-only start ⇒ bare `YYYYMMDD` matching DTSTART — **MET**

`src/lib/ics.ts:48`

```ts
if (until) parts.push(`UNTIL=${dateOnly(until)}${dateOnlyStart ? '' : 'T235959Z'}`);
```

`src/lib/ics.test.ts:60-64` asserts the exact string
`FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630`.

### AC2 — timed events ⇒ UTC date-time UNTIL — **MET (byte-identical to prior output)**

Literal `T235959Z` retained on the timed branch. `ics.test.ts:66-73` pins
`UNTIL=20240630T235959Z` for both explicit `false` and the omitted-argument default.

Note: AC2 as written preserves a latent inconsistency (timed `DTSTART` is *floating*,
`floating()` at `ics.ts:24-28` emits no `TZID`/`Z`, yet `UNTIL` is tagged `Z`).
Fixing it would contradict AC2, so correctly left out of scope and recorded in
`.improve/reports/discovered-IMP-014.md` §1. Not counted against this item.

### AC3 — rules without `until` unchanged — **MET**

`ics.test.ts:75-79` asserts identical output for `dateOnlyStart` `true` and `false`.
Pre-existing weekly/`BYDAY` (`:16`), alarm/escaping (`:19`) and all-day-export (`:43`)
tests untouched and green — the regression net.

### Verification method from the spec ("assert the exact `RRULE` line") — satisfied

`ics.test.ts:81-103` round-trips a real all-day task and a real timed event through
`itemsToICS` and asserts both full `RRULE` content lines.

---

## 2. ICS correctness (the three precise checks)

### 2a. `UNTIL` value type matches the `DTSTART` value type, by construction

`ics.ts:93` computes the single deciding variable; both consumers read it:

```ts
const timed = !item.allDay && hasTimeComponent(item.start);   // :93  — decides DTSTART
...
if (timed) { lines.push(`DTSTART:${floating(start)}`); }      // :103-104
else       { lines.push(`DTSTART;VALUE=DATE:${dateOnly(start)}`); }  // :108
if (item.recurrence) lines.push(`RRULE:${recurrenceToRRule(item.recurrence, !timed)}`);  // :110
```

The date-only decision is literally `!timed` — the negation of the same boolean that
selected the DTSTART branch two statements earlier. They cannot disagree, because
there is no second decision to make. This is the strongest form the invariant can
take: it is structural, not two parallel computations kept in sync by convention.

Verified empirically across all four `allDay` × time-component combinations
(throwaway probe, since removed; `until: '2024-06-30'`, weekly BYDAY=MO):

| `allDay` | `start`             | DTSTART                    | UNTIL         |
| -------- | ------------------- | -------------------------- | ------------- |
| `true`   | `2024-05-06`        | `DTSTART;VALUE=DATE:20240506` | `UNTIL=20240630` |
| `false`  | `2024-05-06`        | `DTSTART;VALUE=DATE:20240506` | `UNTIL=20240630` |
| `true`   | `2024-05-06T09:00`  | `DTSTART;VALUE=DATE:20240506` | `UNTIL=20240630` |
| `false`  | `2024-05-06T09:00`  | `DTSTART:20240506T090000` | `UNTIL=20240630T235959Z` |

All four pairs are type-consistent. Rows 2 and 3 are the two non-obvious cases: the
flag tracks the *emitted* DTSTART, not the `allDay` property, so an item whose
`allDay` disagrees with its `start` string still gets a matching pair.

### 2b. No UTC off-by-one in the UNTIL value — **CONFIRMED**

`rule.until` (`'2024-06-30'`) goes through `parseLocalDate` (`src/lib/date.ts:39-53`),
which for a `DATE_ONLY` match constructs `new Date(y, m-1, d, 0, 0, 0, 0)` — **local**
midnight, never `new Date(string)` (UTC-parsing) and never `.toISOString()`. The value
is then rendered by `dateOnly()` (`ics.ts:30-32`) from **local** `getFullYear` /
`getMonth` / `getDate`. Local→local round trip, so the day is preserved exactly; the
`AGENTS.md` `toISOString()` trap is not present.

Empirical confirmation — `src/lib/ics.test.ts` (7 tests) run under 5 timezones
spanning UTC−11 to UTC+14:

```
TZ=UTC                → 7 passed (7)
TZ=America/New_York  → 7 passed (7)   (UTC−4)
TZ=Asia/Kolkata      → 7 passed (7)   (UTC+5:30, non-integral offset)
TZ=Pacific/Kiritimati → 7 passed (7)  (UTC+14)
TZ=Pacific/Pago_Pago → 7 passed (7)   (UTC−11)
```

All green. A UTC conversion leak would fail at one or more of these edges.

### 2c. `recurrenceToRRule` is not called elsewhere needing the new argument — **CONFIRMED**

Exhaustive search (`grep -rn "recurrenceToRRule" src/`): one production definition
(`ics.ts:35`), one production caller (`ics.ts:110`, now passes `!timed`), seven test
references. `itemsToICS` has exactly two importers: `ics.test.ts` and
`src/features/settings/SettingsView.tsx:31`, and neither touches `recurrenceToRRule`
directly. The only remaining single-argument call is the pre-existing `ics.test.ts:16`,
whose rule has no `until`, so the `false` default leaves its output byte-identical.

The `= false` default is a latent footgun for a future caller (§5 below), not a live
bug. Flagged in `discovered-IMP-014.md` §4 by the implementer; acceptable for a
low-risk, behavior-preserving default.

---

## 3. Gates — all green

```
npm run typecheck   → tsc --noEmit, no diagnostics, exit 0
npm run lint        → eslint ., no output, exit 0
npm run test        → Test Files 22 passed (22)
                      Tests     160 passed (160)
                      Duration  17.30s
```

Baseline per `REPO_PROFILE.md` §3/§7 was green; no pre-existing failures regressed
(the profile's benign `--localstorage-file` warning is environmental, not code).
Test count 156 → 160 matches the impl report's claim of +4.

---

## 4. MUTATION-CHECK — confirmed

Mutation forced: reverted the conditional to the always-timed form, i.e. the exact
pre-fix behavior.

```python
old = "if (until) parts.push(`UNTIL=${dateOnly(until)}${dateOnlyStart ? '' : 'T235959Z'}`);"
new = "if (until) parts.push(`UNTIL=${dateOnly(until)}T235959Z`);"
```

`npx vitest run src/lib/ics.test.ts` under mutation:

```
× emits a bare date UNTIL for date-only starts                    4ms
× keeps RRULE UNTIL matching the emitted DTSTART value type       5ms
Tests  2 failed | 5 passed (7)
```

The 4 newly added tests fail on exactly the 2 that assert the fixed behavior; the 3
pre-existing tests and the "omits UNTIL"/"timed" tests stay green. The failure diff
shows the mutated output directly:

```
 DTSTART;VALUE=DATE:20240506
-RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630\r\n
+RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630T235959Z
```

Restored `src/lib/ics.ts` from a pre-mutation backup and re-ran: `7 passed (7)`.
`git diff --stat` afterwards is identical to the pre-review state
(`src/lib/ics.ts | 4 insertions(+), 3 deletions(-)`), so the review left no residue.

**Test-quality note (positive):** the integration assertion at `ics.test.ts:101` is
anchored on `\r\n…\r\n` rather than a bare substring. A naive
`toContain('RRULE:…UNTIL=20240630')` would have been **satisfied by the buggy output**
(`…UNTIL=20240630T235959Z` contains that substring). The implementer hit this trap and
fixed it; the mutation run proves the anchoring is load-bearing.

---

## 5. Scope, style, leftovers

Diff is `3 files, 59 insertions(+), 3 deletions(-)`:

- `src/lib/ics.ts` — 3 production lines (signature default, conditional suffix, call site).
  Minimal and surgical; no unrelated edits, no refactors.
- `src/lib/ics.test.ts` — +4 tests, appended. Existing tests not modified.
- `.improve/PROGRESS.log` — +1 line, and it is an **IMP-013** entry (`905aa6a`), not
  IMP-014. Confirmed unrelated: `git show 905aa6a --stat` covers the shortcut work, and
  the IMP-014 work is uncommitted with `FEATURES.md` still `TODO`. Consistent with
  logging at commit time. Not flagged as scope creep.

Checks run:

- **Debug leftovers:** `git diff -U0 -- src/` grepped for `console.`, `debugger`,
  `TODO`, `FIXME`, `XXX`, `.only(`, `.skip(`, `process.env` → **none**.
- **Secrets:** none introduced. No `.env` touched; `REPO_PROFILE.md` §6 warns about a
  stale gitignored `GEMINI_API_KEY` — untouched and not printed.
- **Conventions:** dates via `src/lib/date.ts` helpers ✓; no direct Dexie/localStorage
  ✓; no hardcoded Tailwind colors ✓; `lib` remains a leaf ✓; no `toISOString()` date key ✓.
- **Comments:** one added JSDoc at `ics.ts:34` documenting the DTSTART-mirroring
  invariant. `AGENTS.md` permits comments explaining non-obvious intent; this states a
  cross-function invariant a caller can silently violate. Justified.
- **Formatting:** `npx prettier --check src/lib/ics.ts src/lib/ics.test.ts` →
  "All matched files use Prettier code style!"
- **Untracked:** `.improve/reports/{impl,discovered}-IMP-014.md` (expected deliverables)
  and `.kilo/` (agent config, not part of this change).

---

## 6. Issues

### Non-blocking — inverted example in the impl report's design rationale

`.improve/reports/impl-IMP-014.md:22-28` justifies using `!timed` over `item.allDay`
like this: *"An item flagged `allDay: true` whose `start` still carries a time is
exported as `DTSTART;VALUE=DATE`; keying off `item.allDay` would have produced a
mismatched pair for exactly that item."*

That is backwards. For that item, `item.allDay === true` would yield a **bare** `UNTIL`,
which correctly matches its `DTSTART;VALUE=DATE` — a match, not a mismatch. The case
that actually breaks under `item.allDay` keying is the **opposite** one, row 2 of the
table in §2a: `allDay: false` with a date-only `start`, where `timed` is `false` so
DTSTART is `VALUE=DATE`, while `item.allDay` would have produced `T235959Z`.

Impact: **none on the code** — `!timed` is the right signal and the implementation is
correct. The conclusion is right; the supporting example names the wrong case. Worth
correcting so a future maintainer does not "fix" the signal based on an inverted
premise. Row 2 is also the case not covered by the committed tests (both integration
items pair `allDay` consistently with `start`).

### Non-blocking — `dateOnlyStart` default is a silent-failure footgun

`discovered-IMP-014.md` §4 already raises this; confirmed accurate. The sole production
caller passes the flag, so there is no live defect today. Making the parameter required
would be strictly safer at zero behavioural cost and could be a follow-up.

### Non-blocking — no `PROGRESS.log` / `FEATURES.md` status update yet

Consistent with an uncommitted change; expected to land at commit time. Noted only so
the commit step is not forgotten.

---

## 7. Commands run

```
git diff -- src/ .improve/PROGRESS.log
grep -rn "recurrenceToRRule" src/
npm run typecheck && npm run lint && npm run test      # all green, 160/160
npx vitest run src/lib/ics.test.ts                     # under 5 TZs, 7/7 each
# mutation: conditional → unconditional T235959Z
npx vitest run src/lib/ics.test.ts                     # 2 failed | 5 passed
# restored from backup
npx vitest run src/lib/ics.test.ts                     # 7 passed
npx prettier --check src/lib/ics.ts src/lib/ics.test.ts
git status --porcelain=v1 ; git diff --stat
```

**Nothing was committed.** This report is the only file added by the review.