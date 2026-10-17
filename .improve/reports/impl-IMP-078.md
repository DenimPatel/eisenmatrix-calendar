# IMP-078 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File | Change |
| --- | --- |
| `src/features/today/TodayView.tsx` | Derives `agenda = todays.filter((occ) => occ.item.kind !== 'habit')` and uses it for "What's next", the agenda section's badge, the `x/y done` label, the progress ring, the rendered `ItemCard` list and the empty state. Habits stay in `todays`, so the Habits panel's `doneToday` ring and `habitStreak` text still read the same occurrence set. Overdue, bills, goals and all non-habit agenda items are untouched. |
| `src/features/today/TodayView.test.tsx` | New jsdom mount tests: (1) a daily habit plus a task renders "Journal" exactly once, the agenda badge is 1 and the label is `0/1 done`; (2) a done task, a todo task and a done habit render `1/2 done`, badge 2, with the habit's ✓ still shown in the Habits panel. |

## Acceptance criteria

1. **Habit appears at most once** — the agenda, empty state and "What's next" all use `agenda`,
   so a habit is rendered only by the Habits panel. Verified in jsdom (one "Journal" text node)
   and in the browser (`body.innerText` contains one "Journal").
2. **Counts match the rendered set** — `completedToday`, `todayProgress`, the section badge and
   the `x/y done` label all use `agenda.length`. The second test fails without the filter
   (it would show `2/3 done`).
3. **Habits panel unchanged** — no edits there; `doneToday` still checks `todays`, and the
   browser check showed the ✓ ring and `1 day streak · best 1` after completing the habit in
   the Habits view.
4. **Non-habit items unchanged** — non-habit occurrences are not filtered; Overdue already
   filtered habits and was left alone.

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 42 files, 443 tests passed (baseline 441; +2)
- `npm run build` — OK, `dist/sw.js` emitted, 18 precache entries
- Preview + Playwright: quick-added `habit: journal`; Today showed exactly one "Journal",
  agenda badge 0, label `0/0 done`; completing it in the Habits view and returning to Today
  showed the ✓ ring and updated streak; no console errors/warnings.

No new deps, no schema/store changes, no comments added.

## Follow-up (not in scope)

Today's Habits panel shows the ring and an Edit button but no inline completion toggle, so
after this fix a habit cannot be completed directly from the Today route without opening the
editor (the full Habits view has the toggle). AC3 required the panel to stay unchanged, so
this was left as-is.
