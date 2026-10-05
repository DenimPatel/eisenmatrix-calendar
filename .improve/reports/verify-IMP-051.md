# verify-IMP-051 — Remap `parentId` when duplicating imported items

**Reviewer:** independent verification (did not author the change)
**Branch / HEAD:** `improve/auto-20261003` @ `1c1cbd5`
**Verdict:** **PASS** — all three acceptance criteria met; all four gates green; 3 of 3 mutations
caught. Four non-blocking findings (3 nits, 1 informational) recorded below.

---

## 1. Scope of the diff

```
$ git diff --stat src/
 src/lib/backup.test.ts | 57 ++++++++++++++++++++++++++++++++++++++++++++++++++
 src/lib/backup.ts      | 15 ++++++++++++-
 2 files changed, 71 insertions(+), 1 deletion(-)
```

Untracked: `.improve/reports/impl-IMP-051.md`, `.improve/reports/discovered-IMP-051.md`.

**Production change** — `src/lib/backup.ts:73-98`, one branch plus a pre-pass:

```ts
  // Pre-pass so a child can be remapped to its parent's new id even when the
  // parent appears later in the incoming array.
  const idMap = new Map<string, string>();
  if (strategy === 'duplicate') {
    for (const item of incoming) {
      if (existingIds.has(item.id) && !idMap.has(item.id)) idMap.set(item.id, newId());
    }
  }
  ...
      duplicated++;
      toPut.push({
        ...item,
        id: idMap.get(item.id) ?? newId(),
        parentId: item.parentId ? (idMap.get(item.parentId) ?? item.parentId) : item.parentId,
      });
```

**Scope-creep / hygiene audit — clean.**

| Check | Result |
| --- | --- |
| Unrelated files touched | none (`SettingsView.tsx` untouched; caller needs no change — confirmed it consumes `toPut` wholesale) |
| Debug leftovers in added lines | none — `git diff -- src/ \| grep -E "^\+" \| grep -Ei "console\.\|debugger\|TODO\|FIXME\|XXX\|api[_-]?key\|secret\|token\|password"` returns nothing |
| Secrets | none |
| Direct Dexie outside `src/db/` | none (REPO_PROFILE §5) |
| Direct `localStorage` in features | none (§5) |
| ID scheme | still `newId()` from `src/lib/id.ts` (§5) |
| Dependency direction | `lib` remains a leaf; only `./id` + type-only `@/types` (§5) |
| Comments | 1 block at `:73-74` explaining non-obvious intent (the pre-pass's *necessity*) — permitted by AGENTS.md / §5 |
| Styling / dates / a11y | N/A — pure data logic, no UI |

**Attribution of other uncommitted workspace state — not IMP-051.**
`.improve/PROGRESS.log` (+1 line for IMP-068) and `.improve/STATE.md` (regression cadence) are
leftovers from the **IMP-068** session (commit `1c1cbd5`); `.improve/reports/regression-20.md` is
"Regression Sweep 20 … HEAD at sweep `1c1cbd5` IMP-068". These are **not** IMP-051 scope creep
(mtimes 22:06–22:09 vs. IMP-051 artifacts at 22:08–22:09, but content attribution is unambiguous).

---

## 2. Acceptance criteria

| AC | Requirement | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | `duplicate` builds an id map (original → new) and every duplicated item's `parentId` is rewritten to the new id when its parent is also in the incoming set | **MET** | `backup.ts:75-80` + `:97`; unit tests `backup.test.ts:61-76`; differential fuzz §3 below: 0 violations of "remapped a parent that was not duplicated" across 20 000 `duplicate` cases |
| 2 | Duplicated items whose parent is not in the incoming set keep the original `parentId` | **MET** | `backup.test.ts:78-102`; fuzz: 0 violations; scenario 2 in §3.2 prints `parentId kept as p: true` |
| 3 | `skip` / `overwrite` behavior unchanged | **MET** | 40 000 fuzz cases (2 strategies × 20 000): identical `JSON.stringify` of the whole `MergeResult` **and** identical object identity (`toPut[i] === toPut[i]`); counters equal. Test `backup.test.ts:104-111` |

### AC1 reading: "in the incoming set" == "in `idMap`"

The implementation remaps only when the parent is in the incoming set **and collides** with an
existing row (`existingIds.has(item.id)`). A *fresh* incoming parent keeps its own id, so its
children's `parentId` needs no rewrite — the reference stays valid either way. Covered explicitly
by `backup.test.ts:91-102` ("keeps the parentId when the incoming parent is not itself
duplicated"). The implementer flagged this reading in `impl-IMP-051.md:70-73`. **Acceptable.**

### Criterion: "the id map is built from ids that actually get new ids" — MET

The pre-pass guard `existingIds.has(item.id)` is *exactly* the condition under which the main
loop's `duplicate` branch assigns a fresh id, and both branches consume the same `idMap.get(item.id)`
entry (so a duplicated item never gets two different ids). Scenario 7 in §3.2 confirms a colliding
id gets a new one and a fresh id is left untouched.

---

## 3. Semantic verification

### 3.1 Differential fuzz — `src/lib/backup.ts` (new) vs `git show HEAD:src/lib/backup.ts` (old)

Both real functions were bundled (esbuild) and run over the same inputs: 20 000 randomized
(existing, incoming, strategy) triples × 3 strategies = **60 000 cases**, seeded PRNG for
reproducibility. Generators produced colliding/fresh/ghost ids, null / in-set / out-of-set /
self-referencing `parentId`, and duplicate ids within one payload.

Oracles checked per case:
* `skipped` / `overwritten` / `duplicated` counters equal between old and new.
* `toPut.length` equal.
* For `skip` / `overwrite`: `JSON.stringify(result)` byte-equal **and** element object identity
  preserved (the old code pushed the input object by reference; still does).
* For `duplicate`: every field other than `id`/`parentId` unchanged (spread fidelity).
* `parentId` changed **only** when the referenced parent is present in the incoming set *and*
  colliding, and the new value equals that parent's assigned new id.
* No duplicated row ends up its own parent unless the source row already was.

```
cases: 60000
problem count: 3358
  SELF-PARENT created: item fresh0 parentId===id      (and 7 further distinct variants)
```

**Result:** zero counter/length/field-drift problems, zero `skip`/`overwrite` differences, zero
 illegitimate remaps. The *only* problem class is the self-parent edge in §5.1.

### 3.2 Targeted scenarios (actual function output)

```
=== 1. THREE-LEVEL CHAIN, child-first, all ids collide (GP<-null, P<-gp, C<-p) ===
 OLD: C(36ed0e8c)<-p  P(243593fe)<-gp  GP(6eb80172)<-null      <- points at ORIGINALS
 NEW: C(196fe42a)<-16fc5cbd  P(16fc5cbd)<-02018728  GP(02018728)<-null
 unique new ids: true | none equal originals: true | self-parent: false
 => transitive remap confirmed; chain intact; child-first order handled (M3, §4)

=== 2. PARENT NOT IN INCOMING SET (parent collides in existing, absent from payload) ===
 NEW: C(5c12be1d)<-p | parentId kept as p: true                 => AC2

=== 3. MIXED: GP+P+C all collide, plus fresh child N(parentId:'p') ===
 NEW: GP(824be560)<-null  P(61902ff8)<-824be560  C(0e02516e)<-61902ff8  N(n)<-p
 => N attaches to the ORIGINAL p (D1 residual gap, pre-existing, documented; not a regression)

=== 5. SAME ID TWICE IN INCOMING (corrupt payload) ===
 OLD ids distinct: true  | len 2
 NEW ids distinct: false | len 2   => both rows share one new id; collapse happens at bulkPut

=== 7. idMap POPULATED ONLY FOR IDS THAT ACTUALLY GET NEW IDS ===
 colliding p -> new: true | fresh f kept id: true
```

---

## 4. Mutation check — 3 mutations, 3 caught

All mutations applied to the real `src/lib/backup.ts`, each followed by
`npx vitest run src/lib/backup.test.ts`. The fix was restored after each and the final file
verified byte-identical (`md5 = 01bd967d1f691ca5e48227df24fc6d2a`, matching the pre-review value).

| # | Mutation | Result |
| --- | --- | --- |
| **M1** | `git checkout HEAD -- src/lib/backup.ts` — restore the **old duplicate branch** verbatim | `Tests 2 failed \| 7 passed (9)`. Failures: *"repoints a duplicated child at the duplicated parent"* (`expected 'p' to be 'b9a5ac88-…'`) and *"repoints when the child precedes the parent in the incoming array"* (`expected 'p' to be '4c5b17fb-…'`). **Both AC1 tests fail on the old code.** |
| **M2** | Keep the pre-pass, delete **only** the `parentId:` line from the pushed object | `Tests 2 failed \| 7 passed (9)` — the same two AC1 tests. Proves the `parentId` assertion is load-bearing, independent of the id map. |
| **M3** | Delete **only** the pre-pass and resolve inline (one-pass, id registered as it is assigned) | `Tests 1 failed \| 8 passed (9)` — *only* *"repoints when the child precedes the parent in the incoming array"*. Proves the pre-pass test is load-bearing and that the ordering case is genuinely covered (a one-pass fix passes the other AC1 test). |

M3 is the strongest evidence in the set: it shows the two AC1 tests are not redundant, and that
the implementer's justification for the pre-pass (`impl-IMP-051.md:24-26`) is correct and tested.

Per the task brief, the old-code restore was also confirmed to leave the AC2/AC3 guard tests
passing (7 passed) — they encode behavior that was already correct and are true regression
barriers, as the implementer stated.

---

## 5. Findings

### 5.1 [low · new, malformed-input only] A source row that is its own parent becomes its own parent

Not covered by `impl-IMP-051.md` or `discovered-IMP-051.md` (D1/D2/D3 miss it).

Repro — incoming row `X` with `id:'x'`, `parentId:'x'`, and `'x'` colliding with an existing row
so the `duplicate` branch runs:

```
OLD -> id: 1a6503d0-4968-4b7c-af71-075a6d0abd74  parentId: x   self-parent: false
NEW -> id: c62bb99a-4500-4880-aa28-3ae2b25f5618  parentId: c62bb99a-4500-4880-aa28-3ae2b25f5618
                                                                 self-parent: TRUE
```

`idMap.get(item.parentId)` looks up `item.parentId === item.id`, i.e. the row's **own** entry, so
the row is re-parented to itself. Previously the id change incidentally broke the degenerate
self-reference (leaving a dangling ref to the original); the new code preserves it as a hard
self-loop. Same shape if the payload contains a 2-cycle — that one is faithfully propagated rather
than created, so it is not a new defect class.

**Severity: low.** Unreachable from app code — no feature ever sets `parentId` to the row's own id
(`ItemEditorSheet.tsx:131` uses another item's `draft.id`; `GoalsView.tsx:43` uses an existing
`goalId`); `itemFactory.ts:63,102` default `parentId` to `null` without a self-check. Only a
hand-edited or corrupt backup reaches it, since `parseBackup` (`backup.ts:45`) filters on
`'id' in i` only. Not a regression against any AC.

**Suggested (optional, not required for merge):** skip the rewrite when
`item.parentId === item.id`, i.e.
`parentId: item.parentId && item.parentId !== item.id ? (idMap.get(item.parentId) ?? item.parentId) : item.parentId`.
Doing it here would also resolve finding 5.2 for free. The task brief asked explicitly that chains
"do NOT … point a parent at itself" — it holds for all well-formed input and for every row the app
can produce, so I do not treat this as blocking.

### 5.2 [nit] Redundant ternary — `src/lib/backup.ts:97`

```ts
parentId: item.parentId ? (idMap.get(item.parentId) ?? item.parentId) : item.parentId,
```

Provably a no-op: for any falsy `parentId` (`null`, `undefined`, `''`) **both** branches evaluate
to `item.parentId`, and `Map.get(null)` is well-defined (`undefined`). Equivalent to:

```ts
parentId: idMap.get(item.parentId) ?? item.parentId,
```

No behavior change; dead branching only. Not worth a fix on its own.

### 5.3 [nit] Inaccuracies in `impl-IMP-051.md`

* Says **"4 new cases"** (`:5`) and **"+4 new"** (`:55`). The diff adds **5** `it()` blocks
  (+57 lines); 180 tests = 175 baseline + 5. The 180 total is right, the delta is not.
* Says `npm run build` "not run" because "profile §2 requires it for UI features" (`:56-57`).
  REPO_PROFILE §2 lists all four gates unconditionally ("Run gates in order, all must exit 0:
  `npm run typecheck && npm run lint && npm run test && npm run build`"); §4 relaxes only the
  *browser* step for data/domain logic. I ran it: **PASS** — `dist/sw.js` generated, precache
  18 entries (604.28 KiB), matching baseline §3.

### 5.4 [process] Backlog metadata not advanced

`FEATURES.md:302` is still `- **Status:** TODO` for IMP-051 and `PROGRESS.log` has no IMP-051
row. Repo convention (see `git show 75778cc --stat`: `FEATURES.md` +25/-…, `PROGRESS.log` +1) is
to flip status to DONE with a Notes line and append the log row **in the commit**. Consistent with
the implementer's own statement that nothing was committed, so this is almost certainly the
coordinator's post-verification step — flagged for completeness, not a code defect.

### 5.5 [info] D2 wording

`discovered-IMP-051.md:28-34` says the same-id-twice case "collapses to one row". Precisely,
`toPut` still holds 2 entries (both now sharing one new id, confirmed in §3.2 scenario 5) and the
collapse to a single row happens downstream in `itemRepo.createMany`'s `bulkPut`. The report does
say so at `:33-34`; noting only for precision.

---

## 6. Gates

```
$ npm run typecheck   -> PASS (tsc --noEmit, no diagnostics)
$ npm run lint        -> PASS (eslint ., no output)
$ npm run test        -> PASS  Test Files 23 passed (23) | Tests 180 passed (180)
                          (baseline 175 + 5 new; 7.85s)
$ npm run build       -> PASS  dist/sw.js, precache 18 entries (604.28 KiB)
```

Benign pre-existing Node warning `--localstorage-file was provided without a valid path` appears
on every run and is documented in REPO_PROFILE §7 — not a regression.

---

## 7. Checklist against the brief's semantic demands

| Demand | Verdict |
| --- | --- |
| `parentId` remapped **only** when the parent is in the incoming set | MET — 0 illegitimate remaps in 20 000 fuzz cases |
| Duplicated child whose parent is NOT in the incoming set keeps the original `parentId` | MET — `backup.test.ts:78-89` + scenario 2 |
| Multi-level chains remap **transitively** | MET — scenario 1 (GP→P→C, child-first) |
| …and create **no cycles** | MET for all well-formed input; a pre-existing 2-cycle is propagated, not created (§5.1) |
| …and **never point a parent at itself** | MET for all app-producible input; a corrupt self-parent row is now preserved as a self-loop — see §5.1 (low, non-blocking) |
| `skip` / `overwrite` byte-for-byte unchanged | MET — 40 000 fuzz cases, identical serialization **and** object identity |
| Id collisions still detected the same way | MET — collision detection is `existingIds.has(item.id)` in both versions, untouched; counters identical |
| Id map built from ids that **actually get new ids** | MET — pre-pass guard identical to the duplicate-branch condition; scenario 7 |

---

## 8. Verdict

**PASS.** AC1, AC2, AC3 all met. Diff is minimal and hygienic (+15/−1 production, +57 test, no
scope creep, no debug leftovers, no secrets, no convention violations). All four gates green at
180/180. Three independent mutations each caught by the new tests, including a one-pass variant
that only the ordering test rejects. The four findings are non-blocking: one low-severity
malformed-input edge (§5.1, not in the implementer's discovery list), two nits (§5.2, §5.3), one
process step (§5.4).

Nothing committed. Only `.improve/reports/verify-IMP-051.md` was added; `src/lib/backup.ts` was
restored bit-for-bit (md5 `01bd967d1f691ca5e48227df24fc6d2a`) and the temporary
`src/lib/__imp051_old_backup.ts` harness module was deleted.
