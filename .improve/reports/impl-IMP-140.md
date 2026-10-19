# IMP-140 — Stop reminders for done or cancelled occurrences

**Status:** done
**Category:** correctness / reminders
**Source:** `.improve/FEATURES.md` §IMP-140; `.improve/reports/discover4-quality.md` C2

## Change

`src/domain/reminders.ts` — `upcomingReminders` now skips an expanded occurrence whose
resolved `status` is `done` or `cancelled` before computing any fire time:

```ts
for (const occurrence of occurrences) {
  if (occurrence.status === 'done' || occurrence.status === 'cancelled') continue;
  for (const reminder of item.reminders) { ... }
}
```

`occurrence.status` is the resolved value produced by `resolveOccurrenceStatus`
(`src/domain/recurrence.ts:217-226`) inside `buildOccurrence`, so it already honours
`item.occurrences[key].status` (the single status store written by `setStatus`/`toggleDone`)
and falls back to the series status for non-recurring items.

## Runtime (`src/pwa/ReminderRuntime.tsx`)

No second change. The `deliver` path (lines 111-133) builds its candidates **only** from
`upcomingReminders` (with a redundant `fireAt` window filter), so it never sees a filtered
occurrence. Adding a status re-check there would duplicate the rule in two places for no gain.

## Skipped occurrences

Unchanged and still suppressed: `expandOccurrences` drops `recurrence.exceptions`, so a
skipped occurrence is absent before the status check runs. `todo`/`doing` occurrences and all
fire-time math (`offsetMinutes`, `timeOfDay`, `absolute`, cross-midnight) are untouched.

## Tests

`src/domain/reminders.test.ts` — new `upcomingReminders occurrence status` suite. For each of a
relative-offset reminder and a time-of-day reminder on a daily task at 09:00, it runs a
todo/doing/done/cancelled matrix (`todo`/`doing` schedule one entry at 09:00; `done`/`cancelled`
schedule none), plus a skipped-exception case that stays empty.

Falsification check: removing the two-line status filter makes 6 of the new tests fail
(4 matrix cases × 2 reminder kinds + 2 explicit "done or cancelled" cases), confirming the
suite pins the behavior rather than passing incidentally.

## Verification (all pass)

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 74 files / 751 tests passed
- `npm run format:check` — all files formatted
- `npm run build` — PWA built, `dist/sw.js` generated

Not committed (per instruction). No backlog/state files edited.

## Files changed

- `src/domain/reminders.ts`
- `src/domain/reminders.test.ts`
