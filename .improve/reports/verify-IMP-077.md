# Verify IMP-077 — Seed the editor's schedule fields from the resolved occurrence

**Verdict: FAIL** — the recurrence fix itself is correct, but the seed also runs for
non-recurring items because every occurrence opener passes `occKey`, and it silently
truncates a stored multi-day all-day `end` on an untouched save. AC4 (“non-recurring
item's editor … unchanged”) is only met under its literal “no occurrenceKey” wording,
not for the app's actual non-recurring open paths.

Reviewed diff: `src/features/item/ItemEditorSheet.tsx`, `src/domain/itemActions.test.ts`,
`src/features/item/ItemEditorSheet.test.tsx`, plus the `.improve` status/log lines.
No source files were modified and nothing was committed.

## Acceptance criteria

| # | Result | Evidence |
| --- | --- | --- |
| 1. Seed from resolved occurrence (override merged) | **PASS** | `seedDraft` clones the row and replaces `start`/`end`/`allDay` from `expandOccurrences(item, day, day)`; browser shows occurrence `2026-10-16` seeded as `2026-10-16` / `10:00` on a 10-15 series. Test fails on HEAD (`2026-09-28`), passes now. |
| 2. Occurrence-scope save keeps the occurrence date | **PASS** | Editing occurrence `2026-10-16` to 14:45 stores `{ start: "2026-10-16T14:45" }`; series remains `2026-10-15T10:00`. The equivalent editor test fails on HEAD with `2026-09-28T14:45`. All dates are local (`parseLocalDate`/`formatISODate`); no `toISOString` keys. |
| 3. No seed leak into `all`-scope save | **PASS** | `changeScope` restores the series range and `handleSave` patches the series row. Browser: after opening a moved occurrence, “All occurrences” shows `2026-10-15` / `10:00`; a title-only all-save kept series start/end/allDay and the occurrence override. Removing the reset makes the new isolation test fail. |
| 4. Non-recurring unchanged | **FAIL (in practice)** | See issue below. |

Mutation safety: `seedDraft` uses `structuredClone`; the series item is never mutated.
An untouched occurrence save remains a true no-op (`updateRecurring` returns `false`):
no row write, no history entry, toast “Nothing to update for this occurrence” (verified
in browser and tests).

## Issue (blocking)

**Non-recurring items are seeded too, truncating multi-day all-day ends.** `CalendarView`,
`TodayView` and `BillsView` pass `occ.occKey` even when `item.recurrence` is null. For a
non-recurring all-day event `start 2026-10-20`, `end 2026-10-22T00:00` (a supported
multi-day shape — `src/lib/ics.ts:140-142` exports it), opening the chip gives
`Occurrence 2026-10-20`; `seedDraft` resolves the occurrence whose `end` is derived as
`formatISODate(start)` per `deriveOccurrenceEnd`. The Schedule End renders
`2026-10-20T00:00`, and Save (no user edit) persists `end: "2026-10-20"` with history
`End: 2026-10-22T00:00 -> 2026-10-20`. HEAD preserves the stored end; the probe test
passes on HEAD and fails on the working tree. Suggested fix: gate `seedDraft` on
`item.recurrence` (only recurring items have occurrence-owned overrides) or leave `end`
unchanged when there is no recurrence, plus a regression test for this path.

Secondary risk, same cause: a due-only item (`start` null, `dueAt` set) opened via an
occurrence key would gain a `start` field on save. Not observed in the seeded data, but
it follows from the same unconditional seed.

## Tests and gates

- `npm run typecheck` / `npm run lint`: clean.
- `npm run test`: 41 files, 440 passed (baseline 436, +4).
- `npm run build`: OK; `dist/sw.js` emitted, 18 precache entries.
- Prettier check on changed files: clean.
- Non-vacuity: against a `git archive HEAD` snapshot with the new tests, both new editor
  behavior tests fail (expected occurrence date/moved time); the domain test and the
  scope-all test pass on HEAD (the former pins an already-correct contract; the latter
  cannot fail before a seed exists). The scope-all test does fail when the new scope reset
  is removed, so it is a valid guard for the new implementation.
- Test coverage gap: no test opens a **non-recurring** item with an occurrence key, which
  is the regression above.

## Browser check

Preview on 4173, service-worker registrations and precache cleared per AGENTS.md, fresh
document load; 0 console errors/warnings. Drag-to-day was impractical in the UI (month
chips are not draggable; draggable agenda cards share no view with a day drop target), so
the moved-occurrence override was produced through the occurrence editor's Schedule tab,
which writes the same `recurrence.overrides[key].start`. Full before/after IndexedDB
values and the cross-version probe are in `.improve/artifacts/IMP-077/evidence.md`;
screenshots `01`–`05` are in the same directory.

## Scope and style

The diff is limited to the editor, its tests, one domain test, and `.improve` status/log
lines for prior items; no unrelated source changes. Code follows local conventions
(`structuredClone`, local date helpers, semantic terms), no new deps, no comments beyond
the existing style. `FEATURES.md` is left `IN-PROGRESS`, consistent with a pre-verdict
state.

**Suggested Bugs/Correctness health delta: -1 as-is** (fixes the recurring seed bug but
adds a silent non-recurring data-loss path); **+1 once the seed is gated to recurring
items and the non-recurring regression test is added.**

## Second attempt (independent review, 2026-10-17)

**Verdict: PASS.** Reviewed the working tree on `improve/auto-20261017` (`d18883e` plus
uncommitted IMP-077 changes). No source files were modified and nothing was committed.

| # | Result | Evidence |
| --- | --- | --- |
| 1. Seed from resolved occurrence (override merged) | **PASS** | `seedDraft` gates on `item.recurrence`, resolves `expandOccurrences(item, day, day)` and replaces `start`/`end`/`allDay`. Browser: occurrence `2026-10-16` of a `2026-10-15T10:00` series seeded date `2026-10-16`, time `10:00`; override `2026-10-04 → 2026-10-05T14:45` seeds `2026-10-05` / `14:45` in the test. |
| 2. Occurrence-scope save keeps the occurrence date | **PASS** | Browser changed the seeded occurrence time to `14:45`; IndexedDB override is `{"2026-10-16": {"start": "2026-10-16T14:45"}}`, series start remains `2026-10-15T10:00`. Domain test asserts the persistence contract. |
| 3. No seed leak into an `all`-scope save | **PASS** | Browser: after opening the moved occurrence, “All occurrences” reset Schedule to `2026-10-15` / `10:00`; saving all kept series `start`/`end`/`allDay` and preserved the override. Removing the reset makes the isolation test fail (`expected 2026-09-28`, received `2026-10-05`). |
| 4. Non-recurring unchanged, including a passed `occKey` | **PASS** | Browser: non-recurring all-day event `2026-10-20` → `2026-10-22T00:00` opened from Calendar with `Occurrence 2026-10-20`; Schedule End showed `2026-10-22T00:00`; untouched Save persisted `start 2026-10-20`, `end 2026-10-22T00:00`, `allDay true`, `history []`. The new regression test fails without the recurrence gate (`end` becomes `2026-10-20T00:00`) and passes on the HEAD snapshot. A recurring occurrence untouched save is a true no-op: toast “Nothing to update for this occurrence”, history length stayed 1, override unchanged. |

### Gates

`npm run typecheck`, `npm run lint`, `npm run test` (41 files, **441 tests**), and
`npm run build` (dist/sw.js, 18 precache entries) all pass.

### Non-vacuity

- Removing `!item.recurrence` from `seedDraft` fails
  `keeps a non-recurring multi-day range when opened with an occurrence key` with
  `expected '2026-10-20T00:00' to be '2026-10-22T00:00'`.
- On a `git archive HEAD` snapshot with the current test file, the non-recurring
  regression test passes (prior behavior preserved) and the two new recurring seed
  tests fail (`2026-09-28` / `2026-09-28T14:45` instead of the occurrence values).
- Removing the scope reset fails the `does not leak` test, so that guard is live.
- The domain test is a persistence-contract guard (it passes on HEAD); the editor tests
  are the fail-before guards for the actual bug.

### Browser evidence (preview 4173, SW/caches cleared)

Files `06`–`10` in this directory: `06-retry-nonrecurring-end-preserved.png`,
`07-retry-occurrence-seeded-schedule.png`,
`08-retry-reopened-occurrence-kept.png`,
`09-retry-all-scope-series-schedule.png`,
`10-retry-untouched-noop-toast.png`. Console: 0 errors / 0 warnings. Reviewer-seeded
items were removed from IndexedDB afterwards. Drag-to-day remains impractical for the
same reason as the first attempt; the occurrence edit was produced through the editor's
Schedule tab, which writes the same `recurrence.overrides[key].start`.

### Scope and style

Diff is limited to `ItemEditorSheet.tsx`, its tests, one domain test, and `.improve`
status/log lines. No new dependencies, no `toISOString()` date keys, and
`structuredClone` keeps the series row and seed isolated. Non-blocking observation:
`changeScope` also restores the series range for `future`, not just `all`, so a schedule
edit made before switching to “This and future” is discarded; this is a defensible
scope-baseline rule and does not affect the acceptance criteria.

**Suggested Bugs/Correctness health delta: +1** (silent non-recurring data-loss path
removed; AC1–AC3 retained with a non-vacuous regression test).
