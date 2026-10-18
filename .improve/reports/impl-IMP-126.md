# impl-IMP-126 — Complete habits from the Today dashboard

**Status:** done

## Change

`src/features/today/TodayView.tsx`

- The Today "Habits" ring is now a real toggle. Each row's ring is wrapped in a
  `<button>` that calls the shared `toggleHabitOccurrence(habit)` from
  `src/domain/itemActions.ts`, which mirrors `HabitsView.markToday`: it expands today's
  occurrence with `expandOccurrences(habit, startOfDay(now), endOfDay(now))[0]` and
  persists through `toggleDone` (same path as HabitsView), falling back to `todayKey()`
  when no occurrence expands.
- The button carries an accessible name (`Complete <habit> for today` /
  `Undo <habit> for today`) and `aria-pressed={doneToday}`, and uses a 44×44 CSS-px
  target (`h-11 w-11`) with `focus-visible:ring-accent` and semantic
  `hover:bg-elevated`; the ring keeps `ProgressRing` with the `success`/`accent`
  tones. The `Edit` button is unchanged.
- `doneToday` now counts today's completed occurrences against
  `Math.max(1, habit.data.target.count)`, matching HabitsView, instead of the previous
  "any done occurrence" check. `habits` is narrowed to `HabitItem` so the target is
  typed.
- Ring and streak update in place from the `useLiveQuery` re-render; no navigation.

`src/domain/itemActions.ts` — added `toggleHabitOccurrence(habit)` (expand today's first
occurrence, `toggleDone` with `todayKey()` fallback). `HabitsView.markToday` now delegates
to it, so the two entry points cannot drift; behavior is unchanged.

## Tests

`src/features/today/TodayView.test.tsx` — new `TodayView habit completion` suite:

1. Toggling the ring flips `aria-pressed` false→true, asserts the 44 px target classes,
   shows `✓` and updates the streak to `1 day streak`, and verifies the stored
   occurrence status is `done`.
2. Toggling a completed habit off reverts the label to `Complete …`, `aria-pressed`
   false, and removes `✓`.

Existing Today habit rendering tests still pass.

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check` — all pass
(47 files, 537 tests).

## Visual verification

Built `dist/`, ran `npm run preview` on 4173, reset service-worker registrations and
caches, then reloaded via `about:blank`. Verified the ring renders and toggles in both
themes at 1280 and 390; the measured target is 44×44 with `aria-pressed` and the
`Complete Journal for today` label. Screenshots in `.improve/artifacts/IMP-126/`
(`today-{1280,390}-{light,dark}-{before,after}.png`). Preview server stopped afterwards.

## Notes

- Follow-up per `verify-IMP-126.md` F1: the duplicated `markToday`/`toggleHabitToday`
  logic is now one shared `toggleHabitOccurrence` helper used by both views.
- Verifier findings F2 (multi-count habits never complete) and F3 (phantom occurrence for
  unscheduled days) were left unfixed and logged in `.improve/reports/discovered-IMP-126.md`.
- No changes outside the item.
