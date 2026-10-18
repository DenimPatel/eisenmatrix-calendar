# verify-IMP-113 — independent review of IMP-112 + IMP-113

Reviewer: independent (did not author the change). Scope: working-tree diff on
`improve/auto-20261017` vs the acceptance criteria for IMP-112 and IMP-113 in
`.improve/FEATURES.md`, plus the four gates. Source not modified; probes were throwaway
and deleted.

## Verdict

**PASS.** All explicit acceptance criteria are met; the four gates are green. Two real
but documented, out-of-criteria correctness limits remain (below).

## What the diff does

- `src/lib/ics.ts` `recurrenceToRRule`: `COUNT` and `UNTIL` emission made mutually
  exclusive; `UNTIL` wins when both are present.
- `src/features/item/ItemEditorSheet.tsx` `seriesPatch`: now includes `recurrence`, so a
  rule edit reaches `updateRecurring` for scope `all`/`future`.
- `src/domain/itemActions.ts` `updateRecurring` (`future`): drops `tailPatch.recurrence`
  when it is byte-identical (`JSON.stringify`) to `stored.recurrence`, so an unchanged
  rule keeps `splitSeries`'s count-adjusted tail rule; a genuine edit replaces it.
- Tests added in `src/lib/ics.test.ts` and `src/domain/itemActions.test.ts`.

## IMP-112 — criteria check

1. Never emits `COUNT` and `UNTIL` together — **met**. Probe: rule `{count:5, until}` →
   exactly one bound. `src/lib/ics.test.ts:168`.
2. Split head's `count`/`until` survives the round trip as one bound — **met**. For a
   split head `until = split − 1`; because `hasOccurrenceOnOrAfter` gates the split, a
   real occurrence exists at/after the split, so the head's `until` is always ≤ the count
   bound. Emitting `UNTIL` alone reproduces the head's exact set. Probe: daily `count:5`
   split at `2026-01-03` → head set `{01-01, 01-02}`, unchanged with `count` dropped.
3. Test asserts at most one of `COUNT=`/`UNTIL=` — **met**.

### Residual (out of criteria, matches `discovered-IMP-113`)

- **D2 (real):** the fix always prefers `UNTIL`, which is *not* the tighter bound when
  `count` binds. A rule `{daily, count:3, until:'2026-01-31'}` exports `UNTIL` alone and
  reads back as 31 occurrences instead of 3. Same for such a rule's split tail
  (`{count:2, until:'2026-01-31'}` → 30 vs 2). Reachable only via import/backup, since
  `RecurrenceEditor` keeps `count`/`until` mutually exclusive. Criterion 2 scopes the
  round-trip claim to the **head**, which is correct; this is the tail/general case.
- **D1:** `count: 0` is falsy, so a fully-consumed tail exports with no bound at all
  (unbounded). Not part of IMP-112's criteria.

## IMP-113 — criteria check

1. Rule edit persisted on "This and future", tail carries it, head keeps the pre-split
   rule — **met**. `src/domain/itemActions.test.ts:868`; head keeps `weekly`/`until`.
2. "This occurrence" still cannot touch the series — **met**. `occurrencePatch` omits
   `recurrence`, the `occurrence` branch builds only overrides, and `SERIES_ONLY_FIELDS`
   disables the field. Probe: a `yearly` rule sent with scope `occurrence` left the stored
   `daily`/`count:5` rule and one row intact.
3. Test covers an edited rule on "This and future" — **met**.

Also verified: an unchanged rule handed back by the real `seriesPatch` shape does not
overwrite the tail (`count: 9` preserved, union = original set;
`src/domain/itemActions.test.ts:969`). Undo is a single entry whose `run()` restores the
exact pre-split row and removes the tail (probe: `toEqual(before)`, one row after).

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build`
— all pass (46 files / 521 tests). Throwaway probes deleted; working tree holds only the
five changed source files and the two report files.
