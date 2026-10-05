# Verification — IMP-023 (re-verification, retry 2)

**Reviewer:** independent reviewer (did not write the change)
**Date:** 2026-10-05
**Item:** `.improve/FEATURES.md` → `### IMP-023` — "Correct `count` when splitting a recurring series"
**Implementation report:** `.improve/reports/impl-IMP-023.md` (retry 2)
**Prior report:** `.improve/reports/verify-IMP-023.md` (retry 1, VERDICT: FAIL — D1/D2 blockers + D3 coverage gap)
**Conventions:** `AGENTS.md`, `.improve/REPO_PROFILE.md`

# VERDICT: PASS

Retry 1's headline count fix survived, and all three prior blockers are genuinely fixed —
including the one that the previous report reproduced end-to-end in the running app. I probed
each independently rather than trusting the committed tests, and re-proved the full union
invariant over **113,100 splits across 20,244 series** with **0 defects**, plus a
4,368-pair scan over *every* calendar day in a six-month window that finds **0 violations at
any key the editor can supply**.

---

## 1. Diff scope review

`git diff --stat -- src/` → 4 files, +553 / −15. Matches the impl report's file list exactly.

| Check | Result |
| --- | --- |
| Files touched vs. impl report claim | **match** (4/4) |
| Unrelated files / debug leftovers / `console.*` | none |
| Hardcoded slate/white, direct `localStorage`, direct Dexie outside `src/db/` | none |
| New dependencies | none |
| AGENTS.md "comments only for non-obvious intent" | 3 new comments, all explanatory (falsy-`count` trap, anchor guard, `occurrencesBeforeKey` tally) |
| `occurrencePatch` / `OccurrenceEdit` touched | **no** — diff is confined to the `future` branch |
| Prettier | clean on all four files |

The change is confined to `splitSeries` plus two engine-line edits and the `future`-branch
anchor guard. `hasException`/`occurrenceStateFor` are outside the diff.

---

## 2. Prior blockers — each re-probed independently

### D1 (BLOCKER) — implicit `byMonthDay` drift: **FIXED**

`impliedAnchorFields()` (`recurrence.ts:341-352`) materialises exactly the grid fields
`candidateDates` would have inferred from the **pre-split** anchor, and only the absent ones.

The reviewer's exact repro, re-run by me:

```
start=2026-08-31  freq=monthly  count=10   (recurrence.byMonthDay === undefined)
split @ 2026-09-30

orig  2026-08-31 2026-09-30 2026-10-31 2026-11-30 2026-12-31 2027-01-31 2027-02-28
      2027-03-31 2027-04-30 2027-05-31
head  2026-08-31
tail  2026-09-30 2026-10-31 2026-11-30 2026-12-31 2027-01-31 2027-02-28
      2027-03-31 2027-04-30 2027-05-31
tail.rule  { …, count: 9, byMonthDay: [31], until: null }
```

**Oct 31 and Dec 31 preserved. `2027-02-28` still the clamped short-month date** (AGENTS.md:
"clamped, never skipped"). Union == original, exactly.

Additional probes I ran that the committed tests do not cover:

| Anchor | Split day | Result |
| --- | --- | --- |
| 31st | `2024-02-29` (leap clamp) | union exact |
| 31st | `2024-04-30`, `2024-06-30`, `2024-11-30` | union exact |
| **30th** `2024-01-30` | `2024-02-29` | orig `01-30 02-29 03-30 04-30 …` preserved |
| 30th `2023-01-30` | `2023-02-28` (non-leap clamp) | preserved |
| 30th `2024-01-30` | `2024-04-30` (exact, no clamp) | preserved |
| **29th** `2024-01-29` / `2023-01-29` | `2024-02-29` / `2023-02-28` | preserved |
| yearly `2024-02-29` (implicit `byMonth`/`byMonthDay`) | `2025-02-28` | `2028-02-29` **leap occurrence retained** — the occurrence retry 1 lost |
| weekly implicit `2024-01-03` | `2024-01-24` | `tail.byWeekday === [3]`, union exact |

Leap years behave: `2028-02-29` survives a yearly split at `2025-02-28`, and `2027-02-28`
stays clamped in the monthly series.

**Reproduced end-to-end in the running app** — see §6. The stored tail rule has
`byMonthDay: [31]` and Calendar still shows Oct 31 / Dec 31 / Feb 28 2027.

### D2 (BLOCKER) — `count: 0` produced an unbounded tail: **FIXED**

Fixed at the engine (`rule.count !== undefined && generated >= rule.count` in both
`expandOccurrences` and `occurrencesBeforeKey`), not at the call site. Measured:

```
splitSeries(daily/count=3, fromKey='2024-01-04')
  -> tail.recurrence.count === 0
  -> expandOccurrences(tail, 2000-01-01 … 2124-12-31).length === 0     (retry 1: 27,757)

count: 0 item itself: expandOccurrences → []      nextOccurrence(…, 3660) → null
```

Swept every frequency (`daily`, `weekly`, `weekly [1,3,5]`, `monthly`, `monthly [5,20]`,
`yearly`, `yearly Feb-29`) × counts `{1,2,3,5,9}` × three far-future split keys: **worst
tail = 8 occurrences**, i.e. a legitimate leftover count. Never thousands. The "occurrence
count must be 0 (or the original count)" requirement holds.

### D3 — the `itemActions.ts` anchor guard is now covered: **FIXED**

Deletion of the guard (`itemActions.ts:323-327`) now fails **3** tests:

```
× anchors the tail on the split day and keeps the series total
× applies a start the editor actually changed
× keeps the tail on the split day when the patch repeats the stored dates
```

In retry 1 the same mutation **survived**. The new test replicates `seriesPatch(draft)`
field-for-field from `ItemEditorSheet.tsx:54-71`, so the real editor payload is exercised.

---

## 3. Full invariant sweep — `head ∪ tail == unsplit keys EXACTLY`

Temporary harness (`src/domain/__imp023_reverify.test.ts` + `__imp023_mid.test.ts` +
`__imp023_baseline.ts`; run, then deleted — `src/` is byte-identical afterwards).
Each split asserts (a) no key appears in both halves, (b) the sorted union equals the
unsplit key set, (c) `head + tail` length equals the original occurrence count.

### 3a. Broad rule-space sweep — 113,100 splits, 0 defects

```
STARTS (9)   2023-12-31 2024-01-01 2024-01-15 2024-01-29 2024-01-30 2024-01-31
             2024-02-29 2024-03-30 2024-12-31
RULES (14)   daily · daily i5 · weekly implicit · weekly [1,3,5] · weekly [0,6]
             weekly i2 · monthly implicit · monthly [5,20] · monthly [-1] ·
             monthly i2 · yearly implicit · yearly byMonth [1,7] ·
             yearly byMonth[2]+byMonthDay[29] · yearly i2
INTERVALS    1, 2, 3            COUNTS  1, 2, 3, 5, 8, 12, 20
until        null, 2024-04-15, 2025-12-31, 2028-02-29
shape        all-day AND timed (09:00–10:30)
split points EVERY real occurrence key (the only keys the editor supplies)

=> bounded sweep: 20244 series, 113100 splits, 0 defects
```

### 3b. Exceptions and overrides — 396 splits, 0 defects

`exceptions` on a mid-series key, and `overrides` moving an occurrence to a different
time-of-day, across daily/weekly/monthly/yearly × counts `{3,6,9}` × every reachable split
key. Union exact in all cases; the override's `occKey` survives into the head.

### 3c. Every calendar day, not just occurrence keys — 4,368 pairs, 0 reachable violations

This closes the one edge I suspected in retry 2. `splitSeries` re-anchors the tail's week /
month / year grid on the split day, so I expected misalignment when `interval > 1` and the
split key lands in a *skipped* period. I scanned every day from 2024-01-01 to 2024-06-30
against 4 series × 3 intervals × 2 counts:

```
midpoint scan: 4368 (series, split-day) pairs
new code violates the union invariant at 660 NON-reachable keys, 0 reachable keys
baseline (HEAD) violates at 3736 NON-reachable keys
```

- **0 violations at any real occurrence key** — the only kind the editor can produce.
- On arbitrary mid-period keys the new code is **strictly better than the pre-change code**
  (660 vs 3,736 violations), because the baseline duplicated the head's occurrences on
  *every* key. So this is not a regression; it is a net improvement on an input shape the
  product never produces.

### 3d. Other invariants confirmed

- **DST**: weekly 09:00 split across the 2024-11-03 US change → every tail occurrence keeps `T09:00`.
- **Timed duration**: `09:00`→`10:30` preserved; `tail.start`/`tail.end` match `/T09:00$/`,`/T10:30$/` at every split.
- **Skipped days still consume `count`**, matching unsplit expansion.
- **Unparseable keys** (`''`, `'not-a-date'`, `'nope'`, `'2024/13/45'`, `'   '`): no throw, returns the untouched item for both halves (IMP-041's null guard works).
- **Correction to retry 1's report**: it claimed `'2024-13-45'` returns the item unsplit. It does not — `parseLocalDate` matches `DATE_ONLY` and `new Date(2024, 12, 45)` rolls over to 2026-02-14, so `splitSeries` splits on that date. This is pre-existing `parseLocalDate` behaviour, identical before and after this change (verified against the HEAD module). Recorded, not a regression, and not reachable from the UI.

---

## 4. Acceptance criteria

| AC | Status | Evidence |
| --- | --- | --- |
| **AC1** — head keeps only occurrences up to the split; tail's `count` is reduced by what the head consumed (or null if the original had no count) | **MET** | 113,100 splits / 0 defects; `tail.count === count - consumed` at every split, including mid-period keys between occurrences. App: head `until=2026-09-29 count=10`, tail `start=2026-09-30 count=9 byMonthDay=[31]`. |
| **AC2** — total occurrences after a split equals the original `count` | **MET** | Sweep asserts `head+tail length === original` on every one of 113,100 splits. App: weekly head 2 + tail 8 = 10; monthly head 1 + tail 9 = 10. December shows the tail ending **Dec 7** only — no Dec 14/21/28. |
| **AC3** — `until`-bounded and unbounded splits unchanged | **MET** | 174-case differential against the **actual pre-change code** (`git show HEAD:src/domain/recurrence.ts`, run side-by-side in the same process) over every *reachable* occurrence key for count-less and `until`-bounded daily/weekly/monthly/yearly series × intervals `{1,2,3}` × until `{null, 2024-04-15, 2028-02-29}`: `head.until`, `head.count`, `head.start`, `head.keys`, `tail.until`, `tail.count`, `tail.end`, `tail.dueAt`, `tail.keys` are **all byte-identical**. The only difference is `tail.start`/`end`/`dueAt`, which is the re-anchor the whole fix depends on. |

---

## 5. Regression check — `updateRecurring` `future` scope and IMP-016's `occurrence` scope

- **`occurrence` branch (`itemActions.ts:278-311`) — not in the diff.** IMP-016's one-occurrence
  scope (override-only, series untouched) is unchanged.
- **`all` branch (`:313-316`) — not in the diff.**
- **`future` branch (`:318-338`)** gained only the anchor guard. Confirmed the guard is
  correct and narrow: it drops `start`/`end`/`dueAt` **only** when they equal the persisted
  row (re-read from `itemRepo`, so a stale draft cannot fool it), and an actually-edited
  `start` still wins — asserted by `applies a start the editor actually changed`.
- `seriesPatch(draft)` (`ItemEditorSheet.tsx:54-71`) does **not** include `recurrence`, so
  `tailPatch.recurrence` is `undefined` in the real editor path and `splitSeries`' computed
  `count` survives. Verified against the real field list, and again in the app (§6) where the
  stored tail carries `count: 9` / `count: 8`.
- IMP-037 (future-scope split making head and tail titles diverge): still present, still
  out of scope, still disclosed in the impl report. Not a regression.

---

## 6. Gates, mutation check, and visual verification

### Gates — all green (run twice: before and after the mutation/visual work)

```
npm run typecheck   exit 0
npm run lint        exit 0 (0 errors, 0 warnings)
npm run test        Test Files 29 passed (29) | Tests 279 passed (279)
npm run build       exit 0; PWA injectManifest emitted dist/sw.js, precache 18 entries (610.10 KiB)
```

Baseline 258 → 269 (retry 1) → **279** (+21 = 11 retry-1 + 10 retry-2 tests).

### MUTATION-CHECK — all four mutations caught, files restored byte-identically

| # | Mutation | Result |
| --- | --- | --- |
| **A** | reintroduce the **old copy-count-into-both** logic — drop `...tailCount` from the tail rule | **CAUGHT** — 15 failures (13 in `recurrence.test.ts` incl. `keeps a count-limited series at its original total` and the whole property sweep; 2 in `itemActions.test.ts` incl. `keeps the tail on the split day when the patch repeats the stored dates`) |
| **B** | reintroduce the **split-date re-anchor** — drop `impliedAnchorFields` from the tail rule | **CAUGHT** — 6 failures: all four drift unit cases, the 810-series property sweep, the timed sweep |
| **C** | delete the `tailPatch` anchor guard in `itemActions.ts` | **CAUGHT** — 3 failures (**survived in retry 1**) |
| **D** | restore the truthy `rule.count &&` cap in `expandOccurrences` | **CAUGHT** — 2 failures: `reads a count of zero as an empty series, not an unbounded one`, `produces no tail occurrences once the head has consumed the whole count` |

Restore verified by SHA-256 before/after, and `git diff` confirms `src/` is byte-identical
to the pre-review state:

```
d33b1819…  src/domain/recurrence.ts
0573f99d…  src/domain/itemActions.ts
7e358e1a…  src/domain/recurrence.test.ts
a4ceeabe…  src/domain/itemActions.test.ts
```

### VISUAL — Playwright against `npm run preview` (production build, port 4173)

Pre-flight required (same as retry 1): `getRegistrations()` + unregister, `caches.delete()`,
`indexedDB.deleteDatabase('eisenmatrix')` and a **real** reload. A hash-only `page.goto()` does
not reload and will silently run a stale service-worker bundle. Two migration-seeded "Legacy
migrated task" rows were removed from this throwaway browser profile so the calendar cells are
legible.

**Scenario A — the retry-1 BLOCKER, now fixed in the product.**
Created "IMP023 monthly implicit 31st" via the editor: start `2026-08-31` → Repeat →
**Monthly** ("On day" never touched, so `recurrence.byMonthDay` is `undefined`) → Ends →
After 10 times. Pre-split the series rendered Aug 31, Sep 30, **Oct 31**, … → opened the
**Sep 30** occurrence → *This and future* → Save.

Stored rows:

```
head  start=2026-08-31  count=10  until=2026-09-29  byMonthDay=undefined
tail  start=2026-09-30  count= 9  until=null       byMonthDay=[31]
```

Calendar after the split, extracted day-by-day by walking the month grid:

```
Aug 31 · Sep 30 · Oct 31 · Nov 30 · Dec 31 · Jan 31 · Feb 28 · Mar 31 · Apr 30 · May 31
(total 10 = original count; nothing on Oct 30, Nov 31, Dec 30, Jan 30, Feb 27/29)
```

`reverify-03-AFTER-split-october-2026-STILL-ON-31.png` and
`reverify-04-AFTER-split-december-2026-STILL-ON-31.png` are decisive: the item is on the
**31st**, absent from the 30th. Retry 1's `imp023-05-BUG-…-drift-october-2026.png` shows the
opposite. `reverify-05-AFTER-split-february-2027-clamped-to-28.png` shows the clamped
`Feb 28` — clamped, not skipped.

**Scenario B — count arithmetic end-to-end.**
Created "IMP023 weekly count10": start `2026-10-05` → Repeat → Weekly → After 10 times.
Opened the **Oct 19** occurrence → *This and future* → Save.

```
head  start=2026-10-05  count=10  until=2026-10-18  -> 2 occurrences (Oct 5, Oct 12)
tail  start=2026-10-19  count= 8  until=null byWeekday=[1]
                                                  -> 8 occurrences (Oct 19, Oct 26;
                                                      Nov 2, 9, 16, 23, 30; Dec 7)
total = 10 = original count
```

`reverify-06-AFTER-split-december-2026-weekly-ends-dec7-monthly-on-31.png` shows both fixes in
one frame: the weekly series appears **only on Dec 7** (the old copy-count behaviour would have
produced Dec 7, 14, 21, 28) and the monthly series is on **Dec 31**.

`reverify-02-editor-scope-this-and-future.png` captures the scope picker.

**Console errors: 0** — `playwright_browser_console_messages` returned empty for the whole
session.

---

## 7. Remaining (non-blocking) observations

1. **D4 from the retry-1 report, still open and correctly out of scope.** The head's
   `exceptions`/`overrides` are copied wholesale, so an exception dated *after* the split key
   is carried into the head even though it affects no head occurrence (harmless — the head's
   `until` bounds it). `occurrencesBeforeKey` already computes `consumed`; the guard could be
   derived from it. Pre-existing behaviour, unchanged by this diff.
2. **`splitSeries` with a non-occurrence key and `interval > 1`** no longer reproduces the
   original grid on the tail (660 of 4,368 arbitrary-day pairs, vs 3,736 for the pre-change
   code). 0 reachable; strictly better than baseline; not product-reachable. No action.
3. **New persisted field.** The tail now carries the `byMonthDay`/`byMonth`/`byWeekday` the
   series was implicitly using. This is the only way to pin a grid whose anchor moved, it is
   correct, `RecurrenceEditor` round-trips it, and it is disclosed in the impl report.
4. **`parseLocalDate` accepts overflowing dates** (`2024-13-45` → `2026-02-14`) because
   `DATE_ONLY` matches before any calendar validation. Pre-existing, out of scope (IMP-041
   territory), and it does not throw.

None of these block PASS.

---

## Artifacts

`.improve/artifacts/IMP-023/` (added this round):

- `reverify-01-BEFORE-split-october-2026-item-on-31.png` — pre-split, item on Oct 31
- `reverify-02-editor-scope-this-and-future.png` — scope picker
- `reverify-03-AFTER-split-october-2026-STILL-ON-31.png` — **D1 fixed: still Oct 31**
- `reverify-04-AFTER-split-december-2026-STILL-ON-31.png` — **D1 fixed: still Dec 31**
- `reverify-05-AFTER-split-february-2027-clamped-to-28.png` — **Feb 28 clamped, not skipped**
- `reverify-06-AFTER-split-december-2026-weekly-ends-dec7-monthly-on-31.png` — **AC2: weekly ends Dec 7; monthly on Dec 31**

Retry-1 artifacts are retained for comparison (`imp023-05-BUG-implicit-monthly-drift-october-2026.png`
is the counter-example).

## Review hygiene

- No commits made.
- Only `.improve/reports/verify-IMP-023.md` and the six `reverify-*.png` artifacts were added.
- The three temporary harness files (`src/domain/__imp023_*.ts`) were deleted; `src/` verified
  byte-identical by SHA-256 before and after.
- `.playwright-mcp/` scratch directory removed.