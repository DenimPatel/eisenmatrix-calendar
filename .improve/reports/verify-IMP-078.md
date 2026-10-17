# IMP-078 — Verification report

**Verdict: PASS**

Reviewed the working tree on `improve/auto-20261017` (HEAD `e9807ef` plus the uncommitted
IMP-078 change). No source files were modified and nothing was committed.

## Criteria

| # | Result | Evidence |
| --- | --- | --- |
| 1. Habit appears at most once on Today | **PASS** | `agenda = todays.filter((occ) => occ.item.kind !== 'habit')` is used for "What's next", the agenda badge, the `x/y done` label, the ring, the card list and the empty state. The Habits panel still renders the habit. Browser: `habit: journal` produced exactly one `Journal` leaf in `main`; the Habits panel was its only entry. Overdue already filtered habits (`TodayView.tsx:57-59`, unchanged) and still does. Completed habit and mixed task+habit days also rendered `Journal` once. |
| 2. Label/ring count exactly the rendered agenda | **PASS** | Habit-only day: badge `0`, `0/0 done`, ring `0%` (all-habit/empty case consistent). Task+done-habit: badge `1`, `0/1 done`, `0%`. Mixed 1 done + 1 todo task + done habit: badge `2`, `1/2 done`, ring `50%` (SVG dash offset is half). Two done tasks + done habit: `2/2 done`, `100%`. No habit is counted. |
| 3. Habits panel unchanged | **PASS** | No edits to the panel; it still reads `todays` for `doneToday` and `habitStreak(habit)` for the text. Browser: the Today ring went `0` → `✓` and `0 day streak · best 0` → `1 day streak · best 1` after completing today in the Habits view (the Habits view itself showed `✓`, `1 day streak`, `Best 1`, and today's heatmap cell updated). |
| 4. Non-habit agenda unchanged | **PASS** | Only `kind === 'habit'` is filtered; key, start, status and order for other kinds are untouched. Browser: `Write report` and `Review draft` each rendered once in the agenda; agenda counts tracked task state (`0/1` → `1/1` → `1/2` → `2/2`). `nextUp` now draws from the same agenda, so a habit can no longer occupy "What's next"; non-habit "What's next" behavior is unchanged. |

## Gates

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test` — 42 files, **443 tests passed** (HEAD baseline 441; +2 expected).
- `npm run build` — OK; `dist/sw.js` emitted, 18 precache entries (621.54 KiB).

## Non-vacuity

A `git archive HEAD` snapshot with the new test file fails both tests:
`view never rendered "0/1 done"` and `view never rendered "1/2 done"` (HEAD renders the
habit in the agenda, so the counts are `0/2` and `2/3`). The duplicate assertion is therefore
covered by a fail-before test; test 1 also asserts the agenda badge and one `Journal`, and
test 2 asserts the agenda badge and the habit's `✓`. The tests would regress if the filter
were removed.

## Browser evidence (preview 4173, SW/caches/IndexedDB cleared first)

Screenshots in `.improve/artifacts/IMP-078/`:

- `01-today-habit-only-one-entry.png`
- `02-today-habit-done-panel-updated.png`
- `03-today-task-plus-habit.png`
- `04-today-task-done-habit-done.png`
- `05-today-agenda-1of2-ring-50.png`
- `06-today-task-plus-habit-each-once.png`

Fresh load and the whole interaction sequence reported **0 console errors and 0 warnings**
(the only warnings seen were from the reviewer's own `indexedDB.deleteDatabase` cleanup, one
expected Dexie close warning, and the existing `act(...)` stderr noise shared with
`app.smoke.test.tsx`). Reviewer-created IndexedDB rows were deleted afterwards.

## Scope and style

- Source diff is limited to `src/features/today/TodayView.tsx`; the new test is co-located
  and follows the existing jsdom/`createRoot` pattern. No deps, schema, store or comments added.
- The working tree also contains uncommitted IMP-077 bookkeeping (`CHANGELOG`, `PROGRESS.log`,
  `IMP-093` promotion in `FEATURES.md`) and `discovered-IMP-039.md`; these pre-date IMP-078
  and are not source creep. `FEATURES.md` correctly shows IMP-078 `IN-PROGRESS` for a
  pre-verdict state.
- Minor report inaccuracy, non-blocking: immediately after quick-add, `body.innerText`
  contains `Journal` twice because the transient "Added “Journal”" toast includes the title;
  the main content has exactly one entry, and the count is one after the toast clears.
- Minor UX polish, non-blocking: an all-habit (or truly empty) day shows
  `Today's agenda 0`, `0/0 done`, and "Nothing scheduled today" while the Habits panel lists
  the habit. This is consistent with AC2 but reads slightly oddly.

**Suggested UX/Interaction health delta: +1** — the duplicate habit card is gone on every
checked day, and the agenda badge/label/ring now agree with what is rendered.
