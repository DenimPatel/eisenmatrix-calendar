# Impl — IMP-071: Backfill `data` so a row without it cannot crash the editor

## Files changed
- `src/domain/itemFactory.ts` — `normalizeItem` now builds `data` from
  `defaultDataFor(kind)` plus the partial payload instead of relying on the
  `createItem` intermediate.
- `src/features/item/KindFields.tsx` — normalizes the incoming item once at the
  top and switches on `normalized.kind`, so a raw row with a missing, null or
  partial `data` renders the kind defaults. This is the defensive seam for direct
  (unnormalized) callers; no per-field guards were scattered through the JSX.
- `src/lib/ics.ts` — `itemsToICS` reads `item.data?.location` so a missing
  `data` cannot throw while exporting.
- Tests: `src/domain/itemFactory.test.ts` (missing/null backfill for every kind,
  partial payload merge), `src/lib/backup.test.ts` (parsed payload item without
  `data` normalizes to habit defaults), `src/lib/csv.test.ts` (row without a
  `data` column normalizes to goal defaults), `src/lib/ics.test.ts` (event with
  `data: undefined` exports without throwing), `src/features/item/ItemEditorSheet.test.tsx`
  (habit with `data: undefined` opens the Details tab with `Target count` = 1).

## Approach
Kept the fix at the `normalizeItem` seam: a wholly absent or `null` payload now
always yields the kind defaults, while partial payloads still merge over them.
`KindFields` normalizes again as a cheap, single defensive boundary so it is
correct even when handed an unnormalized row (the editor clones whatever the
store opened). ICS uses optional chaining because it has a single `data` read.
Imports still flow through the caller's existing `normalizeItem` mapping, and
tests assert that path yields full rows.

## Commands / results
`npm run typecheck && npm run lint && npm run test` — all pass.
- typecheck: no diagnostics
- lint: no output
- test: 33 files / 355 tests passed. Added cases cover missing/null `data` for
  every kind, partial-payload merge, backup/CSV import paths, ICS export, and
  opening the editor for an unnormalized row.

## Uncertainty
- None. `.improve/FEATURES.md`, `.improve/PROGRESS.log`, and
  `.improve/STATE.md` were already modified in the working tree by other work
  and were not touched. No discovered findings for IMP-071.
