# verify-IMP-131 — Year view expansion & editor analytics

**Reviewer:** independent skeptical pass (no source changes)
**Scope:** IMP-131 (`YearView` expands the year range once and buckets by month),
IMP-132 (editor analytics computed only while the Analytics tab is open)
**Impl report:** `.improve/reports/impl-IMP-131.md`

## Verdict: PASS

Both changes are behaviour-preserving and the claimed speedups are structurally sound.
All gates pass; independent equivalence testing against the HEAD algorithm found no
divergence.

---

## What was reviewed

Diff touches four files (167 insertions, 19 deletions):

- `src/features/calendar/CalendarView.tsx` — `YearView` now receives the parent's
  single year-range `occurrences` and buckets by `Number(occ.occKey.slice(5,7)) - 1`;
  `YearMonthCard` no longer calls `useOccurrences`.
- `src/features/item/ItemEditorSheet.tsx` — the `analytics` `useMemo` returns `null`
  unless `tab === 'analytics'` and adds `tab` to its deps.
- The two corresponding `*.test.tsx` files.

## IMP-131 — bucketing correctness

Reference algorithm (HEAD): each `YearMonthCard` called
`useOccurrences(items, new Date(year, m, 1), endOfMonthDate(...))`, i.e. a per-month
`expandOccurrences` pass, sorted per card. The parent also ran a 13th pass for the
year range.

The new algorithm reuses that parent year pass and partitions it by the occurrence's
`occKey` month. This is exactly equivalent because, in `expandOccurrences`
(`src/domain/recurrence.ts:259`):

- window membership is decided by `startOfDay(candidate)` (`:281`,`:287`,`:288`), and
  `occKey = toOccKey(candidate)` is derived from that same candidate (`:235`), never
  from an override start;
- `count`/`until` are tallied from the series start regardless of the window
  (`:285`–`:288`), so a per-month pass and the whole-year pass generate the identical
  candidate set for each month;
- `from`/`to` are the union of the twelve month windows
  (`startOfYear`..`endOfYearDate` vs `new Date(year,m,1)`..`endOfMonthDate`), all local.

Consequently the year set is the disjoint union of the per-month sets, and bucketing by
`occKey` reproduces each card exactly, including sort order (the parent's global sort is
a stable sort on the same key as the per-card sort, so within-month order is preserved).

### Independent equivalence test (throwaway, now deleted)

I wrote a throwaway vitest that, for the current year, compared the HEAD algorithm
(per-month `expandOccurrences` + per-card sort) against the new bucket (year pass +
`occKey` month partition) as fully materialised string lists:

- Adversarial fixtures: a multi-day event spanning a month boundary (Jan 30–Feb 2), a
  multi-day event crossing the year boundary (Dec 31 prev year → Jan 2), an event ending
  exactly on Dec 31, a month-end-clamped monthly series (`start Jan 31`, `until Jun 15`),
  weekly count-limited series at `weekStartsOn` 0 and 1, a daily series with an
  `exceptions` entry **and** an `overrides` entry that moves an occurrence into another
  month, and a `yearly` series. Result: `newBucket === headPerMonth` for all 12 months.
- A 40-case randomised sweep over `{daily,weekly,monthly,yearly}` × `interval 1..3` ×
  `weekStartsOn 0/1` × `byMonthDay [-1]` × `count` × `until`: identical every time.
- A DOM mount of the real `CalendarView` in year mode, comparing each month card's
  visible items against a per-month expansion over the same DB item order: identical.

I also verified the year view against the same `items` array the component reads
(`itemRepo.all()`), because a naive fixture-order comparison can differ only on
same-day ties (two all-day items sharing a date). That tie order is stable and
identical between HEAD and the new code (both preserve source order), so it is not a
behaviour change.

### Browser sanity (preview build on :4173)

Reset SW registrations + caches, then loaded the production `dist/`:

- Year mode renders 12 month cards; seeded daily habits appear from their series-start
  month onward, `YEAR_CARD_LIMIT` slice and `+N more` correct (e.g. Oct 2027 with 8
  habits × 31 days = 248 → 5 shown + `+243 more`).
- `Next` year navigation re-buckets correctly (title `2027`, 12 cards).
- No console errors/warnings.

## IMP-132 — analytics freshness

`TabPanel` returns `null` unless its value matches the active tab
(`src/components/ui/Tabs.tsx:112`), so the Analytics panel is unmounted on every other
tab. The memo now short-circuits to `null` when `tab !== 'analytics'`, and `tab` is a
dependency, so:

- typing on Details/Schedule/History performs zero `itemCompletionStats` +
  120-day `expandOccurrences` work (the impl test spies this: `not.toHaveBeenCalled`);
- opening Analytics recomputes from the current `draft` (no stale memo), and re-entering
  after an edit recomputes again.

Browser check: opened a recurring habit, Analytics showed `51 of 96 in last 120 days`
with recent keys `2026-10-18 … 2026-10-07`. Changed the series Start date to
`2026-10-15` on the Schedule tab, returned to Analytics: it recomputed to `3 of 4` with
keys `2026-10-18 … 2026-10-15`. No stale value. No console errors.

The output for the open tab is unchanged: `analytics` is only consumed inside the
`analytics` `TabPanel`, and it is non-null exactly when that panel is mounted.

## Week-start setting

The year view has no weekday grid; it is unaffected by `settings.weekStartsOn`. The
setting only drives the month/week grids (verified by the existing
`CalendarView weekStartsOn` tests, still green) and the recurrence editor default. The
equivalence sweep exercised `weekStartsOn` 0/1 inside rules and stayed identical.

## Gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test` | 59 files, 603 passed |
| `npm run format:check` | pass |
| `npm run build` | pass (PWA precache 18 entries) |

Targeted: `CalendarView.test.tsx` + `ItemEditorSheet.test.tsx` = 30 passed.

## Issues

None blocking. Non-issues noted for completeness:

- Same-day ties between all-day items depend on the source array order, which the
  component takes from Dexie; this is identical before/after and stable, so it is not a
  regression.
- The parent still computes the unused `byDay` map while in year mode; a negligible
  micro-optimisation opportunity, not a correctness concern.
