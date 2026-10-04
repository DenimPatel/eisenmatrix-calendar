# IMP-014 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File                     | Change                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/ics.ts`         | `recurrenceToRRule(rule, dateOnlyStart = false)`; `UNTIL` suffix becomes conditional. `itemsToICS` passes `!timed`. 3 production lines. |
| `src/lib/ics.test.ts`    | +4 tests (156 → 160 total, 22 files).                                     |

```ts
if (until) parts.push(`UNTIL=${dateOnly(until)}${dateOnlyStart ? '' : 'T235959Z'}`);
```

```ts
if (item.recurrence) lines.push(`RRULE:${recurrenceToRRule(item.recurrence, !timed)}`);
```

### Design notes

- **The signal is `!timed`, not `item.allDay`.** `itemsToICS` already computes
  `const timed = !item.allDay && hasTimeComponent(item.start)` and branches DTSTART on it
  (`:92`, `:102-108`). Passing `!timed` makes `UNTIL`'s value type a *function of the same
  variable that chose DTSTART's*, which is what AC1/AC2 actually require ("matching
  DTSTART"). An item flagged `allDay: true` whose `start` still carries a time is exported
  as `DTSTART;VALUE=DATE`; keying off `item.allDay` would have produced a mismatched pair
  for exactly that item.
- **Defaulted parameter keeps the change additive.** `dateOnlyStart = false` preserves the
  single-argument call in the existing test and any future caller; only `itemsToICS`
  changes behaviour. Residual noted in `discovered-IMP-014.md` §4.
- **No change to the timed output**, per AC2 — the literal `T235959Z` is byte-identical to
  before. It is arguably still wrong for a *floating* DTSTART; that needs the backlog owner
  to amend AC2, so it is recorded, not fixed (`discovered-IMP-014.md` §1).

## Acceptance criteria

1. **All-day/date-only start → bare `YYYYMMDD`.** `it('emits a bare date UNTIL for
   date-only starts')` asserts the exact string
   `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240630`, and the integration test asserts the
   same value inside a real VEVENT.
2. **Timed events keep a UTC date-time.** `it('emits a UTC date-time UNTIL for timed
   starts')` covers both the explicit `false` and the omitted-argument default, and pins
   `UNTIL=20240630T235959Z`.
3. **Rules without `until` unchanged.** `it('omits UNTIL entirely when the rule has
   none')` asserts the identical string for `dateOnlyStart` `true` *and* `false`; the
   pre-existing weekly/`BYDAY` and event-export tests still pass untouched, which is the
   regression net for AC3.

The spec's verification method ("assert the exact `RRULE` line") is covered by the fourth
test, `keeps RRULE UNTIL matching the emitted DTSTART value type`, which round-trips an
all-day task and a timed event through `itemsToICS` and asserts each full RRULE line.

## Tests

`src/lib/ics.test.ts`, 4 new cases. A shared `weeklyRule` fixture with
`until: '2024-06-30'` covers the unit surface; the integration case builds two items via
`createItem` (same pattern as the existing tests) and assigns `recurrence` directly.

**One real trap, found by mutation testing.** The integration test first asserted
`toContain('RRULE:...UNTIL=20240630')` for the all-day item — which the *buggy*
`UNTIL=20240630T235959Z` output satisfies as a substring. The assertion was anchored on
`\r\n…\r\n` instead, so it now matches a whole content line and the trailing `T235959Z`
cannot slip through. `RRULE` is always preceded by `DTSTART` and followed by `END:VEVENT`,
so the anchor is stable.

**Mutation check:** reverting the ternary to the unconditional `'T235959Z'` fails exactly
2 of the 4 new tests (the unit bare-date case and the integration case) and leaves the
other 5 in the file green — the suite pins the fix, not the plumbing.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (22 files, 160 tests
passed) · `npm run build` (OK, `dist/sw.js`, 18 precache entries, 603.67 KiB) ·
`npx prettier --write` applied to both touched files.

`.improve/PROGRESS.log` shows an IMP-013 line in `git diff`; that is a concurrent session's
entry, not mine. Nothing was committed.

## Notes for the verifier

- Out-of-scope findings, do not fold them into this item:
  `.improve/reports/discovered-IMP-014.md` — (1) timed `UNTIL` is a local wall-clock value
  tagged `Z` against a floating `DTSTART` (contradicts AC2 as written; needs an owner
  decision), (2) multi-day all-day events export as a single day, (3) content lines are
  never folded at 75 octets, (4) the new flag defaults to the timed form.