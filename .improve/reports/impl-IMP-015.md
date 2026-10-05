# IMP-015 — Implementation report

**Status:** implemented (all four gates pass; not marked DONE in FEATURES.md)

## Change

| File | Change |
| --- | --- |
| `src/features/settings/SettingsView.tsx` | `importCSV` (`:114-129`) now wraps parse + merge + persist + report/toast in `try`/`catch`, with the failure branch identical to `importJSON`'s: `pushToast({ message: \`Import failed: ${(error as Error).message}\`, tone: 'error' })`. `pickFile` and the `if (!file) return` early-out stay outside the `try`, matching `importJSON`. The success toast, tone, copy and `setImportReport` string are unchanged. |
| `src/features/settings/SettingsView.test.tsx` | **New** (this feature had no test file). 4 jsdom + fake-indexeddb tests mounting `SettingsView` via `createRoot`/`act`, matching `src/features/notes/NotesView.test.tsx` conventions. |

No other source file was touched. Net diff in `SettingsView.tsx` is one `try`, one `catch`, and
indentation — no new helper, no behavioural change on the success path.

## Acceptance criteria

1. **`importCSV` wraps parse + persist in try/catch and pushes an error toast, mirroring
   `importJSON`** — `src/features/settings/SettingsView.tsx:114-129`. Same toast API
   (`pushToast` from `useUiStore`), same `tone: 'error'`, same `` `Import failed: ${…}` `` copy
   shape, same catch placement relative to `pickFile`.
2. **On failure no success toast appears** — `pushToast({ message: 'CSV imported', … })` is now
   the last statement *inside* the `try`, so a throw in `readTextFile`/`csvToItems`/
   `mergeImportedItems`/`createMany` skips it. Covered by two tests that assert `messages()`
   **equals exactly** the single error message (not `contains`), plus `host.textContent` not
   containing `Import complete`.
3. **On success the existing report/toast still appears** — verbatim, and asserted: toast
   `CSV imported`, dialog `Import complete`, item persisted with the right title, no `error`-tone
   toast anywhere.

## Tests added — `src/features/settings/SettingsView.test.tsx`

`vi.mock('@/lib/backup', importOriginal)` overrides only `pickFile` (returns a preset `File`)
and `readTextFile` (optionally rejects); every other export stays real. `itemRepo.createMany` is
stubbed with `vi.spyOn` for the persist-failure case.

| Test | Asserts |
| --- | --- |
| reports the import and shows the summary on success | toast `CSV imported`, no `error` tone, 1 item `Imported task` in Dexie, `Import complete` dialog visible |
| shows an error toast and no success toast when the file cannot be read | `messages()` **equals** `['Import failed: could not read file']`, tone `error`, no dialog, 0 items |
| shows an error toast and no success toast when persisting fails | `messages()` **equals** `['Import failed: database is full']` after a `createMany` rejection, no dialog |
| does not toast when the file picker is dismissed | `messages()` **equals** `[]` |

**Regression value confirmed:** with the `try`/`catch` reverted (`git stash` of only
`SettingsView.tsx`), 3 of the 4 tests fail and Vitest additionally reports an unhandled
rejection — i.e. the new tests reproduce exactly the bug described in the intent paragraph. The
file was restored and byte-compared afterwards.

## Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run test` **23 files / 164 tests
passed** (was 22 files / 160) · `npm run build` OK (`dist/sw.js` emitted, 18 precache entries,
603.73 KiB).

## Browser verification (Playwright, `npm run preview` on :4173)

Note: the first load ran a **stale** bundle — the previously-installed service worker plus an
HTTP-cached `index.html` kept serving the pre-change JS. Unregistered the SW, cleared
`workbox-precache-v2-…`, and loaded `index.html?cb=imp015#/settings`; the served bundle then
contained `CSV imported` and **two** `Import failed: ${…}` sites (JSON + CSV). Re-verified
against the built artifact: `dist/assets/index-DGKwQ1Z_.js` has both strings.

- **Failure path:** replaced `window.FileReader` with a stub whose `readAsText` fires `onerror`
  with `reader.error = new Error('simulated read failure')`, then Settings → **Import CSV** →
  supplied an empty `.csv`. Result: error toast **`Import failed: simulated read failure`**,
  item count unchanged at `0 items`, no *Import complete* dialog, and **no console
  errors/warnings** (previously an unhandled rejection).
- **Success path:** fresh page, imported `id,kind,title\r\ncsv-1,task,From browser\r\n`. Result:
  toast **`CSV imported`**, dialog *Import complete* reading `Imported 1 items · skipped 0 ·
  overwritten 0 · duplicated 0`, header count `0 items` → `1 items`, no console errors.
- Test data removed afterwards via Settings → **Reset all data** → **Delete everything**
  (back to `0 items`).

## Out of scope

Four findings written to `.improve/reports/discovered-IMP-015.md`. The most relevant: the
backlog's own verification recipe ("import a malformed `.csv` (binary/empty) and assert an error
toast") **cannot** reach this code path, because `csvToItems` is total and never throws — empty
and binary input still yields the success toast. Real rejection sources are `readTextFile` and
Dexie, which is what the unit and browser checks exercised.