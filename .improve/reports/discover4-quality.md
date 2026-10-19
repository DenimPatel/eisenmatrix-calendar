# discover4-quality — Correctness / Data-integrity audit

**Auditor role:** Correctness/Quality Auditor (discovery round)
**Repo:** `/Users/pvrun/Desktop/Denim/git/eisenmatrix-calendar` @ working tree (no source/state edits)
**Baseline:** `npm run test` → **72 files / 707 tests pass** before probing.
**Method:** every candidate below was reproduced with throwaway Vitest files run through a
temporary config (`/tmp/kilo/repro.config.ts`, `root` = repo, `@` → `src`, repo setup file) so no
repo file was created or modified (`git status` stayed clean apart from sibling report files).
Probe files live at `/tmp/kilo/repro/probe{1..7}.test.ts`; they are intentionally not committed.
Candidates already listed in `.improve/reports/discover4-followups.md` (F1–F15, e.g. archived
restore path, multi-count habits, quick-add kind-change recurrence, `lists` validation,
count-limited split RRULE) were **excluded** to avoid duplicating the follow-up harvest.

---

## C1 — Preserve per-occurrence state when splitting a series ("this and future")

- **Area / files:** `src/domain/recurrence.ts:452-468` (tail built with `occurrences: {}` at
  `:464`; head at `:447-451` spreads the *whole* `occurrences` map), consumed by
  `src/domain/itemActions.ts:429` (`splitSeries`), `:433-451` (`tailPatch` never carries
  `occurrences`), reachable from the editor's future scope
  (`src/features/item/ItemEditorSheet.tsx` `handleSave` → `updateRecurring(…, 'future', …)`).
- **Evidence (repro):** `probe1.test.ts` A/B and `probe3.test.ts` Q6.
  - Direct: weekly series starting 2026-01-05, `occurrences['2026-01-19'] = {status:'done'}`,
    `occurrences['2026-01-26'] = {status:'done'}`; `splitSeries(item, '2026-01-12', newId())` →
    `head.occurrences` keeps **both** entries, `tail.occurrences` is `{}`.
  - Through the real action: `updateRecurring(item, 'future', '2026-01-12', {title:'standup v2'})`
    persists two rows — head `2026-01-05` with `{"2026-01-19":{status:"done"}}` (dead: head's
    `until` is 2026-01-11, so it never expands 01-19) and tail `2026-01-12` with `{}`.
  - **Observed:** the completion/notes state for every occurrence at or after the split is
    dropped; **Expected:** the tail carries the states for its own occurrences (head keeps only
    those strictly before the split).
  - Note the existing test `src/domain/recurrence.test.ts:534` asserts `tail.occurrences === {}`,
    but its fixture only marks an occurrence *before* the split, so the assertion is vacuous and
    does not cover this case.
- **Intent:** a split must partition one series into two rows without losing any per-occurrence
  user data (completion, `completedAt`), the same invariant `occurrencesBeforeKey`/`tailCount`
  already enforce for `count`.
- **Acceptance criteria:**
  1. After `splitSeries(item, K)`, for every key `k >= K` present in the source
     `occurrences`, `tail.occurrences[k]` equals the source value; keys `< K` are absent from the tail.
  2. The head's `occurrences` contains no key `>= K` (no dead duplicates).
  3. `updateRecurring(…, 'future', …)` persists both rules so `expandOccurrences` over the two rows
     reproduces the original statuses for every occurrence key.
  4. Existing recurrence/split tests still pass, with the vacuous `tail.occurrences === {}`
     assertion replaced by the partition assertion.
- **Verification method:** extend `src/domain/recurrence.test.ts` and `itemActions` tests with a
  series whose post-split occurrences carry `done` state; assert the partition, then re-expand
  both rows across the full range and compare to the unsplit series. Run typecheck/lint/test.
- **Severity:** S2 **Impact/Reach/Confidence:** 4/3/5 **Score (impact×reach):** 12
- **Effort:** S **Risk:** low **Depends on:** none
- **Not in FEATURES.md:** IMP-037/IMP-113 fixed the *head* receiving the patch and the tail's RRULE
  fields, and IMP-023 tracks exception copying, but no item covers occurrence-state partitioning.

---

## C2 — Stop reminders from firing for done or cancelled occurrences

- **Area / files:** `src/domain/reminders.ts:66-87` (`upcomingReminders` iterates every expanded
  occurrence and never inspects `occurrence.status`), consumed by
  `src/pwa/ReminderRuntime.tsx:111-133` (`deliver` also ignores status). Occurrence status is
  produced by `src/domain/recurrence.ts:217-226` / `:240`.
- **Evidence (repro):** `probe7.test.ts` W1. Daily task "Take medicine" at 09:00 with
  `reminders:[{id:'r1',offsetMinutes:0}]`:
  - before: `upcomingReminders(today)` → `2026-10-18@09:00`.
  - after `setStatus(item,'done','2026-10-18')` → still scheduled (`…:done`).
  - after `setStatus(item,'cancelled','2026-10-18')` → still scheduled (`…:cancelled`).
  - a **skipped** occurrence (`skipOccurrence` → `exceptions`) *is* correctly suppressed, because
    `expandOccurrences` drops exceptions.
  - **Observed:** a cancelled (or already-completed) occurrence still notifies; **Expected:** no
    reminder for an occurrence the user marked cancelled/skipped, and none for a completed one.
- **Intent:** `skipOccurrence` (IMP-055) removes an occurrence from the calendar; notification
  delivery must honour the same resolved status, otherwise "skip this occurrence" is half-applied.
- **Acceptance criteria:**
  1. `upcomingReminders` returns no entry whose `occurrence.status === 'cancelled'`.
  2. `upcomingReminders` returns no entry whose `occurrence.status === 'done'`.
  3. Skipped (exception) occurrences remain suppressed and non-cancelled/non-done occurrences are
     unchanged (existing reminders tests still pass).
- **Verification method:** add cases to `src/domain/reminders.test.ts` toggling
  `occurrences[key].status` between `todo`/`done`/`cancelled` and asserting the scheduled set.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/4/5 **Score (impact×reach):** 12
- **Effort:** S **Risk:** low **Depends on:** none
- **Not in FEATURES.md:** IMP-036/IMP-121 cover dedupe and prune reachability, not the resolved
  occurrence status; no item mentions status-aware delivery.

---

## C3 — Make a recurring series' status consistent with its occurrences

- **Area / files:** `src/domain/recurrence.ts:217-226` (`resolveOccurrenceStatus` special-cases
  `item.status === 'cancelled'` at `:224` but falls through `'done'` to `{status:'todo'}` at `:225`),
  written by `src/domain/itemActions.ts:268-279` (`setStatus` with no `occKey` sets the series
  `status`/`completedAt`), invoked from `src/features/list/ListView.tsx` bulk-complete and
  `src/features/matrix/MatrixView.tsx` `ItemCard` (no `occurrenceKey`), while Today/Calendar render
  the resolved occurrence status (`src/features/today/TodayView.tsx`, `useOccurrences`).
- **Evidence (repro):** `probe3.test.ts` Q2. Daily task series, `setStatus(item,'done')` →
  stored `status === 'done'` but `resolveOccurrenceStatus(stored,'2026-01-05')` returns
  `{status:'todo',completedAt:null}`. Consequently the row shows as done (strikethrough) in
  Lists/Matrix while every occurrence stays open on Today/Calendar, and
  `itemCompletionStats`/`overallCompletion` count 0 done.
  **Observed:** one visual control writes two disjoint stores; **Expected:** a series marked done
  resolves its occurrences as done (or the series status is not offered as "done" for recurring items).
- **Intent:** `item.occurrences` is documented as *the* single status store; a series-level `done`
  that the occurrence resolver ignores is a second, silently inconsistent store.
- **Acceptance criteria:**
  1. `setStatus(recurringItem, 'done')` (no `occKey`) makes `resolveOccurrenceStatus` return
     `done` for the series' occurrences, or the action refuses/redirects the write.
  2. `resolveOccurrenceStatus` never returns `todo` for an item whose effective series status is
     `done` unless an occurrence state/override explicitly says otherwise.
  3. Completing the same series from Lists and from Today yields the same rendered status.
  4. Non-recurring items and existing `setStatus`/`resolveOccurrenceStatus` tests are unchanged.
- **Verification method:** unit test on `setStatus` + `resolveOccurrenceStatus` for a recurring
  item; optionally a render check that ListView and TodayView agree. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 3/4/5 **Score (impact×reach):** 12
- **Effort:** M **Risk:** med (needs a product decision: propagate to occurrences vs. drop the
  series `done` affordance for recurring rows) **Depends on:** none
- **Not in FEATURES.md:** IMP-016/IMP-037 defined occurrence status storage; no item reconciles a
  series-level `done` with the occurrence resolver.

---

## C4 — Reject non-string occurrence override fields on import

- **Area / files:** `src/lib/itemValidation.ts:52-59` (`asOverrides` accepts any plain object and
  casts it to `OccurrenceOverride` without checking `start`/`end`/`status`), used by
  `coerceItemShape` (`:114-128`) → `validateItem` (`:133-141`), reached from
  `src/lib/backup.ts:70-77` (`parseBackup`) and `src/lib/csv.ts` (`csvToItems`);
  the bad value flows through `src/domain/recurrence.ts:145`/`:237` into
  `src/hooks/useOccurrences.ts:13-17`, whose sort does `(a.start ?? a.occKey).localeCompare(…)`.
- **Evidence (repro):** `probe6.test.ts` V1. A backup row with
  `recurrence.overrides: {"2026-03-09": {"start": 5}}` imports cleanly (`parsed.invalid === 0`);
  `normalizeItem` + `expandOccurrences` produce `start` values `"2026-03-02T09:00", 5, …`; running
  the exact `useOccurrences` sort throws `TypeError: aTime.localeCompare is not a function`.
  **Observed:** a malformed override crashes every occurrence view (Today, Calendar, Habits,
  Bills, Goals) via `useOccurrences`; **Expected:** the malformed row is rejected (counted in
  `invalid`) or its override is coerced/dropped, so no numeric `start` reaches the engine.
- **Intent:** `validateItem` exists to make untrusted import payloads safe; an override field that
  is never type-checked defeats it and turns a bad file into an app-wide crash.
- **Acceptance criteria:**
  1. `validateItem` rejects (or drops) an override whose `start`/`end` is present but not a string,
     and whose `status` is not a valid `OccurrenceStatus`.
  2. A backup/CSV with such an override either increments `invalid` or yields an item whose
     `expandOccurrences` starts are all strings.
  3. `useOccurrences` never receives a non-string `start` for a valid import (defensive guard
     optional).
  4. Existing backup/CSV/validation tests still pass.
- **Verification method:** add malformed-override rows to `src/lib/backup.test.ts` /
  `itemValidation` tests and assert rejection or string-only `start`s; keep a regression case for
  the current crash.
- **Severity:** S2 **Impact/Reach/Confidence:** 4/2/5 **Score (impact×reach):** 8
- **Effort:** S **Risk:** low **Depends on:** none
- **Not in FEATURES.md:** IMP-079/IMP-111 hardened item-level import coercion; override-map fields
  are never validated, and no item covers them (the follow-up harvest's F5 covers `lists` only).

---

## C5 — De-duplicate recurrence grid entries so occurrences are not repeated

- **Area / files:** `src/lib/itemValidation.ts:46-50` (`asNumberArray` filters non-finite numbers
  but keeps duplicates and out-of-range values), applied to `byWeekday`/`byMonthDay`/`byMonth` at
  `:88-93`; `src/domain/recurrence.ts:42` `candidateDates` consumes the arrays verbatim
  (`:59`, `:79-87`, `:100-114`) and `dateTimesInOrder` (`:33`) sorts without de-duplicating.
- **Evidence (repro):** `probe5.test.ts` T1–T4.
  - `byWeekday: [1,1]` weekly → occurrences `2026-03-02, 2026-03-02, 2026-03-09, 2026-03-09`
    (same `occKey` twice).
  - `byMonthDay: [31,-1]` monthly → two entries for every month (both clamp to the last day).
  - `byWeekday: [1,1]` with `count: 3` → only `2026-03-02, 2026-03-02, 2026-03-09` (the series ends
    after 2 distinct days because duplicates consume `count`).
  - `normalizeItem` preserves `[1,1]` / `[31,-1]` unchanged.
  - **Observed:** duplicate occurrences with identical `occKey` (duplicate cards/React keys,
    inflated totals, `count` exhausted early); **Expected:** each grid value is unique so one day
    yields exactly one occurrence.
  - Reachability: the editors build single-value/deduped arrays (`RecurrenceEditor.toggleWeekday`
    uses a `Set`), so this arrives through imported CSV/JSON rules (the listed malformed-payload path).
- **Intent:** the occurrence key is the unit of identity for status, reminders and analytics;
  two occurrences sharing a key break that invariant, and `count`/`until` semantics assume one
  candidate per grid slot.
- **Acceptance criteria:**
  1. `coerceRecurrence` de-duplicates and range-validates `byWeekday` (0–6), `byMonthDay` (1–31 or
     -1) and `byMonth` (1–12).
  2. A rule with duplicate grid entries expands to one occurrence per distinct day.
  3. A `count`-limited rule with duplicates yields exactly `count` distinct occurrences.
  4. Existing recurrence tests are unchanged.
- **Verification method:** add import/expansion cases to `src/lib/itemValidation.test.ts` and
  `src/domain/recurrence.test.ts` asserting unique `occKey`s and correct `count` totals.
- **Severity:** S3 **Impact/Reach/Confidence:** 3/2/5 **Score (impact×reach):** 6
- **Effort:** S **Risk:** low **Depends on:** none
- **Not in FEATURES.md:** IMP-112/IMP-113 and the harvest's F2 cover count/until *emission*, not
  duplicate/out-of-range grid values in imported rules.

---

## Summary

| # | Candidate | Sev | Impact | Reach | Conf | Effort | Risk |
|---|-----------|-----|--------|-------|------|--------|------|
| C1 | Preserve per-occurrence state when splitting a series | S2 | 4 | 3 | 5 | S | low |
| C2 | Stop reminders for done/cancelled occurrences | S2 | 3 | 4 | 5 | S | low |
| C3 | Reconcile a series `done` with its occurrences | S3 | 3 | 4 | 5 | M | med |
| C4 | Reject non-string override fields on import | S2 | 4 | 2 | 5 | S | low |
| C5 | De-duplicate recurrence grid entries | S3 | 3 | 2 | 5 | S | low |

Strongest three: **C1** (silent per-occurrence data loss on a normal "this and future" edit),
**C2** (reminders fire for occurrences the user cancelled or completed), **C4** (a malformed
import payload crashes every occurrence view). C1 and C2 are the cheapest fixes (S, low risk) and
sit on common user paths; C4 needs only stricter override validation in `itemValidation.ts`.
