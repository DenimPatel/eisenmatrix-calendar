# impl-IMP-113 — split tail recurrence rule (IMP-113 + IMP-112)

Status: DONE. Implemented both items in one change because both concern the recurrence
rule carried by a "This and future" split.

## IMP-112 — never emit COUNT and UNTIL in the same RRULE

- `src/lib/ics.ts` (`recurrenceToRRule`): the `COUNT` and `UNTIL` emissions were
  independent `if`s, so a split head — which `splitSeries` stops with `until` while
  keeping the original `count` — produced `…;COUNT=5;UNTIL=20260102`, forbidden by
  RFC 5545 §3.3.10. Now `UNTIL` is emitted when the rule has one, and `COUNT` only when
  there is no `UNTIL` (mutually exclusive). `UNTIL` is the tighter bound on a split head
  (the split day is preceded by a real occurrence, so `until = split − 1` stops the head
  at exactly the occurrences before the split), so it is the bound that survives the
  round trip.
- Tests: `src/lib/ics.test.ts` asserts a rule with both bounds yields exactly one of
  `COUNT=`/`UNTIL=` (the `UNTIL`), and that a count-limited `splitSeries` head exports as
  `FREQ=DAILY;INTERVAL=1;UNTIL=20260102` while its tail exports `COUNT=3`.

## IMP-113 — persist a recurrence-rule edit on "This and future"

- `src/features/item/ItemEditorSheet.tsx` (`seriesPatch`): added `recurrence: draft.recurrence`,
  which was previously omitted, so an edited rule never reached storage.
- `src/domain/itemActions.ts` (`updateRecurring`, `future` branch): the editor now hands
  the whole rule back on every save, so a guard drops `tailPatch.recurrence` when it is
  byte-identical to the stored rule. An unchanged rule therefore keeps the split's
  count-adjusted tail rule; a genuinely edited rule replaces the tail's rule. The head is
  still built from the persisted series row, so it keeps the pre-split rule and anchor
  fields. Scope "This occurrence" still routes through `occurrencePatch`, which omits
  `recurrence`, so it cannot touch the series.
- Tests: `src/domain/itemActions.test.ts` adds an edit→future test asserting the stored
  tail rule equals the edited rule and the head keeps its `weekly`/`until` rule; the
  existing repeated-stored-dates test now sends `recurrence` (as the real editor does) and
  asserts the tail keeps `count: 9`.

## Gates

`npm run typecheck && npm run lint && npm run test` all green (46 files / 521 tests);
`npm run format:check` clean. Prettier `--write` applied to the five changed files.

## Files changed

- `src/lib/ics.ts`
- `src/lib/ics.test.ts`
- `src/features/item/ItemEditorSheet.tsx`
- `src/domain/itemActions.ts`
- `src/domain/itemActions.test.ts`
