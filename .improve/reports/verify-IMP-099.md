# verify-IMP-099 — Make empty habit-heatmap cells visible in light mode

- **Item:** IMP-099 (visual / contrast, bug-fix, S / low risk)
- **Reviewer:** independent skeptical review
- **Date:** 2026-10-18
- **Verdict:** PASS

## Diff under review

```
src/features/habits/HabitsView.tsx:166   intensity === 0 && 'bg-elevated'  ->  'bg-border'
src/features/habits/HabitsView.test.tsx  +18 (new describe 'HabitsView empty heatmap cells')
```

Only these two files changed; `git status` shows no other staged/untracked source changes
besides the impl report. No commit/push. No source modified during this review.

## Acceptance criteria

1. **Light-mode empty cell distinguishable from the card.** PASS. Independently measured
   in a browser against the freshly built `dist` (`npm run preview`, SW unregistered and
   caches cleared):
   - Light: cell `rgb(226, 232, 240)` (`--border`) vs card `rgb(255, 255, 255)`
     (`--surface`) — distinct.
   - Filled (intensity 1) cell `rgb(167, 243, 208)` (`bg-emerald-200`) vs empty — distinct.
   - Screenshot `.playwright-mcp/verify-light-habits.png` shows the full grid clearly.
2. **Full 12×7 grid visible in both themes for a zero-completion habit.** PASS. Both
   rendered grids report `total: 84`; the zero-completion habit ("Stretch") has 84 empty
   cells, all `bg-border`, visible in light and dark.
3. **Dark-mode appearance unchanged.** PASS. `--border` and `--elevated` are byte-identical
   in dark (`30 41 59`), so the class swap is a no-op in dark. Measured dark cell
   `rgb(30, 41, 59)` vs card `rgb(15, 23, 42)` — distinct, unchanged from before.

## Skeptical checks

- **No hardcoded colors introduced.** The change uses the semantic `bg-border` token; the
  only literal colors in the block (`bg-emerald-*`) are pre-existing and untouched.
- **Test is meaningful.** It asserts `bg-border` present and `bg-surface`/`bg-elevated`
  absent on all 84 empty cells; it would fail on the pre-change `bg-elevated`, so it
  guards the regression. It is class-based rather than computed-contrast based, which is
  acceptable given the token mapping.
- **Other heatmap-like grids.** Exhaustive grep (`bg-elevated`, `grid-rows-7`,
  `grid-cols-7`, `rounded-sm`, `heatmap`) found no other cell-grid that renders empty cells
  with `bg-elevated`. Calendar `YearView` is a list, not a cell grid.
- **Related same-class bug (out of scope).** `src/features/goals/GoalsView.tsx:150` renders
  the numeric-goal progress **track** as `bg-elevated` inside a `bg-surface` `.card`, so in
  light mode the unfilled track is white-on-white (invisible until the accent fill covers
  it). Same root cause as IMP-099 but a different component; not covered by this item.
- **Calendar out-of-month cells (out of scope, low impact).** `CalendarView.tsx:192`
  `!inMonth && 'bg-elevated/50'` produces no light-mode tint (white/50 over white), but the
  cells keep `border-border`, so the grid stays visible. Cosmetic only.
- **Contrast magnitude.** Empty-vs-card light contrast is subtle (~1.2:1), but IMP-099
  accepts "measurably different computed background, or a border", which is satisfied.

## Gates (all run on the reviewed tree)

| Gate                 | Result |
| -------------------- | ------ |
| `npm run typecheck`  | PASS   |
| `npm run lint`       | PASS   |
| `npm run test`       | PASS (47 files, 532 tests) |
| `npm run format:check` | PASS |
| `npm run build`      | PASS (tsc + vite build + PWA `sw.js`) |

## Issues

- None blocking. Non-blocking observations only: the GoalsView numeric progress track
  (`:150`) has the same light-mode `bg-elevated`-on-`bg-surface` invisibility; the Calendar
  out-of-month `bg-elevated/50` tint is a no-op in light mode (borders still delineate).
