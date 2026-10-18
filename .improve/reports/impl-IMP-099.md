# impl-IMP-099 — Make empty habit-heatmap cells visible in light mode

- **Item:** IMP-099 (visual / contrast, bug-fix, S / low risk)
- **Status:** DONE
- **Date:** 2026-10-18

## Change

`src/features/habits/HabitsView.tsx:166` — empty heatmap cells used `bg-elevated`,
which in light mode is `255 255 255`, identical to the card's `bg-surface`, so the
12×7 grid was invisible on a habit with no completions.

Changed the empty-cell class to the semantic token `bg-border`:

```diff
- intensity === 0 && 'bg-elevated',
+ intensity === 0 && 'bg-border',
```

Token values (`src/styles/index.css`, `tailwind.config.ts`):

| Token       | Light `rgb()`   | Dark `rgb()`  |
| ----------- | --------------- | ------------- |
| `--surface` | 255 255 255     | 15 23 42      |
| `--elevated`| 255 255 255     | 30 41 59      |
| `--border`  | 226 232 240     | 30 41 59      |

Because `--border` and `--elevated` are byte-identical in dark mode (`30 41 59`),
the dark appearance is unchanged; only light mode gains contrast. No hardcoded
colors were introduced.

## Test

Added `HabitsView empty heatmap cells` in `src/features/habits/HabitsView.test.tsx`,
asserting all 84 empty cells carry `bg-border` and not `bg-surface` / `bg-elevated`.

## Verification (Playwright, `npm run preview`, 1280×800 and 390×844)

Service workers unregistered and caches cleared before the run. Seeded a habit
(`Stretch`) via the editor; a second persisted habit (`Walk 20 min`) also rendered.

Computed `backgroundColor` (measured in the browser):

| Theme | Cell                | Card                | Distinct |
| ----- | ------------------- | ------------------- | -------- |
| Light | rgb(226, 232, 240)  | rgb(255, 255, 255)  | yes      |
| Dark  | rgb(30, 41, 59)     | rgb(15, 23, 42)     | yes (unchanged) |

Screenshots (all four inspected, grid visible in every one):

- `.improve/artifacts/IMP-099/light-1280-habits.png`
- `.improve/artifacts/IMP-099/light-390-habits.png`
- `.improve/artifacts/IMP-099/dark-1280-habits.png`
- `.improve/artifacts/IMP-099/dark-390-habits.png`

## Gates

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` ✓ (47 files, 532 tests) ·
`npm run format:check` ✓ · `npm run build` ✓

No commit, push, or out-of-scope changes.
