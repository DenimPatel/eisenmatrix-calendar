# impl-IMP-135 — Fix flaky `noDataRows` habits partial-target test

Baseline SHA: `3427cb7` (HEAD at start). Item: `.improve/FEATURES.md` IMP-135.
Fix is test-only (`src/features/noDataRows.test.tsx`); no source changed.

## Root cause

The flaky test seeded **two habits that shared the same title** (`Raw habit`, from
`rawItem`) and then waited with `waitForText(host, 'Raw habit')`. `db.items.bulkPut`
emits one Dexie liveQuery change per row, so `HabitsView` can render after the first
`put` — with only the `null-target` habit — and `waitForText` returns as soon as the
first matching row appears. The following assertions for `2× per day` (the second,
`partial-target` row) then race the still-pending second render and fail ~1 in 5.

Two compounding faults: (1) same-titled rows make the wait ambiguous, and (2) waiting
on text that both rows satisfy lets the wait succeed on a partial render.

## Fix (test only)

- `rawWithData` gains an optional `title` override.
- The two seeded habits get **unique titles** (`Habit without target`,
  `Habit with partial target`).
- The wait targets the **second row's unique title** (`Habit with partial target`), so
  it only resolves once both rows — and therefore both target strings — are rendered.
  The `1× per day` / `2× per day` assertions are unchanged.

## Verification

| Gate | Result |
| --- | --- |
| 30× `vitest run src/features/noDataRows.test.tsx` | 30 pass / 0 fail |
| 5× full suite `vitest run` | 5 pass / 0 fail |
| Full suite `TZ=America/New_York vitest run` | pass |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run format:check` | pass (All matched files use Prettier code style) |

## Notes

- Not committed or pushed. No changes outside the repo.
- Acceptance criteria IMP-135 met: unique titles + row-specific wait; well beyond the
  required 20 consecutive runs (30 file runs, 5 full-suite runs, 1 TZ run).
