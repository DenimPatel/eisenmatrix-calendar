# impl-IMP-023 — Correct `count` when splitting a recurring series (retry 2)

Retry 2 fixes the two BLOCKERs and the coverage gap raised by
`.improve/reports/verify-IMP-023.md` (VERDICT: FAIL). The headline count fix from retry 1
was kept; nothing was reverted.

## Files
- `src/domain/recurrence.ts`
  - `impliedAnchorFields()` (`:334-350`) — new. Materialises the grid fields
    `candidateDates` infers from the series start (`byWeekday` for weekly, `byMonthDay` for
    monthly, `byMonth`/`byMonthDay` for yearly) onto the **tail only**.
  - `expandOccurrences` (`:259`) and `occurrencesBeforeKey` (`:333`): the cap is now
    `rule.count !== undefined && generated >= rule.count` instead of a truthy test.
  - `splitSeries` (`:375-417`): the tail rule spreads `impliedAnchorFields(rule, anchor)`
    before `until`/`count`; doc comment rewritten to state the anchoring rule.
- `src/domain/recurrence.test.ts`: +9 tests — 2 for the `count: 0` semantics, 7 in a new
  `describe('splitSeries keeps every occurrence on its original date')` covering the drift
  cases and the union property.
- `src/domain/itemActions.test.ts`: +1 test that drives the real `seriesPatch` shape through
  `updateRecurring(..., 'future', …)` (the shape the editor actually sends), so mutation C
  can no longer survive. Imports `type ItemPatch` from `@/db/repository`.
- Reports: this file. `.improve/FEATURES.md` status left `TODO`; nothing committed.

## Issue 1 (D1, BLOCKER) — implicit `byMonthDay`/`byMonth` drift

**Cause.** `splitSeries` moves the tail's `start` onto the split day. That day is often a
*clamped* occurrence (Aug 31 → Sep 30). `candidateDates` derives the day-of-month from
`seriesStart.getDate()` whenever `byMonthDay` is absent, so the tail re-derived day 30
instead of 31 and every later occurrence moved a day earlier. Same for `byMonth` on
`yearly`. `RecurrenceEditor.baseRule()` never writes `byMonthDay`, so this is the rule shape
the editor stores with no extra user action.

**Fix.** The tail keeps the **pre-split** anchor. `impliedAnchorFields` writes exactly the
fields `candidateDates` would have inferred from the original series start, and only the
absent ones — an explicit `byMonthDay`/`byMonth`/`byWeekday` is left untouched, and a rule
that already carries them is unchanged byte-for-byte. `start`/`end`/`dueAt` still move onto
the split day (retry 1), which is what makes the count arithmetic meaningful; only the
*derived grid* is now pinned to the original anchor.

Measured on the reviewer's reproduction (`start=2026-08-31`, `monthly`, `count=10`, split
`2026-09-30`, no `byMonthDay`):

```
orig  = 08-31 09-30 10-31 11-30 12-31 01-31 02-28 03-31 04-30 05-31
union = 08-31 09-30 10-31 11-30 12-31 01-31 02-28 03-31 04-30 05-31   (identical)
byMonthDay = [31]   tail.start = 2026-09-30
```

Oct 31 and Dec 31 stay on the 31st; before the fix they were Oct 30 / Dec 30. `Feb 28` is
still the clamped short-month date, so AGENTS.md's "month-end is clamped, never skipped"
invariant holds.

## Issue 2 (D2, BLOCKER) — `count: 0` was unbounded

`Math.max(0, rule.count - consumed)` can be `0`, but both expansion loops gated on
`if (rule.count && …)`, and `0` is falsy — so a fully consumed series produced an
*unbounded* tail (27,757 occurrences measured over 2000–2100).

**Fix at the engine, not the call site:** both loops use
`rule.count !== undefined && generated >= rule.count`, so `count: 0` means "no occurrences"
everywhere — `expandOccurrences`, `occurrencesBeforeKey` (and therefore `nextOccurrence`,
`isItemActiveOnDate`, the calendar views). A fully consumed series therefore yields an
explicitly empty, correctly bounded tail:

```
splitSeries(daily/count=3, fromKey='2024-01-04')
  -> tail.recurrence.count === 0, occurrences over 2000-2100 === 0   (was 27,757)
```

`splitSeries` keeps returning a tail so its contract and its single caller's history/undo
behaviour are unchanged; the tail is simply inert rather than infinite.

## Issue 3 (D3) — the `itemActions.ts` anchor guard now has a test

Retry 1's tests passed minimal patches (`{ title: '…' }`), so the guard at
`itemActions.ts:325-327` (drop `start`/`end`/`dueAt` when they equal the stored row) was
unverified — deleting it kept the suite green. The new test replicates `seriesPatch(draft)`
field-for-field from `ItemEditorSheet.tsx:54-71`, so the stored dates come back in the patch
with no user edit, and asserts the tail's `start`/`end`/`dueAt` are the split-day values,
the head's are untouched, and head ∪ tail equals the unsplit 10 occurrence keys.

## Primary invariant, re-proved as a property

`head ∪ tail === keys(unsplit series)` **exactly** — no gaps, no duplicates, no date drift —
asserted at *every* occurrence key (the only keys the editor can supply as a split point)
across **810 series / 4,185 splits**: starts `{2023-12-31, 2024-01-15, 2024-01-30,
2024-01-31, 2024-02-29}` (month-end 30th/31st and a leap day) × rules `{daily, weekly
implicit, weekly [1,3,5], monthly implicit, monthly [5,20], monthly [-1], yearly implicit,
yearly byMonth [1,7], yearly Feb-29}` × intervals `{1,2,3}` × counts `{1,2,3,5,8,12}`.
Each split asserts (a) head and tail share no key, (b) the union equals the unsplit keys
exactly, (c) head + tail length equals the original `count`. Plus a timed
(`09:00–10:30`, month-end, one `exceptions` day) sweep over every split key.

Unit cases pinning the reviewer's repro: 31st anchored monthly split at the clamped
`2026-09-30` and `2024-02-29`; 29th/30th anchored monthly; `start=2024-02-29` yearly split
at the non-leap `2025-02-28` (leap occurrence `2028-02-29` retained); explicit `[-1]`
unchanged.

## Mutation checks (all reverted; `git diff` clean afterwards)

| Mutation | Result |
| --- | --- |
| **A** — drop `impliedAnchorFields` from the tail rule | **CAUGHT** — 6 failures: all 4 drift unit cases, the 810-series property sweep and the timed sweep |
| **B** — restore the truthy `rule.count &&` cap in `expandOccurrences` | **CAUGHT** — 2 failures: the `count: 0` engine test and the fully-consumed-tail test |
| **C** — delete the `tailPatch` anchor guard in `itemActions.ts` | **CAUGHT** — 1 failure: `keeps the tail on the split day when the patch repeats the stored dates` (survived in retry 1) |
| **D** — retry 1's original mutation: drop `...tailCount` | still caught (retry 1's `head.length + tail.length === rule.count` assertions are in the property sweep now) |

## Gates

```
npm run typecheck   exit 0
npm run lint        exit 0 (0 errors, 0 warnings)
npm run test        Test Files 29 passed (29) | Tests 279 passed (279)
npm run build       exit 0; PWA injectManifest emitted dist/sw.js, precache 18 entries (610.10 KiB)
```

Baseline 258 → 269 (retry 1) → **279** (+10 this round). `npx prettier --check` clean on all
four touched files. IMP-016's `occurrence`-scoped branch and the `all` branch are untouched.

## Notes
- The tail now persists `byMonthDay`/`byMonth`/`byWeekday` where the source rule relied on
  them being inferred. That is the only way to pin a grid whose anchor moved; a consumer that
  round-trips the rule through the editor will now see the fields pre-filled with exactly the
  values that were already in effect, so the "On day"/weekday controls show the series' real
  day instead of the split day's clamped one. `RecurrenceEditor` accepts them unchanged.
- D4 from the review (`hasException` on the head walking the whole rule, not just its own
  occurrences) remains open and unchanged — it is pre-existing behaviour, out of scope here.