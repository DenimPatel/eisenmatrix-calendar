# verify-IMP-126 — Let habits be completed from the Today dashboard

**Reviewer:** independent skeptical pass
**Branch:** improve/auto-20261017
**Diff under review:** `src/features/today/TodayView.tsx`, `src/features/today/TodayView.test.tsx`
**Impl report:** `.improve/reports/impl-IMP-126.md`
**Verdict:** PASS — acceptance criteria met. Issues found are **shared with `HabitsView`, not drift**; no source modified.

## Acceptance criteria

| # | Criterion | Result | Evidence |
| - | --------- | ------ | -------- |
| 1 | Clicking a Today habit ring/row toggles today's occurrence through the same path as `HabitsView.markToday`, updating ring + streak in place without leaving Today | PASS | Ring is a `<button>` calling `toggleHabitToday` → `expandOccurrences(...)[0]` → `toggleDone` (same calls as `HabitsView.tsx:60-63`). Browser: label flipped `Complete Journal for today`→`Undo Journal for today`, `aria-pressed` false→true, ring `0`→`✓`, streak `0 day streak · best 0`→`1 day streak · best 1`; URL stayed `#/today`; IndexedDB `occurrences["2026-10-18"].status === "done"`. |
| 2 | Tests pass | PASS | `npm run test` → 47 files / 537 tests pass, including the two new `TodayView habit completion` cases. |

## Gates (all run on the working tree)

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — pass (47 files, 537 tests)
- `npm run format:check` — pass

## Browser verification (preview build, port 4173)

`npm run build` then `npm run preview`; unregistered the SW and deleted `workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/`, forced a real document load via `about:blank`, then re-navigated. Server stopped afterwards.

| Check | Result |
| ----- | ------ |
| Ring is a real toggle (count=1 habit) | PASS — `aria-pressed` flips, `✓` and streak update in place, no navigation |
| Target size / a11y name | PASS — measured 44×44 CSS px at 1280 and 390; `aria-label` `Complete <name> for today` / `Undo <name> for today`; `aria-pressed` |
| Layout at 390 px | PASS — no horizontal overflow (`scrollWidth 390 == clientWidth`), button 44×44 inside the card row |
| Light + dark | PASS — `success`/`accent` tones and `hover:bg-elevated`/`focus-visible:ring-accent` use semantic tokens; verified via `prefers-color-scheme: dark` |
| Rapid double click | PASS — two clicks from `todo` settle to `done` (`Undo …`, `1 day streak`); two clicks from `done` settle to `todo`. Stale-prop `toggleDone` is idempotent per direction; no double-toggle-back |
| Undo `⌘Z` | PASS — after completing, `Meta+z` restored `Complete Journal for today`, `0 day streak`, and removed `✓` |

Artifacts: `.improve/artifacts/verify-IMP-126/today-390.png`, `today-390-dark.png`.

## Findings

### F1 (minor, maintainability) — logic duplicated from `HabitsView.markToday`, no drift
`TodayView.toggleHabitToday` (`TodayView.tsx:91-94`) is a character-for-character copy of `HabitsView.markToday` (`HabitsView.tsx:60-63`): identical `expandOccurrences(habit, startOfDay(new Date()), endOfDay(new Date()))[0]` and `toggleDone(habit, occ?.occKey ?? todayKey())` (HabitsView's `today` is `todayKey()`). **No drift today**, but the two copies can diverge silently. Recommend extracting one shared helper (e.g. `toggleHabitOccurrence(habit)` in `src/domain/itemActions.ts` or `src/domain/stats.ts`) and calling it from both views. The acceptance criterion only requires the "same path", so this is not a blocker.

### F2 (minor, shared with HabitsView) — `count > 1` habits never render as complete
The `doneToday` gate is `doneCount >= Math.max(1, habit.data.target.count)` (`TodayView.tsx:209-212`), but a daily/weekly recurrence expands at most **one** occurrence per day (`recurrence.ts` has no reference to a habit's `target`), so `doneCount` can never reach 2+. Verified in-browser with a 3×/day habit: after one click the ring stayed `0` / `Complete … for today` and a second click toggled the single occurrence back off. The identical gate exists in `HabitsView.tsx:99`, so this is a pre-existing shared limitation, not drift — but the new Today affordance inherits it and is misleading for multi-count habits.

### F3 (minor, shared with HabitsView) — habits not scheduled today write a phantom occurrence
A habit not scheduled for today is still listed, and `expandOccurrences(...)` returns `[]`, so the `?? todayKey()` fallback persists a status for a day the habit is not scheduled. Verified: a weekly Monday-only habit on Sunday (2026-10-18) stored `occurrences["2026-10-18"].status === "done"` while the ring stayed `Complete … for today` (no visible effect, since the Today occurrence window excludes it). Same fallback in `HabitsView.markToday`, so no drift; the Today entry point makes the write reachable from a second surface. Consider gating the toggle on a today occurrence existing, or hiding unscheduled habits.

## Notes

- No unrelated changes; diff touches only the two files above.
- New tests cover the count=1 toggle on/off, the 44 px classes, `aria-pressed`, the `✓`, the streak update and the persisted occurrence — but not F2/F3.
- Browser-only test data created during this pass (Water/Gym habits) was removed; only the pre-existing `Journal` habit remains in the profile.
