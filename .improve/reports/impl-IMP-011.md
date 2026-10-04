# IMP-011 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File                         | Change                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/domain/quickadd.ts`     | `on the <N>` is no longer stripped unconditionally. The matched day is kept as `monthDay: number \| null` with an `monthDayApplied` flag; the token is consumed from `working` only after the date is resolved and only if it was actually applied (as `byMonthDay` or as the start date). A new `nextMonthDay(from, day)` helper resolves the next matching day-of-month using `clampDayOfMonth` (month-end clamped, never skipped). |
| `src/domain/quickadd.test.ts` | Three new cases in the existing `parseQuickAdd` describe block.                                                                                                                                                                                                                 |

Diff (only `quickadd.ts` changed in `src/`):

```ts
// Month day: "on the 5th" — a byMonthDay rule when monthly, else the next such date
const monthDayMatch = /\bon the (\d{1,2})(?:st|nd|rd|th)?\b/i.exec(working);
const monthDay = monthDayMatch ? Number(monthDayMatch[1]) : null;
let monthDayApplied = false;
if (monthDay !== null && recurrence?.freq === 'monthly') {
  recurrence.byMonthDay = [monthDay];
  monthDayApplied = true;
}

if (!dateKey) {
  if (loneWeekday !== null) {
    dateKey = formatISODate(nextWeekday(now, loneWeekday));
  } else if (!monthDayApplied && monthDay !== null && monthDay >= 1 && monthDay <= 31) {
    dateKey = formatISODate(nextMonthDay(now, monthDay));
    monthDayApplied = true;
  } else {
    /* today + monthOffset + dayOffset, unchanged */
  }
}

if (monthDayApplied && monthDayMatch) working = working.replace(monthDayMatch[0], ' ');
```

### Design notes

- **Deferred consumption.** Leaving the token in `working` while the date section runs is safe: none
  of the later patterns (`\bin (\d+)\s+(day|week|month)…`, `YYYY-MM-DD`, `am/pm`, `HH:MM`) can match
  inside `on the 5th`. Deferring the `replace` is what makes criterion 3 possible — the decision
  depends on the date resolution that happens further down.
- **"Next" excludes today**, matching the existing `nextWeekday` convention
  (`(weekday - d.getDay() + 7) % 7 || 7`): on 2024-06-10, `on the 5th` → `2024-07-05`, not today.
- **Clamping** via `clampDayOfMonth` (REPO_PROFILE §6 / AGENTS.md month-end rule): from 2024-04-20,
  `on the 31st` → `2024-04-30` (April has 30 days) rather than skipping to May.
- **Precedence** is unchanged in shape: ISO date / relative words / `next <weekday>` (and now a lone
  weekday, from IMP-010) all win over the month day. An out-of-range day (`on the 0th`, `on the 99th`)
  is never applied, so it stays in the title — the least lossy outcome.
- The monthly path is deliberately unchanged: `byMonthDay` is set and the token is consumed, exactly
  as before, and `start` stays on today (criterion 1 is scoped to "no recurrence is present"). The
  next-date fallback is therefore gated on `!monthDayApplied`, so a monthly rule is never re-anchored
  — an intermediate iteration without that gate did move
  `pay rent every month on the 5th` from `2024-06-10` to `2024-07-05`, which is out of scope and is
  written up as a separate finding below.

## Acceptance criteria

1. Month day parsed, no recurrence → `start` is the next such day-of-month —
   `party on the 5th` with `now = 2024-06-10T12:00:00` → `start 2024-07-05`, `recurrence null`
   (plus `party on the 31st` from 2024-04-20 → `2024-04-30`).
2. Monthly recurrence → `byMonthDay` set — `pay rent every month on the 5th` →
   `freq 'monthly'`, `byMonthDay [5]`, `title 'Pay rent'`; the pre-existing
   `pay electricity $120 every month on the 5th !urgent` test still passes.
3. Token removed only when applied — asserted in all three new tests: `Party` and `Pay rent` for the
   applied cases, `Party on the 5th` for `party on the 5th 2024-03-04`, where the explicit date wins
   and the day is not applied.

## Tests added

Three cases in `src/domain/quickadd.test.ts` (131 → 134 tests across 20 files, all passing):

- `schedules a bare "on the 5th" on the next 5th and keeps the text out of the title` —
  `party on the 5th` → `title 'Party'`, `start 2024-07-05`, `recurrence null`; plus
  `party on the 31st` from 2024-04-20 → `2024-04-30` (clamped month-end).
- `applies "on the 5th" as byMonthDay for monthly rules` — `pay rent every month on the 5th` →
  `byMonthDay [5]`, `title 'Pay rent'`, `start 2024-06-10` (pins that the anchor is not moved).
- `keeps "on the 5th" in the title when an explicit date wins` — `party on the 5th 2024-03-04` →
  `start 2024-03-04`, `title 'Party on the 5th'`.

All use a fixed `now`, and dates go through local `formatISODate` only (no `toISOString`), so they are
timezone- and clock-independent.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (20 files, 134 tests passed) ·
`npm run build` (OK, `dist/sw.js` emitted, 18 precache entries, 603.48 KiB) ·
`npx prettier --check` clean on both touched files.

## Notes for the verifier

- No UI change needed: `QuickAdd` re-parses on every keystroke and renders its chips from the same
  `QuickAddResult`, so the `date` chip and the card preview now show the resolved 5th.
- Out-of-scope observations (monthly anchor mismatch, the `on the 0th` residue, ambiguity when a
  month day and a lone weekday appear together) are in
  `.improve/reports/discovered-IMP-011.md`. Do not fold them into this item.
