# impl-IMP-102.md — "What's next" actionability + Today "+N more"

Scope: `.improve/FEATURES.md` IMP-102 and IMP-103 (sources U2/U3 in
`.improve/reports/discover3-visual.md`). No commit/push performed.

> Note: both backlog entries already carried `Status: DONE`, but the code did **not**
> implement either behaviour at HEAD (`TodayView.tsx:79-85` still used the raw
> `(a.start ?? a.occKey).localeCompare` sort, and `overdue/bills/goals` were sliced with
> no more-control). The status markers were stale; this change implements both.

## IMP-102 — "What's next" prefers timed, actionable occurrences

**Change.** New pure domain module `src/domain/nextUp.ts`:

- `isActionableOccurrence(occ)` — rejects `done`/`cancelled` and the non-actionable
  `note` kind (acceptance 2).
- `selectNextUp(occurrences, now = new Date())` — filters to actionable, then:
  1. if any timed occurrence is pending, pick the earliest still-upcoming one, falling
     back to the most recently due when all are in the past (acceptance 1: a timed item
     always beats an all-day one);
  2. otherwise pick the earliest all-day occurrence, returning its date-only `start` so
     the caller cannot imply a time (acceptance 3).

`src/features/today/TodayView.tsx` now computes `nextUp = selectNextUp(agenda)`; the
existing banner render already only prints a clock when `start` contains `T`.

**Tests.** `src/domain/nextUp.test.ts` (9 cases): all-day note + 09:00 task, all-day vs
timed, note-only excluded, done/cancelled ignored, earliest upcoming, past-only fallback,
all-day without time, input non-mutation, and `isActionableOccurrence`. Plus a jsdom
wiring test in `TodayView.test.tsx` asserting the banner shows `Timed task` and not the
all-day note.

## IMP-103 — "+N more" affordance on truncated Today sidebar sections

**Change.** `src/features/today/TodayView.tsx`:

- Constants `OVERDUE_LIMIT = 6`, `BILLS_LIMIT = 6`, `GOALS_LIMIT = 4`; per-section
  `expanded` state and a shared `MoreControl` that renders `+N more` / `Show less`
  (mirrors the calendar's IMP-053 pattern).
- Badges now use the **full** list length (`unpaidBills.length`, `goals.length`), so the
  count always equals the reachable items (acceptance 2). Overdue already used the full
  count.
- Overdue, Bills due soon and Goal progress render the capped slice, expand in place on
  click, and collapse again (acceptance 1, 3).

**Tests.** `TodayView.test.tsx` — Overdue 7→6 rows with `+1 more` and badge `7`, expands
to 7 with `Show less`; Bills 7→6 rows; Goals 5→4 rows; and a no-control case under the
cap.

## Verification

- `npm run typecheck` — PASS
- `npm run lint` — PASS (0 warnings)
- `npm run test` — PASS, 594 tests / 58 files (ran full suite 3×, stable)
- `npm run format:check` — PASS
- `npm run build` — PASS

### Visual verification (IMP-103), `npm run preview` @ 4173

Fresh Playwright contexts (the MCP default context has IndexedDB disabled), SW + caches
reset, seeded 7 overdue tasks / 7 bills / 5 goals / 1 all-day note / 1 timed task, then a
real document load. Measured at 1280×800 and 390×844, light and dark:

| viewport | Overdue | Bills due soon | Goal progress | banner | console errors |
| --- | --- | --- | --- | --- | --- |
| 1280 light | badge 7, 6 rows, `+1 more` → 7 + Show less | badge 7, 6 rows, `+1 more` | badge 5, 4 rows, `+1 more` → 5 + Show less | `What's next Timed task 09:00` | 0 |
| 390 light | same | same | same | same | 0 |
| 1280 dark | same | same | same | same | 0 |
| 390 dark | same | same | same | same | 0 |

Screenshots: `.improve/artifacts/IMP-103/today-{1280,390}-{light,dark}.png` and the
`…-overdue-expanded.png` variants. Preview server stopped after verification.

## Files

- `src/domain/nextUp.ts` (new), `src/domain/nextUp.test.ts` (new)
- `src/features/today/TodayView.tsx`, `src/features/today/TodayView.test.tsx`
