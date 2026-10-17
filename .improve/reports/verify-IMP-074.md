# Verify — IMP-074: Emit a floating `UNTIL` to match a floating `DTSTART` in ICS

**Verifier:** independent; did not write the change
**Branch:** `improve/auto-20261017` (working tree, uncommitted; HEAD `ee267d6`)
**Date:** 2026-10-17
**VERDICT: PASS** (all four criteria met; two non-blocking bookkeeping notes)

## Scope reviewed

`git diff` against HEAD:

```
.improve/FEATURES.md   |  4 ++--   (IMP-014 AC2 wording; IMP-074 TODO -> IN-PROGRESS)
.improve/PROGRESS.log  |  2 +-     (IMP-073 commit SHA backfill)
.improve/STATE.md      |  6 +++--- (orchestration)
src/lib/ics.test.ts    | 27 ++++++++++++++++++++-------
src/lib/ics.ts         |  5 +++--
```

`src/lib/ics.ts` changes only:

- `recurrenceToRRule(rule, dateOnlyStart: boolean)` — default removed.
- Timed `UNTIL` suffix changed from `T235959Z` to `T235959`; the all-day branch (`''`) is
  untouched.
- One comment explaining why a `Z` is wrong; it explains non-obvious intent, so it fits the
  repo's comment rule.

`src/lib/ics.test.ts` adds/updates five assertions/tests; every call site now passes the
value-type flag explicitly. No debug output, dependency, production path, or unrelated source
edit. `git diff --check` and Prettier are clean. Temporary verification files were removed;
`git status` contains only the five modified files plus the impl report.

### Spec amendment

The IMP-014 AC2 diff is exactly:

> before: `For timed events, UNTIL remains a UTC date-time.`
> after: `For timed events, UNTIL is a floating date-time with no Z, matching the floating DTSTART (amended by IMP-074).`

**Justified.** IMP-074's own notes explicitly require amending that wording in the same
change, and RFC 5545 §3.3.10 requires `UNTIL` to have the same value type as `DTSTART` (a
floating `DTSTART` requires a floating `UNTIL`). The old AC asserted the exact behavior this
item was opened to fix. No other acceptance criterion or spec text changed; the only other
`FEATURES.md` edit is IMP-074's status (`TODO -> IN-PROGRESS`), which is orchestration, not a
criterion. The IMP-073 note line visible in the diff is unchanged context.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Timed series emits floating `UNTIL=YYYYMMDDT235959` (no `Z`); all-day keeps bare `YYYYMMDD` and never gains a time | **Met** | Independent generation produced exactly `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630T235959` for timed and `...;UNTIL=20240630` for all-day. No `T235959Z` anywhere in the file. |
| 2 | Value-type argument is required (no default); typecheck fails if a default is reintroduced | **Met** | `dateOnlyStart: boolean` has no initializer; all five call sites pass a flag. Mutation: restoring `= false` makes `npm run typecheck` fail with `src/lib/ics.test.ts(93,7): error TS2578: Unused '@ts-expect-error' directive.` Restored afterwards; typecheck green again. |
| 3 | No local→UTC day shift; emitted day equals stored `until` day for TZ `-11..+14` | **Met** | At `Etc/GMT+11` (UTC−11) and `Pacific/Kiritimati` (UTC+14), `2024-01-01` and `2024-12-31` both emitted the stored day (`20240101`, `20241231`) in both the timed and all-day forms. `dateOnly()` continues to use local getters on a locally parsed date. |
| 4 | Timed output without `until` byte-identical to HEAD | **Met** | Independent side-by-side call of the current `itemsToICS` and a temporary copy of `git show HEAD:src/lib/ics.ts` on the same item produced identical strings (and the all-day control matched too). The only differing byte for a rule with `until` is the removed `Z`. |

## Independent ICS generation

Temporary Vitest probe (removed) built items via `createItem` and asserted exact physical
lines (CRLF-split):

Timed recurring with `until: '2024-06-30'`:

```
DTSTART:20240506T090000
RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630T235959
```

All-day recurring with the same `until`:

```
DTSTART;VALUE=DATE:20240506
RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630
```

Timed recurring without `until`:

```
RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO
```

and `currentICS([item]) === headICS([item])` passed (`item` reused for both calls so UID and
DTSTAMP were identical). Same comparison passed for the all-day control.

## Calendar-day check at both TZ extremes

```
TZ=Etc/GMT+11         until=2024-01-01 -> timed UNTIL=20240101T235959 / all-day UNTIL=20240101
TZ=Etc/GMT+11         until=2024-12-31 -> timed UNTIL=20241231T235959 / all-day UNTIL=20241231
TZ=Pacific/Kiritimati until=2024-01-01 -> timed UNTIL=20240101T235959 / all-day UNTIL=20240101
TZ=Pacific/Kiritimati until=2024-12-31 -> timed UNTIL=20241231T235959 / all-day UNTIL=20241231
```

Year boundaries exercise the worst case for a UTC conversion; none shifted.

## Gates

```
npm run typecheck   PASS  (no diagnostics)
npm run lint        PASS  (no output)
npm run test        PASS  33 files / 370 tests (impl report: baseline 369 + 1)
npm run build       PASS  tsc + vite build; PWA sw.js generated, 18 precache entries
TZ=Etc/GMT+11 npx vitest run src/lib/ics.test.ts         PASS  13/13
TZ=Pacific/Kiritimati npx vitest run src/lib/ics.test.ts  PASS  13/13
npx prettier --check src/lib/ics.ts src/lib/ics.test.ts    PASS
git diff --check                                            PASS
```

The four gates were re-run after restoring the mutated parameter and after deleting the
temporary probes.

## Findings / follow-ups (non-blocking)

1. **Impl report's status claim is inaccurate.** `.improve/reports/impl-IMP-074.md` says
   "IMP-074 status in `FEATURES.md` untouched", but the working tree contains
   `TODO -> IN-PROGRESS` (also reflected in `STATE.md` / `PROGRESS.log`). This is orchestration
   bookkeeping rather than a functional defect; after this PASS the item should be finalized as
   `DONE` with a DONE note rather than left `IN-PROGRESS`.
2. **No `DONE` note / status yet.** Expected for a verifier hand-off, but IMP-074's Notes still
   carry the pre-implementation text. The orchestrator should append the outcome (370 tests,
   TZ extremes, mutation check) when marking DONE.
3. The compile-time guard is a `@ts-expect-error`, which would also swallow an unrelated type
   error on that line. The restored-default mutation proves it fires for this specific
   regression, so this is acceptable; no action required.

No correctness, scope-creep, or leftover-debug issues found. No `discovered-IMP-074.md` is
warranted.
