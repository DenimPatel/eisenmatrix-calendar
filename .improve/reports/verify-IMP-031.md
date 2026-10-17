# verify-IMP-031 — quote only opens a CSV field at field start

**Reviewer:** independent verifier (did not write the change)
**Date:** 2026-10-17
**Item:** `.improve/FEATURES.md` → `### IMP-031` (`:796-808`)
**Impl report:** `.improve/reports/impl-IMP-031.md`
**Conventions:** `.improve/REPO_PROFILE.md`, `AGENTS.md`
**Branch:** `improve/auto-20261017` (change uncommitted; HEAD `aeea3e3`)

## VERDICT: PASS

All three acceptance criteria are met. The fix is a one-condition change that is
standards-correct, the new test fails against the pre-fix parser, and the existing
RFC-4180 round-trip and CSV-import tests still pass. One non-blocking behavior change
for whitespace-prefixed quotes is documented in §4, and unrelated `.improve`
bookkeeping is present in the working tree (§1).

---

## 1. Scope of the diff

```
 .improve/CHANGELOG.md  | 1 +
 .improve/FEATURES.md   | 2 +-
 .improve/PROGRESS.log  | 1 +
 src/lib/csv.test.ts    | 8 ++++++++
 src/lib/csv.ts         | 2 +-
```

| File | Verdict |
|---|---|
| `src/lib/csv.ts` | In scope: one line, `parseCSV` unquoted branch (`:54`). No other parser branch, consumer, or export changed. |
| `src/lib/csv.test.ts` | In scope: one additive `it(...)` (`:23-29`). No existing test altered. |
| `.improve/FEATURES.md` | Bookkeeping: IMP-031 status `TODO → IN-PROGRESS` only. |
| `.improve/CHANGELOG.md`, `.improve/PROGRESS.log` | Pre-existing bookkeeping for IMP-027 (commit `aeea3e3`), unrelated to IMP-031. Left uncommitted by the previous item; harmless, but should not be attributed to IMP-031. |
| `.improve/reports/impl-IMP-031.md` | New untracked implementation report. |

No changes to `package.json`, lockfile, Dexie/repository, features, styles, or generated
output. `git diff --check` clean; no `console.*`, `debugger`, `TODO`, or `FIXME` in the
changed source; no new comments. `npx prettier --check src/lib/csv.ts src/lib/csv.test.ts`
passes.

Note: `FEATURES.md` still says `IN-PROGRESS`. That is coordinator state, not an
acceptance criterion; it should be set to `DONE` when the item is accepted.

---

## 2. Acceptance criteria

### AC1 — a quote only opens a quoted field when the current field is empty — **MET**

`src/lib/csv.ts:54`:

```ts
if (char === '"' && field === '') {
```

`field` is only reset to `''` by `pushField()`/`pushRecord()` on a delimiter or real
newline, so this is exactly "quote at field start". Quoted fields after a comma still
open because the comma handler cleared `field` first.

### AC2 — embedded/mid-field quotes are preserved literally — **MET**

The fall-through at `csv.ts:73` appends the quote character to `field`, so:

| Input | New parser output | Old parser output |
|---|---|---|
| `abc"def,2` | `[["abc\"def","2"]]` | `[["abcdef,2"]]` (quote consumed the rest of the file) |
| `plain "quote",3` | `[["plain \"quote\"","3"]]` | `[["plain quote","3"]]` |
| `abc"` | `[["abc\""]]` | `[["abc"]]` |

Exact new-test input `abc"def,2\r\nplain "quote",3` returns
`[["abc\"def","2"],["plain \"quote\"","3"]]`; the pre-fix module returned one mangled
record `[["abcdef,2\r\nplain quote,3"]]`. The regression test therefore fails without
the fix (non-vacuous).

### AC3 — RFC-4180 round-trip tests still pass — **MET**

Existing cases `parses multi-line quoted fields…`, `escapes quotes and commas`, the
item/JSON round-trip, empty/blank-row, and rejection tests are unchanged and pass.
Differential probe against `HEAD:src/lib/csv.ts` on the RFC-relevant inputs produced
identical results for:

- empty quoted field: `a,"",b` → `[["a","","b"]]`
- doubled quote: `a,"a""b",c` → `[["a","a\"b","c"]]`
- comma inside quotes: `"x,y","say ""hi"""` → `[["x,y","say \"hi\""]]`
- quoted newline/CRLF: `"x\r\ny"` and `"line one\nline two"` unchanged
- unterminated quoted field: `a,"unterminated` → `[["a","unterminated"]]` unchanged

`csvToItems` is unchanged; `parseCSV`'s only product caller is `csvToItems`
(`src/lib/csv.ts:130`), reached from `SettingsView.tsx:128`. Blank-row filtering,
header trimming, and column recognition are untouched, so CSV import behavior only
changes for inputs that were previously mis-parsed.

Observation (non-blocking): the new test's second assertion,
`parseCSV(toCSV([{ name: 'abc"def' }]))`, also passes on the old parser because `toCSV`
always quotes at field start. It is a valid round-trip check but is not itself a
regression guard; the first assertion is what makes the test non-vacuous.

---

## 3. Import regression analysis

- `toCSV` wraps any field containing `"`, `,`, `\r`, or `\n` at the field start, so every
  app-generated export still round-trips.
- `csvToItems` applies `String(title).trim()` only to test for blank titles; it does not
  strip quotes, so foreign CSVs with literal mid-field quotes now import with those
  characters preserved instead of silently deleted.
- The change only narrows when `inQuotes` can become true; every path that previously
  parsed valid RFC-4180 output is behavior-identical (verified by differential probe).

---

## 4. Edge cases and residual caveats

Probed with the pre-fix module (`git show HEAD:src/lib/csv.ts`) and the working tree:

| Case | Result | Assessment |
|---|---|---|
| Empty quoted field `a,"",b` | `["a","","b"]` | Correct, unchanged. |
| Doubled quotes `"a""b"`, `""""` | `a"b`, `"` | Correct, unchanged. |
| Quote after delimiter + whitespace: `a, "b",c` | New: `["a"," \"b\"","c"]`; old: `["a"," b","c"]` | **Behavior change.** RFC-4180 treats the space as field content, so a later quote is not a delimiter; new output is standards-correct per AC1/AC2. Only affects malformed/whitespace-prefixed CSV, not app exports. Non-blocking; worth knowing for hand-edited imports. |
| `abc"def` | `abc"def` | Correct. |
| Trailing quote `abc"` | `abc"` | Correct. |
| `"abc"def` (invalid CSV) | `abcdef` (unchanged) | Pre-existing lenient handling, out of scope. |
| Unterminated quote at EOF | content preserved (unchanged) | Pre-existing, out of scope. |

No new failure modes were found.

---

## 5. Gates

Run from the repo root on the working tree:

```
npm run typecheck  -> PASS (tsc --noEmit, no diagnostics)
npm run lint       -> PASS (eslint ., no output)
npm run test       -> PASS, 34 files / 386 tests
npm run build      -> PASS (tsc --noEmit && vite build; dist/sw.js generated, 18 precache entries)
```

386 = 385 baseline (after IMP-025/027) + 1 added test, matching the implementation
report. Build output is gitignored (`dist/`).

---

## 6. Health deltas (suggested)

| Dimension | Delta | Why |
|---|---|---|
| Bugs/Correctness | **+1** | Removes a real data-import corruption where one mid-field quote swallowed the rest of the file into a single record; regression-guarded. |
| Tests/Tooling | 0 | One focused test; existing round-trip coverage was already adequate. |
| Maintainability | 0 | Minimal, readable condition; no comment needed. |
| Risk | low | Narrow parser change; only malformed/whitespace-prefixed CSV parses differently. |

No follow-up item is required for IMP-031. Optional cleanup: avoid mixing the IMP-027
CHANGELOG/PROGRESS lines into an IMP-031 commit, and flip the IMP-031 status to `DONE`
on acceptance.
