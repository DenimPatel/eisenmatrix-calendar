# discovered-IMP-126 — Issues not fixed in this pass

**Source:** `.improve/reports/verify-IMP-126.md`
**Scope:** logged only; the follow-up task was limited to extracting the shared
habit-toggle helper (F1). F2 and F3 are pre-existing, shared with `HabitsView`, and
left untouched.

## F2 (minor) — `count > 1` habits never render as complete

`doneToday` is `doneCount >= Math.max(1, habit.data.target.count)` (Today) and the same
gate exists in `HabitsView.tsx`. A daily/weekly recurrence expands at most one
occurrence per day (`recurrence.ts` ignores a habit's `target`), so `doneCount` can
never reach 2+. A 3×/day habit therefore never shows complete and a second click
toggles the single occurrence back off.

- **Location:** `src/features/today/TodayView.tsx`, `src/features/habits/HabitsView.tsx`
- **Impact:** misleading affordance for multi-count habits; shared pre-existing limitation.
- **Suggested fix:** represent per-day progress from an explicit per-occurrence count, or
  expand `target.count` occurrences per day in the recurrence engine, before using the
  `>= target.count` gate.

## F3 (minor) — habits not scheduled today write a phantom occurrence

A habit not scheduled for today is still listed; `expandOccurrences(...)` returns `[]`,
so the `?? todayKey()` fallback persists a status for a day the habit is not scheduled
(e.g. a Monday-only habit on Sunday stores `occurrences["2026-10-18"].status === "done"`
with no visible effect). The Today entry point makes this write reachable from a second
surface.

- **Location:** `src/domain/itemActions.ts` (`toggleHabitOccurrence`), shared by both views.
- **Impact:** stray occurrence state for unscheduled days.
- **Suggested fix:** gate the toggle on a today occurrence existing (disable/hide the ring)
  rather than falling back to `todayKey()`.
