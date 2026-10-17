# IMP-075 — Implementation report

**Status:** implemented (all gates pass; IMP-075 status in `FEATURES.md` untouched)

## Files changed

| File | Change |
| --- | --- |
| `src/lib/ics.ts` | All-day branch now parses `item.end` and, when its DATE value is later than the start DATE, emits `DTEND;VALUE=DATE:<end + 1 day>` using `addDays` from `src/lib/date.ts`. One-day (or missing/equal end) emits no `DTEND`; the timed branch is unchanged. |
| `src/lib/ics.test.ts` | Added exact-line tests: 4-day all-day item (`2024-05-06`→`2024-05-09` gives `DTEND;VALUE=DATE:20240510`), one-day control asserting no `DTEND`, and month-end case (`2024-01-31`→`2024-02-03` gives `20240204`). |

## Approach

- RFC 5545 §3.6.1 makes `DTEND` exclusive, so the stored inclusive `end` day is
  incremented by one calendar day. `addDays` uses local date arithmetic, so
  month-end and leap-year rollover clamp correctly (`2024-02-03` → `2024-02-04`).
- The comparison uses `dateOnly(end) > dateOnly(start)`, so an all-day item whose
  `end` carries an incidental time component on the same day still emits no
  `DTEND` and stays byte-identical to HEAD.
- Timed items follow the original path untouched.

## Verification

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run test` — PASS, 33 files / 373 tests (baseline 370; three new tests).

## Uncertainties / notes

- Multi-day all-day items with no `end` cannot express a range and continue to emit
  only `DTSTART` (implicit one day); the item model has no separate duration field.
- No unrelated findings; no `discovered-IMP-075.md` was created.
