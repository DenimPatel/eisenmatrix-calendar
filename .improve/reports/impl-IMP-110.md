# impl-IMP-110 — Evaluate a reminder's fire time outside the occurrence's own day window

- **Status:** done
- **Category:** correctness / reminders
- **Type:** bug-fix
- **Source:** `.improve/reports/discover3-quality.md` (#1, S2)

## Problem

`upcomingReminders` expanded occurrences over the fire-time window `[from,to]` directly.
`expandOccurrences` floors that window to whole days, so an occurrence was only visible from
midnight of its own day. Any `offsetMinutes` reminder whose fire time crossed midnight was
never computed and fired at 00:00 of the occurrence day — the `-1440` ("1 day before") preset
~15 h late, `-600` ~1 h late.

## Change

`src/domain/reminders.ts` — `upcomingReminders` now widens the occurrence window by the
reminder offsets before filtering the computed fire times.

- Added `offsetBounds(reminders)`: min/max `offsetMinutes` (in ms) over the item's reminders,
  or `{0,0}` when none carry an offset (`absolute`/`timeOfDay` are unaffected).
- Expansion window becomes `[from - max, to - min]`, the exact pre-image of `[from,to]` under
  `fireAt = occStart + offset`. The existing `fireAt` filter (`:80`) still selects only the
  reminders inside `[from,to]`, so no extra rows are emitted and the sort is unchanged.

No caller change was needed; `ReminderRuntime`/`delivery` keep passing `[now - LOOKBACK_MS,
now + 30s]`.

## Acceptance criteria

1. Fire times on days before the occurrence day are now evaluated — covered by the two
   negative-offset tests below.
2. The `-1440` repro is returned by the window whose `to` is the fire time
   (`2026-01-04T09:00:30` + 30s) — test `evaluates a negative offset that fires on a day
   before the occurrence`.
3. Same-day offsets and `timeOfDay` keep their timing and the list stays sorted by `fireAt` —
   test `keeps same-day offsets and timeOfDay timing, sorted by fireAt`.

## Tests

`src/domain/reminders.test.ts` — new `upcomingReminders fire-time window` block using
fake timers and `LOOKBACK_MS` from `src/pwa/delivery.ts`:

- `-1440` on `2026-01-05T09:00` returned at `2026-01-04T09:00` (was `[]` before the fix).
- `-600` on `2026-01-05T09:00` returned at `2026-01-04T23:00` (was `[]` before the fix).
- `-10` and all-day `timeOfDay` control case unchanged and sorted.

## Gates

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — 46 files, 511 tests pass
- `npm run format:check` — pass

## Files changed

- `src/domain/reminders.ts`
- `src/domain/reminders.test.ts`
