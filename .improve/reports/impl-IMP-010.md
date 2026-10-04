# IMP-010 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File                         | Change                                                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/quickadd.ts`     | A lone weekday token is now consumed from the title and resolves the date. New `loneWeekday: number \| null` state; the lone-weekday branch also clears `weekdays` so no weekly rule is synthesised. The final date fallback uses `formatISODate(nextWeekday(now, loneWeekday))` when `loneWeekday` is set, otherwise the previous today/offset base. |
| `src/domain/quickadd.test.ts` | Four new cases in the existing `parseQuickAdd` describe block.                                                                                                                                                                                          |

Diff (12 added lines in `quickadd.ts`, no other module touched):

```ts
const weekdayListMatch = weekdayListRe.exec(working);
let weekdays: number[] = [];
let loneWeekday: number | null = null;
if (weekdayListMatch) {
  …
  const before = working.slice(0, weekdayListMatch.index);
  if (weekdays.length > 1 || /every/i.test(input)) {
    working = working.replace(weekdayListMatch[0], ' ');
  } else if (weekdays.length === 1 && !/\bnext\s*$/i.test(before)) {
    loneWeekday = weekdays[0];
    weekdays = [];
    working = working.replace(weekdayListMatch[0], ' ');
  } else {
    weekdays = [];
  }
}
…
if (!dateKey) {
  if (loneWeekday !== null) {
    dateKey = formatISODate(nextWeekday(now, loneWeekday));
  } else {
    let base = now;
    if (monthOffset) base = addMonths(base, monthOffset);
    if (dayOffset) base = addDays(base, dayOffset);
    dateKey = formatISODate(base);
  }
}
```

`nextWeekday` is reused as the spec's note asks, so "gym fri" and "gym next fri" share one
convention: the next occurrence **not counting today** (`(weekday - d.getDay() + 7) % 7 || 7`).

### Two details worth calling out

- **`weekdays = []` in the lone branch.** Without it the `if (weekdays.length)` block below
  synthesised a `weekly` rule with a single `byWeekday` — caught by the first test run
  ("gym fri" returned `recurrence { freq: 'weekly', byWeekday: [5] }`).
- **The `next` guard.** The weekday-list regex also matches the `fri` inside `next fri`. Consuming
  it would leave `next` stranded in the title and break the pre-existing
  `\bnext\s+(sun|mon|…)` branch, so a lone weekday immediately preceded by `next` is left in
  place for that branch. `working.slice(0, weekdayListMatch.index)` supplies the look-behind
  context (no lookbehind in the target, so no regex flag risk).

### Precedence chosen

`next <weekday>` → ISO date → lone weekday → today/relative offset. An explicit ISO date or
relative word still wins (`gym fri 2024-03-04` → `2024-03-04`, `gym fri tomorrow` → tomorrow),
while the token is stripped from the title in every case. The lone weekday is placed in the final
fallback rather than next to the `next <weekday>` branch so that "tomorrow"/"in 3 days" are not
silently ignored when both are present.

## Acceptance criteria

1. Lone weekday consumed, `dateKey` = next occurrence — `schedules a lone weekday on the next
   occurrence of that weekday` (`gym fri` → `start 2024-06-14`; `call mon` on Monday 2024-06-10 →
   `2024-06-17`, i.e. not today).
2. Two or more weekdays still produce a weekly rule — `keeps multiple weekdays as a weekly rule…`
   (`standup tue and thu` → `freq weekly`, `byWeekday [2,4]`) plus the untouched existing
   `gym mon/wed/fri 7am` test and the new `gym every week fri 7am` case.
3. Title no longer contains the weekday token — asserted in all four new tests (`Gym`, `Call`,
   `Standup`); the `every` and `next` paths assert `Gym` too.

## Tests added

Four cases in `src/domain/quickadd.test.ts` (49 → 131 total tests across 20 files, all passing):

- `schedules a lone weekday on the next occurrence of that weekday` — `gym fri`, `call mon` with
  `now = 2024-06-10T12:00:00` (a Monday).
- `keeps a lone weekday as a weekly rule when "every" is present` — `gym every week fri 7am`
  still yields `byWeekday [5]` and does **not** move the anchor.
- `keeps multiple weekdays as a weekly rule without a "next" residue` — `standup tue and thu`
  (multi-weekday) and `gym next fri` (regression guard for the `next` look-behind).

All cases use a fixed `now`, so they are timezone- and clock-independent (local `formatISODate`
throughout, no `toISOString`).

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (20 files, 131 tests
passed) · `npm run build` (OK, `dist/sw.js` emitted, 18 precache entries, 603.15 KiB).
`npx prettier --check` clean on both touched files.

## Notes for the verifier

- No UI change: `QuickAdd` re-parses on every keystroke and renders chips from the same
  `QuickAddResult`, so the `date` chip and card preview now show the resolved Friday/Monday.
- Consequences of widening consumption to a single token (ambiguous words, the "every" title
  residue, the recurrence-anchor mismatch) are pre-existing or out of scope and are written up in
  `.improve/reports/discovered-IMP-010.md`. Do not fold them into this item.
