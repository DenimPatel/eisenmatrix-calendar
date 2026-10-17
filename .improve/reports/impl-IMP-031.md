# impl-IMP-031 — fix CSV parsing of a mid-field quote

## Files changed
- `src/lib/csv.ts` (`parseCSV`)
- `src/lib/csv.test.ts`

## Approach
- The unquoted branch now opens a quoted field only when `field === ''`, i.e. at field
  start. A `"` encountered after any field content is appended literally.
- No other parser state or branch changed; quoted fields, doubled quotes, commas and
  CRLF/newline handling are untouched.
- Added a regression test: parses `abc"def,2` and `plain "quote",3` with exact rows, and
  asserts a `toCSV`/`parseCSV` round-trip of `abc"def` yields the original value.
- Import consumers were checked: `csvToItems` is the only in-repo caller of `parseCSV`
  (`src/features/settings/SettingsView.tsx` uses `csvToItems`). Valid RFC-4180 exports are
  unaffected because `toCSV` always quotes a field at its start, and the existing
  header/blank-row/round-trip tests still pass.

## Commands / results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (34 files, 386 tests; baseline 385)
