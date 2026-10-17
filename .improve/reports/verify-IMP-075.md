# Verify IMP-075 — Export multi-day all-day items with an exclusive `DTEND`

**Verdict: PASS**

Verified independently on `improve/auto-20261017` at `2acc3af` + working-tree
changes. The verifier did not write the change.

## Scope reviewed

`git diff HEAD -- src/lib/ics.ts src/lib/ics.test.ts`

- `src/lib/ics.ts`: one import (`addDays`) and four lines in the all-day branch. The
  timed branch and every other line are untouched.
- `src/lib/ics.test.ts`: three additive tests (4-day, one-day control, month-end) in
  the existing `describe('ics')` block, matching the file's style (`createItem`,
  exact-line assertions).
- No leftovers, debug output, or unrelated edits. The comment on the new branch
  explains non-obvious RFC intent, consistent with AGENTS.md.
- `.improve/{FEATURES,STATE,PROGRESS}` changes are coordinator bookkeeping, not part
  of the source change.

## Acceptance criteria

| # | Criterion | Result | Evidence |
| - | --- | --- | --- |
| 1 | Multi-day all-day emits `DTEND;VALUE=DATE:<end + 1>` | **MET** | `2024-05-06..05-09` → `DTSTART;VALUE=DATE:20240506` + `DTEND;VALUE=DATE:20240510`. 2-day `05-06..05-07` → `DTEND;VALUE=DATE:20240508`. |
| 2 | One-day all-day emits no `DTEND`, byte-identical to HEAD | **MET** | `2024-05-06..05-06` output has no `DTEND`; full-string equality against a materialized `git show HEAD:src/lib/ics.ts` module returned `true`. |
| 3 | Timed items untouched | **MET** | Untimed branch unchanged in the diff. `2024-05-06T09:00..10:00` → `DTSTART:20240506T090000` / `DTEND:20240506T100000`; full output byte-identical to HEAD. |
| 4 | Month-end clamping valid | **MET** | `2024-01-31..2024-02-03` → `DTSTART;VALUE=DATE:20240131` + `DTEND;VALUE=DATE:20240204`; `parseLocalDate` + date-fns `addDays` use local calendar arithmetic (no invalid dates). |

Additional boundary checks (all pass):

- End equals start (`2024-05-06..05-06`): no `DTEND` line.
- Year-end rollover: `2024-12-30..2024-12-31` → `DTEND;VALUE=DATE:20250101`;
  `2024-12-31..2025-01-01` → `DTEND;VALUE=DATE:20250102`; single-day
  `2024-12-31` → no `DTEND`.
- All-day `end` with incidental same-day time (`2024-05-06T23:00`): no `DTEND`,
  matching the implementation report's claim (comparison is on `dateOnly`).

## Gates

Ran from the repo root:

```
npm run typecheck   # PASS, no diagnostics
npm run lint        # PASS, no output
npm run test        # PASS, 33 files / 373 tests
npm run build       # PASS, dist/sw.js generated, 18 precache entries
```

373 = prior 370 + the 3 added tests; matches the implementation report.

## Independent generation method

Materialized the HEAD version of `src/lib/ics.ts` as a temporary sibling module,
imported both implementations into a temporary Vitest file, and compared outputs for
fixed `updatedAt` items. Extracted lines:

```
CASE4DAY   DTSTART;VALUE=DATE:20240506  DTEND;VALUE=DATE:20240510
CASE1DAY   DTSTART;VALUE=DATE:20240506                    (IDENTICAL true)
CASEMONTH  DTSTART;VALUE=DATE:20240131  DTEND;VALUE=DATE:20240204
CASETIMED  DTSTART:20240506T090000      DTEND:20240506T100000 (IDENTICAL true)
CASE2DAY   DTSTART;VALUE=DATE:20240506  DTEND;VALUE=DATE:20240508
CASESAME   DTSTART;VALUE=DATE:20240506
CASEYEARS  DTSTART;VALUE=DATE:20241230  DTEND;VALUE=DATE:20250101
CASEYEARC  DTSTART;VALUE=DATE:20241231  DTEND;VALUE=DATE:20250102
CASEYEARS1 DTSTART;VALUE=DATE:20241231
```

Both temporary files were deleted; `git status` afterwards shows only the intentional
change plus the untracked implementation report.

## Observations (non-blocking)

- The committed month-end test ends on `2024-02-03`, so its `+1` stays inside February
  and does not itself exercise a month rollover. The implementation still handles the
  rollover correctly (`addDays`), and the independent year-end cases confirm the
  arithmetic; a multi-day item ending on `2024-01-31` → `DTEND;VALUE=DATE:20240201`
  would make the test slightly stronger. Not a criterion failure.
- `dateOnly` emits zero-padded `YYYYMMDD`, so the string `>` comparison is a valid
  date comparison for the normal 4-digit-year range. No issue found.
- A multi-day all-day item without `end` still exports as a single day; the model has
  no duration field, as noted in the implementation report. Out of scope.

## Health delta suggestion

| Dimension | Delta | Rationale |
| --- | --- | --- |
| Bugs/Correctness | 0 (hold at 4) | Closes a narrow interop defect; no new correctness debt. Optionally note the remaining IMP-076 occurrence-map gap. |
| Tests/Tooling | 0 (hold at 4) | +3 focused tests (370 → 373); no tooling change. |
| Delivery / UX / Accessibility / Performance / Docs | 0 | Untouched. |

No regressions, no scope creep, no follow-up required for this item.
