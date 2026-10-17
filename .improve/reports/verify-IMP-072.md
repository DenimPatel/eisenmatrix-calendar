# Verify — IMP-072: Refuse an unrecognized import file instead of reporting success

**Verifier:** independent; did not write the change
**Branch:** `improve/auto-20261017` (working tree, uncommitted; HEAD `d6f3590`)
**Date:** 2026-10-17
**VERDICT: PASS**

## Scope reviewed

`git diff` against HEAD for the four named source/test files plus orchestration metadata:

```
src/features/settings/SettingsView.tsx |  5 +++--
src/lib/backup.ts                      | 29 ++++++++++++++--------
src/lib/backup.test.ts                 | 12 +++++++++++
src/lib/csv.ts                         | 30 +++++++++++++++++++-----
src/lib/csv.test.ts                    | 27 +++++++++++++++++++++--
```

- `csvToItems` now returns `{ items, skippedBlank }`, throws on an empty parse or a header
  containing none of `CSV_COLUMNS`, and skips rows whose resolved `title` is empty.
- `parseBackup` rejects non-object/array roots and payloads carrying neither an `items`
  nor a `tasks` array; it otherwise keeps the existing identity, version, legacy `tasks`,
  and `lists` behavior unchanged.
- `SettingsView.importCSV` consumes the new shape and reports `skipped + skippedBlank`.
  `importJSON` is unchanged except that `parseBackup` can now throw before any write.
- No production caller other than `SettingsView` exists (`grep` over `src`).
- No debug output, `console.*`, `debugger`, TODO/FIXME, new dependency, comment, or
  unrelated production edit. `git diff --check` is clean. The only non-IMP-072 churn is
  the expected `.improve` metadata.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Reject a CSV header with none of the exported `CSV_COLUMNS`; skip and count empty-title rows, never persist them | **Met** | `csv.ts:137-145` validates the trimmed header against `CSV_COLUMNS` before row mapping; `:160-164` counts/drops a blank trimmed `title`. Unit tests cover `hello,world`, `junk`, empty text, and two blank-title rows (`csv.test.ts:57-82`). Independent test below proved a comma/newline junk file throws and leaves the row count unchanged. Browser: `Import failed: Not an EisenMatrix CSV (no recognized columns)`, count stayed 0. |
| 2 | `parseBackup` throws when neither `items` nor `tasks` exists; legacy `{version: 1, items: []}` still imports | **Met** | `backup.ts:50-64`; tests cover `{"hello":"world"}`, `{}`, `null`, and `{version:1, items: []}` (`backup.test.ts:34-47`). Independent test imported the empty legacy payload without a throw; browser rejected junk JSON with `Import failed: Not an EisenMatrix backup (no items or tasks array)`. |
| 3 | Failures use the existing `Import failed:` toast, show no success toast, and write no rows to Dexie | **Met** | Both parsers run before `mergeImportedItems`/`itemRepo.createMany` in `SettingsView.tsx:102-140`; the existing catch produces `Import failed: ${describeError(error)}`. Browser showed the error toast and no success toast for both junk files, with the Data count unchanged at 0. Independent test seeded one row, attempted a junk CSV import through the same parse→merge→repo sequence, and observed the throw plus an unchanged count/row set. |
| 4 | Real `exportJSON → importJSON` and `exportCSV → importCSV` keep the same counts | **Met** | Existing round-trip tests are green. Independent test exported two items (including a title with a comma and quote) through `buildBackup/backupToJSON` and `itemsToCSV`, re-imported each into an empty store, and got 2/2 items for both paths; the empty CSV export still yields 0 items and `skippedBlank: 0`. |

## Dexie-write ordering

Confirmed by inspection and execution: `csvToItems`/`parseBackup` are the first operations
after `readTextFile`. Any validation error aborts the `try` before `mergeImportedItems` and
before `itemRepo.createMany`/`listRepo.createMany`. The junk-file browser runs left the
Data count at 0. The independent test also seeded one item first, so "unchanged" was
distinguishable from an empty database.

## Gates

```
npm run typecheck   PASS  (tsc --noEmit, no diagnostics)
npm run lint        PASS  (eslint ., no output)
npm run test        PASS  33 files / 360 tests (355 baseline + 5 new)
npm run build       PASS  tsc + vite build; dist/sw.js generated, 18 precache entries (616.17 KiB)
```

## Independent execution

### Temporary Vitest probe (created, run, removed)

`src/lib/__verify_imp072.test.ts` (deleted afterward; `git status` is back to the intended
changes) mirrored the Settings import sequence against fake-indexeddb. Result: **5/5 passed**.

1. Junk CSV with commas, quotes and an embedded newline throws `/not an eisenmatrix csv/i`;
   DB count and the seeded title are unchanged.
2. Junk JSON `{"hello":"world"}` throws `/not an eisenmatrix backup/i`; count stays 1.
3. `{version:1, items: []}` imports zero items without throwing.
4. Blank-title rows (`''` and `'   '`) are dropped and counted as 2; only the valid row is
   persisted and no stored title is blank.
5. Two-item JSON and CSV exports round-trip to 2 items each; CSV `skippedBlank` is 0.

### Playwright preview (`npm run preview`, port 4173)

File pickers were reachable and driven through the real Settings buttons.

- **Stale-SW caveat observed first:** the initial preview was still controlled by an old
  service worker/bundle ("A new version is available"). Under that stale bundle, the junk
  CSV was still imported as 3 items — i.e. the exact old behavior. After
  `navigator.serviceWorker.getRegistrations()` unregister + deleting
  `workbox-precache-v2` and loading with a cache-busting query, the document loaded
  `assets/index-CKMAQt79.js` (the hash from this build). All results below are from that
  fresh bundle.
- Reset all data → Data panel `0 items`.
- Import `junk.csv` (`hello,world` header + quoted comma/newline rows) → toast
  `Import failed: Not an EisenMatrix CSV (no recognized columns)`; no `CSV imported`
  toast; Data panel still `0 items`.
- Import `junk.json` (`{"hello":"world"}`) → toast
  `Import failed: Not an EisenMatrix backup (no items or tasks array)`; no
  `Backup imported` toast; Data panel still `0 items`.
- Import a valid CSV with two blank-title rows and one valid row → dialog
  `Imported 1 items · skipped 2 · overwritten 0 · duplicated 0`, `CSV imported` toast, and
  Data panel `1 items`. This confirms Settings still reports successful counts and folds
  blank skips into `skipped`.
- Console: 0 errors / 0 warnings after the fresh load and all four imports.

## Non-blocking observations

- A junk one-line file whose only header happens to be an exported key (for example
  `id`) is accepted as recognized and reports a successful 0-item import. This matches
  AC1's literal "header row contains none of the exported keys" rule; it is not the
  reported wrong-file scenario and does not write rows.
- By design, a legitimate export containing an item with an empty title would now be
  skipped and counted rather than restored. AC1 explicitly requires this behavior;
  no current factory path is known to create such items.
- `lists` remains an unvalidated cast, as the item notes defer to IMP-038.

## Suggested health deltas

| Dimension | Current | Suggested | Rationale |
|---|---|---|---|
| Bugs/Correctness | 4 | 4 (hold) | Closes the wrong-file/blank-row import defect and proves no pre-validation write; remaining import work (`lists` validation) is IMP-038. |
| Tests/Tooling | 4 | 4 (hold) | +5 focused regression tests, all four gates green; no browser test is committed for the Settings toast path. |
| UX/Interaction | 3 | 3 (hold) | Failure and success messaging now match reality; the stale-SW "new version available" reload prompt remains a deployment-level UX caveat. |

## Files produced

- `.improve/reports/verify-IMP-072.md` (this file)
