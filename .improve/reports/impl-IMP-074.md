# IMP-074 — Implementation report

**Status:** implemented (all gates pass; IMP-074 status in `FEATURES.md` untouched)

## Files changed

| File | Change |
| --- | --- |
| `src/lib/ics.ts` | `recurrenceToRRule(rule, dateOnlyStart: boolean)` now requires the value-type argument (default removed). Timed `UNTIL` is emitted as `YYYYMMDDT235959` with no `Z`, matching the floating `DTSTART`; all-day still emits bare `YYYYMMDD`. `dateOnly()` keeps using local getters on a locally parsed date, so no UTC shift. |
| `src/lib/ics.test.ts` | All calls pass the explicit value-type flag. Timed `UNTIL` expectation is `T235959` with no `Z`; added a stored-day/TZ-independent assertion, an exact `DTSTART`/`RRULE` all-day+timed check (already present, updated), a no-`UNTIL` control for rules without `until`, and a `@ts-expect-error` one-arg call that makes `npm run typecheck` fail if the default is restored. |
| `.improve/FEATURES.md` | Amended IMP-014 AC2 wording only (“floating date-time with no `Z`”); no status changed by this implementation. |

## Approach

- The `Z` was the only source of the mismatch: `dateOnly(until)` is built from local
  `getFullYear/getMonth/getDate`, so it already describes a floating calendar day.
  Dropping the suffix makes `UNTIL` a floating value of the same type/shape as
  `DTSTART`, as RFC 5545 §3.3.10 requires.
- Removing the `= false` default makes `itemsToICS`'s `!timed` argument mandatory and
  prevents future callers from silently re-emitting a `Z` for a DATE series.
- No changes to the `start`/`end`/`DTSTART`/`DTEND` paths, so timed output for rules
  without `until` is byte-identical to HEAD.

## Verification

- `npm run typecheck` — PASS (370 tests suite; 33 files).
- `npm run lint` — PASS.
- `npm run test` — PASS, 33 files / 370 tests (baseline 369; one new test).
- `TZ=Etc/GMT+11 npx vitest run src/lib/ics.test.ts` — PASS, 13/13.
- `TZ=Pacific/Kiritimati npx vitest run src/lib/ics.test.ts` — PASS, 13/13 (UTC+14).
- Default-restoration check: temporarily restoring `dateOnlyStart = false` makes
  `npm run typecheck` fail with `TS2578 Unused '@ts-expect-error' directive` at
  `src/lib/ics.test.ts:93`; the default was then removed and all gates re-run green.

## Uncertainties / notes

- The requested `TZ=-11`/`TZ=+14` values are not valid IANA zones on this host, so the
  extremes were exercised with `Etc/GMT+11` (UTC−11) and `Pacific/Kiritimati` (UTC+14).
- No unrelated findings; no `discovered-IMP-074.md` was created.
