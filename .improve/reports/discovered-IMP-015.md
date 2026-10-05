# Discovered findings — IMP-015

Out-of-scope observations from implementing `### IMP-015` (CSV import error handling in
`src/features/settings/SettingsView.tsx`). **Not fixed**; none are regressions from IMP-015.

## 1. The spec's verification method cannot trigger the new error path

IMP-015's *Verification method* says "import a malformed `.csv` (binary/empty) and assert an
error toast appears". That is not reachable: `csvToItems` (`src/lib/csv.ts:124`) is **total** and
never throws. Confirmed by a throwaway probe against `''`, `'\0\x01ÿþ binary'` and `'PK\x03\x04garbage'`
— all return `[]` with no exception (`records.length < 2` → early `return []`, `:126`). `parseCSV`
cannot throw either; it is a character loop.

So an empty or binary `.csv` today reports **success**: toast `CSV imported`, dialog
`Imported 0 items · skipped 0 · overwritten 0 · duplicated 0`. The only real rejection sources
are `readTextFile` (the `FileReader.onerror` branch, `src/lib/backup.ts:111`) and
`itemRepo.createMany` (Dexie rejection). Both are now covered by the new
`src/features/settings/SettingsView.test.tsx`; the browser check reached the `readTextFile`
branch by stubbing `window.FileReader` before clicking **Import CSV**.

## 2. A garbage CSV silently imports blank items

Worse than reporting 0 items: junk that happens to contain commas and/or newlines parses into
`records.length >= 2`, so the first junk line becomes the *header* and every following line
becomes an item with `get('title') === ''`. `normalizeItem` accepts it and the user gets
`Imported 7 items` of untitled blanks, with no warning. A guard in `csvToItems` or `importCSV`
("the header must contain at least `title`", or "skip rows with an empty title") would turn both
this and finding 1 into an honest error.

## 3. `pickFile` sits outside the `try` in both import handlers

`importJSON` (`:93`) and `importCSV` (`:115`) both `await pickFile(...)` **before** entering the
`try`. `pickFile` currently only ever resolves (`src/lib/backup.ts:116-124`), so this is
latent rather than live — but the new `catch` gives false confidence: it reads as "import is
fully guarded" while a future rejection from the picker would still escape as an unhandled
rejection. Moving the `pickFile` line inside the `try` would cost nothing.

## 4. `(error as Error).message` prints `undefined` for non-`Error` throws

Both handlers format the failure as `` `Import failed: ${(error as Error).message}` ``. A
rejection carrying a plain string or a bare object yields the literal toast
`Import failed: undefined`. `String(error)` or a `error instanceof Error ? error.message :
String(error)` fallback would be safer. Kept verbatim here to mirror `importJSON` exactly, as
IMP-015 AC1 requires.