# IMP-085 — Independent verification

**Reviewer:** independent (did not author the change)
**Commit under review:** working tree on `improve/auto-20261017` (uncommitted diff; no commit)
**Item:** `.improve/FEATURES.md:1277` (IMP-085 — Render the occurrence-level `title` override)
**Impl report:** `.improve/reports/impl-IMP-085.md`

## Verdict

**PASS** — all four acceptance criteria are met and all five gates pass. The review
surfaces below are real, user-visible gaps in *other* occurrence-title surfaces, but none
of them is required by AC1–AC4 (AC2 names Today / Matrix / Calendar only, and the item's
own discovered report scopes reminders out). They are recorded as follow-ups, not
failures of this item.

## Scope reviewed

`git diff` over: `src/types/item.ts`, `src/domain/recurrence.ts`, `src/domain/recurrence.test.ts`,
`src/domain/stats.test.ts`, `src/features/item/ItemCard.tsx`, `src/features/item/ItemCard.test.tsx`,
`src/features/calendar/CalendarView.tsx`, `src/features/today/TodayView.tsx`.

## Acceptance criteria

### AC1 — effective title resolved as `override?.title ?? item.title` — PASS
`src/domain/recurrence.ts:206-208` adds `resolveOccurrenceTitle(item, occKey)` returning
`item.recurrence?.overrides[occKey]?.title ?? item.title`, and `buildOccurrence`
(`:222`) bakes it onto `Occurrence.title` (new field, `src/types/item.ts:142`). Both forms
the spec offered are present (shared resolver + engine-baked value), which is what lets the
calendar/today render paths consume `occ.title` without importing recurrence.

### AC2 — `ItemCard` renders the resolved title (Today / Matrix / Calendar) — PASS
`ItemCard.tsx:53` resolves `occurrenceKey ? resolveOccurrenceTitle(...) : item.title` and
renders `{title || 'Untitled'}` (`:112`). Call sites verified:
- Today agenda card — `TodayView.tsx:165` passes `occurrenceKey`.
- Calendar agenda card — `CalendarView.tsx:282` passes `occurrenceKey`.
- Matrix — `MatrixView.tsx:82-88` renders whole `ItemCard`s with **no** `occurrenceKey`;
  the matrix shows series items, so `item.title` is correct there. The spec's "three call
  sites that already pass `occurrenceKey`" is inaccurate (only two do); the impl report
  documents this correctly.

Beyond the three named surfaces, the change also fixes other occurrence-level render paths
that printed `occ.item.title` directly, all now `occ.title`:
`CalendarView.tsx:220` (cell `title` attr), `:231` (month/week label), `:357` (year view);
`TodayView.tsx:112` ("What's next"), `:136` (Overdue), `:234` (Bills due). These are
behaviour-preserving when no override exists (`occ.title === item.title`).

### AC3 — retitle one occurrence, siblings unchanged — PASS
`resolveOccurrenceTitle` reads only `overrides[occKey]`, so siblings fall back to
`item.title`; `updateRecurring` (`itemActions.ts:326-341`) still writes only
`overrides[occKey].title` and leaves the series row alone. Unit tests cover both halves
(`recurrence.test.ts:208-233`, `ItemCard.test.tsx:114-142`).

### AC4 — non-recurring / no-override render exactly as before — PASS
No recurrence → `?? item.title`; override absent → `item.title`. `ItemCard.tsx:53` keeps
`item.title` when no `occurrenceKey` is supplied (matrix/list/notes/goals/habits/shopping
are series-level and were correctly left untouched). Tests cover both fallbacks.

## Surfaces checked for stale occurrence titles

| Surface | Occurrence-level? | Resolves override? | Notes |
| --- | --- | --- | --- |
| Matrix (`MatrixView.tsx:82`) | no (series items) | n/a — correct | — |
| List (`ListView.tsx:358`) | no (series items) | n/a — correct | — |
| Habits (`HabitsView.tsx:124,154`) | no (series habits) | n/a — correct | — |
| Notes / Goals / Shopping | no (series items) | n/a — correct | — |
| Command palette (`CommandPalette.tsx:59`) | no (items) | n/a — correct | navigates to the series item |
| ItemCard aria-labels (`ItemCard.tsx:76`) | generic text only | n/a — correct | not title-derived |
| ICS export (`src/lib/ics.ts:128,147`) | series `VEVENT` + RRULE | n/a — cannot express per-occurrence SUMMARY without EXDATE/RDATE split; out of scope | — |
| `src/domain/reminders.ts` | no title rendered | n/a — correct | only computes fire times |
| **Notifications** (`ReminderRuntime.tsx:69`) | **yes** | **NO** | see Issue 1 |
| **Bills "Upcoming"** (`BillsView.tsx:145`) | **yes** | **NO** | see Issue 2 |
| **Drag overlay** (`AppShell.tsx:227`) | yes (drag carries `occurrenceKey`) | **NO** | see Issue 3 (cosmetic) |

## Issues (flagged, not blocking AC)

1. **Reminder notification uses the series title.** `ReminderRuntime.tsx:69`
   (`const title = scheduled.item.title || 'Reminder'`) — the reminder window
   (`upcomingReminders`, `reminders.ts:56-62`) already produces an `Occurrence` that now
   carries `title`, so `scheduled.occurrence.title` is available and unused. A retitled
   occurrence therefore notifies as "Standup" while its card reads "Renamed standup". The
   impl's own `discovered-IMP-085.md` §1 records this as out of scope; it is a genuine
   user-visible inconsistency and the cheapest follow-up.
2. **Bills view "Upcoming (60 days)" uses the series title.** `BillsView.tsx:145` renders
   `bill.title || bill.data.payee || 'Bill'` while iterating occurrences (`occ` at
   `:112-114`). `TodayView.tsx:234` was updated to `occ.title` for the same kind of row, so
   the two bills surfaces now disagree. Should be `occ.title || bill.data.payee || 'Bill'`.
   (The "All bills" grid at `:177` is series-level and correct as-is.)
3. **Drag overlay** (`AppShell.tsx:227`) shows `activeDrag.item.title`; the drag payload
   carries `occurrenceKey` (`dnd.ts:7`), so dragging a retitled occurrence shows the series
   title in the overlay. Cosmetic; a resolver call would fix it.

## Empty / whitespace title override handling

`resolveOccurrenceTitle` uses `??`, so an override stored as `''` is returned verbatim and
**does not** fall back to the series title. This matches AC1's literal formula
(`override?.title ?? item.title`), but the surfaces diverge on what they render for it:
- `ItemCard.tsx:112` renders `title || 'Untitled'` → "Untitled".
- `CalendarView.tsx:231,357` and `TodayView.tsx:136,234` render `{occ.title}` raw → a
  **blank** cell/row.

An empty occurrence title is reachable: `occurrencePatch` (`ItemEditorSheet.tsx:88`)
emits `patch.title = ''` when the user clears the title, and `updateRecurring`
(`itemActions.ts:331`) stores it. Before this change those surfaces fell back to the series
title, so clearing one occurrence now yields a blank calendar cell instead of the series
title. Whitespace-only (`'   '`) is likewise stored and rendered as whitespace. Low
severity and consistent with AC1 as written, but the raw `occ.title` surfaces should use
`occ.title || 'Untitled'` (or the resolver should treat blank as absent) for parity with
`ItemCard`. Not covered by any test.

## Gates

All five run on the working tree:

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test` — 43 files / **491 passed**.
- `npm run format:check` — "All matched files use Prettier code style".
- `npm run build` — OK (`dist/sw.js`, 18 precache entries).

## Conclusion

The four acceptance criteria are satisfied, the sibling-isolation and no-override cases are
unit-tested, and the four named gates plus `format:check` pass. The stale-title surfaces in
Issues 1–3 and the blank-override edge case are real but outside AC1–AC4; they should be
tracked as follow-ups (Issue 1 is already recorded in `discovered-IMP-085.md`).
