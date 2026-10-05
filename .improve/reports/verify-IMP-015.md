# Verification report — IMP-015 (CSV import error handling) — RE-VERIFICATION, retry 2

**Reviewer verdict: PASS** — all three acceptance criteria are met, all three issues from the
prior FAIL report are genuinely fixed (not cosmetically), and the full four-gate chain is
green and **deterministic across 9 consecutive full-suite runs**. No blockers.

> **Note on the prior report.** `.improve/reports/impl-IMP-015.md` is stale (written mid-work,
> never updated). The working tree has moved *beyond* what that report and the prior FAIL
> report describe: a shared `describeError` helper was added and `pickFile` was moved **inside**
> the `try` in **both** handlers. This report judges the tree as it stands, not the narratives.

- Backlog item: `.improve/FEATURES.md` → `### IMP-015`
- Prior verdict: `.improve/reports/verify-IMP-015.md` (superseded by this file)
- Conventions: `.improve/REPO_PROFILE.md`, `AGENTS.md`
- Branch `improve/auto-20261003`, HEAD `8da083f`, change is **uncommitted working-tree** state.
- Reviewer made **no** source edits. Three temporary mutations and one `git stash` experiment
  were applied and reverted; restoration verified byte-for-byte by `shasum`
  (`SettingsView.tsx` = `099ed900b2d228694601b2c1d5e7063d46d21465`,
  `SettingsView.test.tsx` = `6b182f85f2ee7406c978725c7f26e899e2c2b60a`).

---

## 1. Change surface

| Path | Kind | Verdict |
| --- | --- | --- |
| `src/features/settings/SettingsView.tsx` | `+30 / −12` — one `try` in `importCSV`, `describeError` helper, `pickFile` moved into both `try`s | in scope, correct |
| `src/features/settings/SettingsView.test.tsx` | new, 207 lines, **10 tests** | in scope, deterministic |
| `.improve/PROGRESS.log` | `+1` line, but for **IMP-014** (previous item) | unrelated bookkeeping nit (advisory 2) |
| `.improve/reports/{impl,discovered}-IMP-015.md` | new reports | expected |
| `.kilo/` | untracked, not authored by this item | out of scope, ignore |

`git diff --stat` → `2 files changed, 31 insertions(+), 12 deletions(-)`. **No scope creep in
`src/`**: no refactor of `mergeImportedItems`/`csvToItems`, no dependency/lockfile/config
change, no `dist/` edit, no new public export (`describeError` is module-private).

**No secrets**: no `.env*` touched; the only string literals are `'could not read file'`,
`'database is full'`, `'picker exploded'`, `'boom'`, `'Unknown error'`. A
secret-shaped scan (`api[_-]?key|secret|token|password|bearer|AKIA`) returns nothing.

**No debug leftovers**: scan for `console.*`, `debugger`, `.only(`, `.skip(`, `TODO`, `FIXME`
returns nothing in either file.

**No architecture violations**: no direct Dexie outside `src/db/`, no `localStorage`, no
hardcoded colours (`slate-|white|text-[#` → none), no new dependencies.

**Convention compliance**: the module-level non-exported `describeError` helper matches
existing precedent (`isBillUnpaid` in `TodayView.tsx:18`, `baseRule` in
`RecurrenceEditor.tsx:15`). The 5 comment blocks in the test file all explain non-obvious
intent (act-environment requirement, why `*Throws` is a separate flag, what `drain()` flushes
and why, why the drain precedes `restoreAllMocks`), which `AGENTS.md` permits. The
`// @vitest-environment jsdom` header, `createRoot`+`act` mount/unmount, `@/` alias, and
`db.delete()` in `afterAll` all match sibling test files.

---

## 2. Acceptance criteria

| AC | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| **AC1** | `importCSV` wraps parse + persist in `try/catch` and pushes an error toast on failure, mirroring `importJSON` | **met** | `SettingsView.tsx:125` `try`, `:126-127` pick, `:128` parse, `:129-133` merge, `:134` persist, `:139` `catch` → `:140` `pushToast({ message: \`Import failed: ${describeError(error)}\`, tone: 'error' })`. The catch is **byte-identical** to `importJSON:119-121`; both handlers now have the same shape (`pickFile` inside the `try`, `if (!file) return` inside the `try`). |
| **AC2** | On failure no success toast appears | **met** | Both the success toast (`:138`, last statement in the `try`) and `setImportReport` (`:135-137`) sit **inside** the `try`, so any throw in `pickFile`/`readTextFile`/`csvToItems`/`normalizeItem`/`mergeImportedItems`/`createMany` skips both. Tests assert exact equality — `expect(messages()).toEqual(['Import failed: …'])` — not mere absence, plus `tones()` is exactly `['error']` and `host.textContent` does not contain `'Import complete'`. |
| **AC3** | On success the existing report/toast still appears | **met** | Byte-identical to HEAD: success toast `'CSV imported'` / `'Backup imported'` with `tone: 'success'` (`:118`, `:138`) and the count template `` `Imported ${toPut.length} items · skipped ${skipped} · overwritten ${overwritten} · duplicated ${duplicated}` `` (`:116`, `:136`) — the diff shows these lines only re-indented, never re-worded (verified by grepping both revisions, §6). |

---

## 3. The three prior-FAIL issues — all fixed

### 3.1 (a) Test file was flaky under full-suite parallelism → **FIXED**

The prior report's blocker: `clickImportCSV` awaited a single `setTimeout(resolve, 0)`, and the
dismiss-picker test inherited a leaked promise from the previous test
(`expected [ 'CSV imported' ] to deeply equal []`).

Three independent structural fixes are present:

1. **`globalThis.IS_REACT_ACT_ENVIRONMENT = true`** (`:14`), with the `declare global` block
   (`:10-12`) — byte-identical to the pattern in `ItemEditorSheet.test.tsx:11-14`,
   `QuickAdd.test.tsx:10-13`, `CommandPalette.test.tsx:11-14`, `useFocusTrap.test.tsx:9-12`.
   This also removed the 13 stderr `not configured to support act(...)` lines the prior report
   flagged; zero such lines appear in any run below.
2. **A `drain(turns = 12)` helper** (`:72-78`) that flushes real macrotasks *inside* `act`, so
   FileReader callbacks, the Dexie write and the React commit all complete before the caller
   continues — replacing the single-macrotask assumption.
3. **Direct fix for the cross-test leak**: `afterEach` (`:111-115`) now calls `await drain()`
   **before** `vi.restoreAllMocks()`, with the comment "Drain before restoring mocks so no
   import started by this test can land in the next one." `beforeEach` (`:100-109`) resets every
   `picked.*` flag **and** `toasts`/`undoStack`. Assertions use `vi.waitFor` rather than a
   single timed read.

**Proof of determinism — 9 full-suite runs, all green:**

| Invocation | Result |
| --- | --- |
| `npm run test` inside the four-gate chain | 23/23 files, **170/170** tests |
| `npm run test` standalone #1–#4 | 23/23 files, **170/170** each (4/4) |
| `npx vitest run --sequence.shuffle --sequence.seed=137/274/411` | 23/23 files, **170/170** each (3/3) |
| `npx vitest run src/features/settings/SettingsView.test.tsx` ×2 | 10/10 each |
| final `npm run test` after all mutation/stash experiments | 23/23 files, **170/170**, exit 0 |

Order-independence is proven by the three `--sequence.shuffle` seeds (each shuffles file
execution order); isolation is proven by the two single-file runs. No run produced an act
warning, an unhandled rejection, or a stderr line. Test count moved 164 → 170 exactly as
expected for the 10-test file (baseline 160 + 10).

### 3.2 (b) `catch` threw a `TypeError` on a `null`/`undefined` rejection → **FIXED**

The prior report demonstrated `TypeError: Cannot read properties of null (reading 'message')`
escaping the catch block, so the user got **no toast at all**. Now a module-level
`describeError(error: unknown): string` (`SettingsView.tsx:41-49`) handles every shape:

```ts
if (error instanceof Error && error.message) return error.message;
if (typeof error === 'string' && error) return error;
if (error && typeof error === 'object') { /* non-empty string .message */ }
return 'Unknown error';
```

`SettingsView.test.tsx:178-195` covers it with `it.each` over five values: `null`, `undefined`,
a bare string `'boom'`, `{ code: 500 }`, and `new RangeError('')` (empty-message `Error`
subclass) — all assert an error toast is produced, never a throw. Both handlers use the shared
helper, so `importJSON` is hardened too (it had the identical latent `TypeError`).

### 3.3 (c) File-picking failures were outside the `try` → **FIXED**

`pickFile` is now inside the `try` in **both** handlers (`importJSON:104-105`,
`importCSV:126-127`), and `SettingsView.test.tsx:164-176` drives
`picked.pickThrows = true; picked.pickError = new Error('picker exploded')` through the real
click path, asserting `'Import failed: picker exploded'` with `tone === 'error'`. Every
failure path now toasts: picker throw, picker cancel (silent, correctly — `:197-206`), file
read, parse, and persist.

### 3.4 Mutation testing — the tests carry real regression value

Each fix was reverted in isolation and the suite re-run:

| Mutation | Result |
| --- | --- |
| **A** — `describeError(error)` → `(error as Error).message` in both handlers | **5 failed** / 5 passed; failures are exactly the `it.each` non-`Error` cases, with `TypeError: Cannot read properties of null (reading 'message')` and `…of undefined…` in the output |
| **B** — `git checkout HEAD -- SettingsView.tsx` (no `try`/`catch` in `importCSV`) | **8 failed** / 2 passed + 6 `Unhandled Rejection` entries, reproducing the exact defect in IMP-015's intent paragraph |
| **C** — `pickFile` moved back outside the `try` | **1 failed** (`shows an error toast when the file picker rejects`) + 1 `Unhandled Rejection` |

All three mutations were reverted and the shasums in §1 confirm byte-identical restoration.

---

## 4. Gates — `npm run typecheck && npm run lint && npm run test && npm run build`

Run as a single `&&` chain, 500 s budget. **All four green, chain exit 0.**

```
> tsc --noEmit   → exit 0, no diagnostics
> eslint .       → exit 0, no output
> vitest run     → Test Files 23 passed (23) | Tests 170 passed (170) | Duration 10.03s
> vite build     → dist/assets/index-CKCfMzKH.js 360.93 kB │ gzip 107.45 kB
                   dist/sw.mjs 16.80 kB, precache 18 entries (603.93 KiB)
=== CHAIN EXIT: 0 ===
```

---

## 5. Regression check — success path

The success path is untouched and covered end-to-end by
`SettingsView.test.tsx:122-134`, which uses the **real** `csvToItems`/`mergeImportedItems`/
`itemRepo.createMany` (only `pickFile`/`readTextFile` are mocked) against a CRLF CSV
`id,kind,title,status` + 1 row (`:43`). It asserts all of:

- success toast `'CSV imported'` present, and `tones().every(t => t !== 'error')` — **no** error
  toast leaks onto the happy path;
- the persisted row count is `1` and its `title` is `'Imported task'` — **a valid CSV still
  imports**;
- the report dialog renders `'Import complete'`, i.e. `setImportReport` with the counts string.

Count reporting is further confirmed at the source level (§6): the `Imported N items · skipped
… · overwritten … · duplicated …` template and both success-toast literals are byte-identical
to `HEAD`.

---

## 6. Scope / string-identity evidence

```
$ git show HEAD:src/features/settings/SettingsView.tsx | grep -n "Imported \${toPut.length}"
106:        `Imported ${toPut.length} items · skipped ${skipped} · overwritten ${overwritten} · duplicated ${duplicated}`,
$ grep -n "Imported \${toPut.length}" src/features/settings/SettingsView.tsx
116:        `Imported ${toPut.length} items · skipped ${skipped} · overwritten ${overwritten} · duplicated ${duplicated}`,
$ git show HEAD:…| grep -nE "'CSV imported'|'Backup imported'"
108:      pushToast({ message: 'Backup imported', tone: 'success' });
123:    pushToast({ message: 'CSV imported', tone: 'success' });
$ grep -nE "'CSV imported'|'Backup imported'" src/features/settings/SettingsView.tsx
118:      pushToast({ message: 'Backup imported', tone: 'success' });
138:      pushToast({ message: 'CSV imported', tone: 'success' });
```

Identical modulo line shift. The only behavioural edits are: `try` added to `importCSV`,
`pickFile` relocated inside both `try`s, and the message formatter extracted.

---

## 7. Pre-existing flake (NOT an IMP-015 defect)

`src/test/app.smoke.test.tsx` has been reported to intermittently log an unhandled
`storage.getItem` rejection originating at `src/db/migrations/legacyTasks.ts:219`
(`const raw = storage.getItem(LEGACY_STORAGE_KEY);`). **Attribution: pre-existing, unrelated.**

- `git diff HEAD -- src/test/app.smoke.test.tsx src/db/migrations/legacyTasks.ts` → **empty**;
  neither file is touched by this branch.
- `git log -1 -- src/test/app.smoke.test.tsx src/db/migrations/legacyTasks.ts` → `ce2fecf
  feat: rebuild as a local-first personal operating system`, i.e. untouched since the base
  commit — this change did not introduce and cannot have caused it.
- It did **not reproduce** across the 9 full-suite runs or the 3 shuffle-seed runs here: every
  run reported zero `Unhandled` entries.

Filed separately as a pre-existing flake; **not** counted against IMP-015.

---

## 8. Advisories (non-blocking)

1. **Missing trailing newline** at EOF in `src/features/settings/SettingsView.test.tsx`
   (`\ No newline at end of file`). It is the *only* difference `prettier --check` reports for
   the file. Not gated (`eslint .` passes because `eslint-config-prettier` disables formatting
   rules), and the repo baseline is already unclean — `npx prettier --check "src/**/*.{ts,tsx}"`
   also flags `src/db/repository.test.ts`, `src/domain/itemActions.test.ts` and
   `src/pwa/ReminderRuntime.tsx`. One-byte fix (`printf '\n' >>`), worth doing for tidiness.
2. **Bookkeeping**: `.improve/PROGRESS.log` gained an **IMP-014** line in this working tree but
   no IMP-015 line, and `FEATURES.md` still reads `Status: TODO` for IMP-015. Consistent with the
   stale impl report's intent; resolve at commit time (the commit SHA cannot be known before
   committing).
3. **`describeError` placement**: acceptable as a module-private helper in `SettingsView.tsx`
   given precedent, but if a third call site appears it should move to `src/lib/` (e.g.
   alongside `backup.ts`) rather than be copy-pasted.
4. **Backlog text for IMP-015 remains inaccurate** (carried over, unchanged by this diff):
   its *Verification method* — "import a malformed `.csv` (binary/empty) and assert an error
   toast appears" — is unreachable, because `csvToItems`/`parseCSV` are total and never throw,
   so an empty file reports success and a binary file silently imports untitled blank items.
   Not a regression (behaviour identical at HEAD); the correct evidence for AC1 is the
   `readTextFile`/persist/picker failure paths exercised here. Recommend (a) correcting
   IMP-015's Verification method, and (b) a separate backlog item for CSV header/empty-title
   validation.

**Blockers: none.**

---

## 9. Recommendation

**Accept.** Land the change. IMP-015's AC1–AC3 are met, the prior FAIL report's three issues are
verified fixed by structural inspection *and* mutation testing, the four gates pass with chain
exit 0, and the suite is deterministic over 9 full-suite runs including 3 shuffled orderings.
Optional cleanups before commit: add the trailing newline (advisory 1) and add the IMP-015
`PROGRESS.log` line / flip `FEATURES.md` to `DONE` (advisory 2). When marking `DONE`, amend the
item's Verification method per advisory 4.