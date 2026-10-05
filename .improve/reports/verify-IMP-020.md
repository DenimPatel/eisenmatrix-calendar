# IMP-020 — Verification report

**Verifier:** independent reviewer (did not author the change)
**Date:** 2026-10-05
**Target:** `src/lib/backup.ts` (+20/−3), `src/lib/backup.test.ts` (+33),
`.improve/PROGRESS.log` (+1, unrelated), `.improve/reports/{impl,discovered}-IMP-020.md` (new)
**Verdict:** **PASS**

---

## 1. Scope of the diff

```
$ git status --short
 M .improve/PROGRESS.log
 M src/lib/backup.test.ts
 M src/lib/backup.ts
?? .improve/reports/discovered-IMP-020.md
?? .improve/reports/impl-IMP-020.md
?? .kilo/

$ git diff --stat
 .improve/PROGRESS.log  |  1 +
 src/lib/backup.test.ts | 33 +++++++++++++++++++++++++++++++++
 src/lib/backup.ts      | 23 ++++++++++++++++++++---
 3 files changed, 54 insertions(+), 3 deletions(-)
```

Scope is clean. Only `src/lib/backup.ts` (the file named in the item) and its test were
touched; `SettingsView.tsx` is genuinely unchanged and did not need to be (`grep -n` shows
`parseBackup` still called once, at `:107`).

**Unrelated change (cosmetic, not blocking):** the single added `PROGRESS.log` line is the
**IMP-019** row (`2026-10-05T05:34Z | IMP-019 | done | 8432896`), not IMP-020. No IMP-020
row was added — consistent with the item not being committed/marked DONE yet
(`FEATURES.md` `### IMP-020` still reads `**Status:** TODO`).

**Hygiene:** no `console.*`, `debugger`, `.only`, `.skip`, TODO/FIXME, secret, or hardcoded
host in the added lines:

```
$ git diff -U0 -- src/ | grep -nE "^\+.*(console\.|debugger|TODO|FIXME|XXX|api[_-]?key|secret|token|localhost|\.only\(|\.skip\()"
none found
```

## 2. Acceptance criteria, one by one

| # | Criterion (`.improve/FEATURES.md:418-424`) | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `app` present but ≠ `'eisenmatrix'` throws a clear error | **met** | `src/lib/backup.ts:46-48`; test `backup.test.ts:35-38` |
| 2 | Too-new `version` rejected (or warned), not silently accepted | **met** | `src/lib/backup.ts:49-54`; test `backup.test.ts:40-43` |
| 3 | Dead `!Array.isArray(items)` branch removed | **met** | removed at old `:43`; string gone repo-wide (§3) |
| 4 | Existing `backup.test.ts` round-trip still passes | **met** | `backup.test.ts:18-26` untouched & green; full suite 236/236 (§5) |

Verification method from the item ("extend `backup.test.ts` asserting throws for
`{app:'other'}` and a too-new version, and success for a valid payload") was followed —
all three cases exist.

**Criterion 1** — `src/lib/backup.ts:46-48`:

```ts
if (parsed.app !== undefined && parsed.app !== 'eisenmatrix') {
  throw new Error(`Not an EisenMatrix backup (found app "${String(parsed.app)}")`);
}
```

The offending value is echoed back, so the user can tell *which* file they picked. The
`app !== undefined` form (rather than truthiness) is the correct choice and is safe:
`git log -p -S "app: 'eisenmatrix'" -- src/lib/backup.ts` shows the literal has only ever
been introduced once, in `ce2fecf` ("feat: rebuild as a local-first personal operating
system"), with a single value. No payload this project has ever produced can carry a
foreign `app`, and no payload it has ever produced *lacks* `app`.

**Criterion 2** — reject (not warn) was chosen, the stricter of the two options the AC
allows, which is right for a possibly-differently-shaped payload:

```ts
const version = typeof parsed.version === 'number' ? parsed.version : 1;
if (version > BACKUP_VERSION) {
  throw new Error(`Backup is format v${version}, but this app only imports up to v${BACKUP_VERSION}`);
}
```

## 3. Backward compatibility (the main risk) — all pass

I wrote a throwaway probe (`src/lib/zz-imp020-probe.test.ts`, 10 cases, **since deleted** —
`rm` confirmed, `git status` back to the original three-file diff) that exercised the
matrix against the *real* `parseBackup`. All 10 passed:

```
$ npx vitest run src/lib/zz-imp020-probe.test.ts
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

| Required property | Probe | Result |
| --- | --- | --- |
| `app:'eisenmatrix'` + **older** `version:1` still imports | P1 | `version===1`, 1 item |
| **No `app` field** still imports (legacy v1) | P2, P4 | items returned, `version===1` |
| Legacy **`tasks` array** form still imports | P3 | `id 'x'` |
| Only a **present-but-foreign** `app` rejected | P5 | `other`, `EisenMatrix`, `'eisenmatrix '`(trailing space), `42`, `true`, `{a:1}`, `null` → all throw |
| Only a **too-new** `version` rejected | P6 | `3,4,99,2.5` throw; `1,2,0,-1` accepted; `'3'`/`null` degrade to `1` |
| **Non-array `items`** handled safely | P7 | `items:'nope'`, `null`, `42`, `{0:'a'}` → `[]`, no throw |
| **Real round-trip** (export → import) | P9 | deep-equal `items` + `lists` |
| **Rejection precedes any Dexie write** | P10 + source | see below |

**P9 (real round-trip)** used `buildBackup` → `backupToJSON` → `parseBackup` from this
build with a parent/child pair (IMP-051 `parentId` case), a `daily` habit carrying a
reminder, a bill with `dueAt`, and a list row. `expect(parsed.items).toEqual(items)` and
`expect(parsed.lists).toEqual(lists)` both passed, plus `reminders` length and
`exportedAt` preserved. A backup exported by this version cannot fail to re-import: the
emitted `app` is exactly the accepted literal and `version` is exactly `BACKUP_VERSION`.

**No partial import.** `parseBackup` imports only `./id` and `@/types` (grep of the import
block) — no `dexie`, no `db/`, so the function cannot write. And the caller orders it
first (`src/features/settings/SettingsView.tsx`):

```
 5:      const parsed = parseBackup(await readTextFile(file));
12:      await itemRepo.createMany(toPut);
13:      if (parsed.lists.length) await listRepo.createMany(parsed.lists);
17:      pushToast({ message: 'Backup imported', tone: 'success' });
18:    } catch (error) {
19:      pushToast({ message: `Import failed: ${describeError(error)}`, tone: 'error' });
```

Both new throws are raised at the `:107` call, i.e. **before** `createMany` at `:114`,
before the success toast, and before `setImportReport`. A rejection therefore writes zero
rows and shows no "Imported N items" report.

## 4. The dead branch is really dead — no real check was dropped

The string is gone from the tree:

```
$ grep -rn "does not contain an items array" .   # → no matches
```

To show the removal was behaviour-neutral rather than a lost guard, probe P8 re-implemented
HEAD's exact coercion (the ternary **plus** the old `if (!Array.isArray(items)) throw`)
and ran it over a 13-shape battery: `undefined`, `null`, `'str'`, `42`, `[]`, `[1,2]`,
`{items:'x',tasks:'y'}`, `{items:null}`, `{items:{}}`, `{tasks:{}}`, `{items:0,tasks:0}`,
`{items:[null,1,'a',{id:'k'}],tasks:{}}`, `{items:[],tasks:[]}`. The guard fired **zero**
times — `expect(threw).toBe(false)` for every shape, so the old throw was unreachable, as
the item claimed.

What now guarantees `items` is an array is the ternary itself
(`src/lib/backup.ts:55-59`): `Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed.tasks) ? parsed.tasks : []`. Every branch yields an array, so the guard was tautologically false. And a non-array `items` remains safe — P7 proves `{items:'nope'}` (and `null`/`42`/object) falls through to `tasks` or `[]`, and `:62` then filters on `i && typeof i === 'object' && 'id' in i`. Note this is *not* a regression: the removed branch also would not have fired on those shapes, and the silent-`[]` outcome is the pre-existing behaviour, correctly deferred to `discovered-IMP-020.md` §1 rather than silently changed here.

## 5. User-facing error (existing IMP-015 toast path)

`importJSON` already wraps `parseBackup` in `try`/`catch` and pushes
`Import failed: ${describeError(error)}` with `tone: 'error'` (`SettingsView.tsx:120-121`),
the same path added for IMP-015 (`e6d2dc4`, "fix(settings): handle CSV import errors with an
error toast"). `describeError` (`:41-49`) returns `Error.message` unchanged, so the toast
reads verbatim:

- `Import failed: Not an EisenMatrix backup (found app "some-other-app")`
- `Import failed: Backup is format v3, but this app only imports up to v2`

Both are actionable: the first names the offending field value so the user can identify the
wrong file; the second states the file's version and this app's ceiling, which implies
"update the app" as the fix. No new UI, no new copy path — correct reuse.

## 6. Gates

```
$ npm run typecheck && npm run lint && npm run test && npm run build
typecheck  (tsc --noEmit)          → clean, no diagnostics
lint       (eslint .)               → clean, no output
test       (vitest run)             → Test Files 27 passed (27) | Tests 236 passed (236)
                                         (baseline 231 + 5 new = 236; +8.50s)
build      (tsc --noEmit && vite build) → ✓ built in 2.11s; PWA injectManifest es,
                                         precache 18 entries (607.78 KiB), files
                                         generated dist/sw.js
```

All four gates exit 0, matching the impl report's claim. Only the benign pre-existing
Node warning `--localstorage-file was provided without a valid path` appears
(REPO_PROFILE §7).

**Formatting.** `src/lib/backup.ts` is Prettier-clean. `src/lib/backup.test.ts` is *not*,
but that is pre-existing and correctly left alone:

```
$ npx prettier --check --config .prettierrc.json /tmp/kilo/head/backup.test.ts   # HEAD
[warn] … HEAD exit=1
$ npx prettier --check src/lib/backup.ts src/lib/backup.test.ts                  # worktree
[warn] src/lib/backup.test.ts   (exit=1)
```

Diffing the file against `prettier` output shows the **only** violation is the unchanged
IMP-051 line at `:95` (101 chars > `printWidth: 100`):

```
95c95,99
<       const { toPut, duplicated } = mergeImportedItems([parent, child], [parent, child], 'duplicate');
>       const { toPut, duplicated } = mergeImportedItems(
>         [parent, child],
>         [parent, child],
>         'duplicate',
>       );
```

So the 33 added test lines are themselves Prettier-clean, and reverting the unrelated
reformat (impl report §"Out of scope", discovered report §3) was the right call for a
tightly scoped diff. `npm run lint` does not run Prettier, so the gates stay green.

## 7. Mutation check — both new guards are load-bearing

Performed by temporarily deleting each guard, running `src/lib/backup.test.ts`, then
restoring from a byte-exact snapshot (`shasum c8a3eb3986b9c6be662724c3595c4b1e18104381`
before and after; `diff /tmp/kilo/backup.ts.orig src/lib/backup.ts` → identical; final
`git diff --stat` matches the original).

**Mutation A — app guard deleted:**

```
 ❯ src/lib/backup.test.ts (14 tests | 1 failed) 8ms
   × rejects a payload produced by another app 3ms
 AssertionError: expected [Function] to throw an error
 ❯ src/lib/backup.test.ts:37:39
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
```

**Mutation B — version guard deleted:**

```
   × rejects a too-new format version 3ms
 AssertionError: expected [Function] to throw an error
 ❯ src/lib/backup.test.ts:42:39
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
```

Each guard is independently required by exactly one new test — the tests are not vacuous,
and no other test substitutes for them. Post-restore re-run: `14 passed (14)`.

## 8. Issues

**None blocking.** Non-blocking observations:

1. **`version` as a non-numeric string bypasses the version gate.** `{"app":"eisenmatrix","version":"3"}`
   degrades to `1` and imports (probe P6). Accepted deliberately — a non-numeric version is
   treated as "pre-versioning" — and unreachable from this app's own output, since
   `buildBackup` writes a real number. Noted only so it is not rediscovered later.
2. **`PROGRESS.log` has no IMP-020 row**, and its one added line is IMP-019's. Harmless
   bookkeeping drift for an uncommitted item; expect it with the commit.
3. **`.kilo/` is untracked and not gitignored** (`git check-ignore` → not ignored). Harness
   artifact, unrelated to this item, but it will show up in `git status` for whoever commits.

The three deferred findings in `discovered-IMP-020.md` (§1 payload with neither `items` nor
`tasks` still imports as 0 items; §2 `lists` entries unvalidated; §3 Prettier not wired into
`lint`) are genuine, correctly out of scope for IMP-020's ACs, and already filed.

## 9. Verdict

**PASS.** All four acceptance criteria met; backward compatibility holds on every case
tested (older `version` with the marker, missing `app`, legacy `tasks`, non-array `items`,
and a real export→import round-trip); rejection provably precedes any Dexie write; the
removed branch is provably unreachable and its safety property is preserved by the ternary;
errors surface through the existing IMP-015 toast with actionable text; all four gates are
green (236/236); and both new guards are proven load-bearing by mutation testing. Nothing
committed — this report is the only file added.
