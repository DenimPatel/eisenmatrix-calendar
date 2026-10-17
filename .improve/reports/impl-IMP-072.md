# IMP-072 — Refuse an unrecognized import file instead of reporting success

## Status
Implemented on `improve/auto-20261017`. Not committed.

## Files changed
- `src/lib/csv.ts` — `csvToItems` now validates the header against the exporter's
  `CSV_COLUMNS`, throws on an empty/foreign payload, skips rows whose resolved `title`
  is blank, and returns `{ items, skippedBlank }`.
- `src/lib/backup.ts` — `parseBackup` rejects non-object JSON and payloads that carry
  neither an `items` nor a `tasks` array. `{ version: 1, items: [] }` still parses.
- `src/features/settings/SettingsView.tsx` — consumes the new CSV result and folds
  `skippedBlank` into the existing skipped count. Thrown errors continue through the
  existing `Import failed: …` catch, so no success toast is shown.
- `src/lib/csv.test.ts` — junk/empty payloads throw; blank-title rows are skipped and
  counted; empty export round-trips to zero items.
- `src/lib/backup.test.ts` — `{"hello":"world"}`, `{}` and `null` throw; legacy
  `{ version: 1, items: [] }` still imports; existing round-trip tests remain green.

## Approach
Validation happens inside the pure parsers, before any normalization, merge or Dexie
write. Settings therefore never reaches `itemRepo.createMany` for a rejected payload,
and blank CSV rows never enter the parsed item list at all. Real exports are unchanged:
a valid header-only CSV still parses to zero items, and JSON/CSV round-trips keep the
same imported/skipped/overwritten/duplicated counts (a blank-row count of zero for real
exports).

## Commands / results
```
npm run typecheck  # PASS (tsc --noEmit)
npm run lint       # PASS (eslint .)
npm run test       # PASS — 33 files, 360 tests
```
The baseline profile's `build` and Playwright junk-file import were not run; the three
required gates pass.

## Uncertainties / notes
- `csvToItems`'s return type changed from `Partial<Item>[]` to
  `{ items, skippedBlank }` so blank rows can be counted. The only production caller
  (Settings) and both test call sites were updated.
- A CSV with some recognized column but no `title` column is treated as recognized and
  its rows are skipped as blank-title rows, consistent with AC1's "resolved title"
  wording.
- No unrelated findings were added to `discovered-IMP-072.md`.
