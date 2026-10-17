# IMP-073 — Implementation report

**Status:** implemented (all gates pass; `FEATURES.md` status untouched)

## Files changed

| File                         | Change                                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/quickadd.ts`     | Weekday matching now loops over **all** groups (`matchAll` + a global regex). A lone weekday is only consumed when it is a hint — at end of input, or immediately after `on`/`at`/`start` (or `every`, which establishes a weekday recurrence) — or when it belongs to an `every <week>` phrase (`gym every week fri 7am`). A leftover bare `every` is removed once a weekday rule is established. Non-hint lone weekdays stay in the title and no longer re-date the item. |
| `src/domain/quickadd.test.ts` | Five cases: the three repros, trigger-position hints, and the IMP-010/IMP-011 control corpus.                                                                                                                                                  |

## Approach

- Replaced the single `weekdayListRe.exec` with `working.matchAll(...)`; each match is decided from its
  own `before`/`after` context, then consumed ranges are spliced out in reverse index order.
- Multi-weekday groups always produce a weekly `byWeekday` rule (previous behaviour).
- Lone weekday:
  - immediately after `next` → left for the existing `next <weekday>` branch (unchanged);
  - immediately after `every` → weekday recurrence (`gym every fri`);
  - group immediately after an `every <n> week(s)` phrase → attached to that weekly rule, preserving
    `gym every week fri 7am`;
  - ends the input or follows `on|at|start` → lone date hint (`nextWeekday`);
  - otherwise → untouched ordinary title text, item not re-dated.
- After a weekday rule exists, the first remaining `\bevery\b` is consumed.

## Repro results (`now = 2024-06-10T12:00:00`, Monday)

| input                          | title              | start        | recurrence                 |
| ------------------------------ | ------------------ | ------------ | -------------------------- |
| `gym every fri`                | `Gym`              | `2024-06-10` | `weekly`, `byWeekday [5]`  |
| `sun the tomatoes fri`         | `Sun the tomatoes` | `2024-06-14` | `null`                     |
| `gym fri`                      | `Gym`              | `2024-06-14` | `null`                     |
| `call mon`                     | `Call`             | `2024-06-17` | `null`                     |
| `mon/wed/fri`                  | ``                 | `2024-06-10` | `weekly [1,3,5]`           |
| `next fri`                     | ``                 | `2024-06-14` | `null`                     |
| `party on the 5th`             | `Party`            | `2024-07-05` | `null`                     |
| `pay rent every month on the 5th` | `Pay rent`      | `2024-06-10` | `monthly`, `byMonthDay [5]`|

For `sun the tomatoes fri`, the trailing `fri` is consumed as the date hint and the item lands on
Friday; `sun` is intentionally retained because AC3 requires a lone weekday in a non-hint position to
stay in the title and not re-date the item. AC2's phrase “leaves no weekday token” is therefore read
as “no leftover schedule weekday token”; `Sun` is ordinary title text under AC3, not a schedule token.
This is the one literal tension in the spec (see Uncertainties).

## Verification

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run test` — PASS, 33 files / 365 tests (baseline 365; five new cases replace none).
- `npx prettier --check src/domain/quickadd.ts src/domain/quickadd.test.ts` — PASS.
- Differential sweep vs `HEAD` over the IMP-010/011 corpus plus the new shapes (temporary Vitest
  harness, removed afterwards): byte-identical for all AC4 controls (`gym fri`, `call mon`,
  `mon/wed/fri`, `next fri`, `on the <N>` variants) and for `gym every week fri 7am`. All diffs were
  confined to the three fixed shapes: bare-`every` titles, second weekday groups, and non-hint lone
  weekdays previously eaten as dates.
- Mutation checks (each mutation restored immediately):
  1. removing the bare-`every` strip → `consumes a bare "every"…` fails;
  2. iterating only the first weekday group → `consumes a second weekday group…` fails;
  3. disabling the hint-position gate → the non-hint and second-group tests fail.

## Uncertainties / notes

- **AC2 vs AC3 wording.** AC2's example `sun the tomatoes fri` says “leaves no weekday token”, while
  AC3 explicitly requires a lone weekday that neither ends the input nor follows a trigger to stay in
  the title. The implementation follows AC3 for `sun` and removes only the trailing `fri`. If a
  verifier expects the literal title `The tomatoes`, that would conflict with AC3's “stays in the
  title”.
- `every week gym fri 7am` (weekday separated from its `every week` phrase by a title word) now
  leaves `fri` in the title, because AC3 only admits a lone weekday as a hint at end-of-input or after
  a trigger. The supported form `gym every week fri 7am` is unchanged and pinned by the existing test.
- No unrelated findings; no `discovered-IMP-073.md` was created.
