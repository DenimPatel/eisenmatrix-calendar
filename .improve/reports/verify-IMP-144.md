# verify-IMP-144 — Reject non-string occurrence override fields on import

**Verifier:** independent (did not author the change)
**Date:** 2026-10-18
**Verdict:** **PASS** (one minor, non-blocking discrepancy — see F1)

## Scope inspected

- Spec: `.improve/FEATURES.md` IMP-144 (`:2297-2311`), `.improve/reports/impl-IMP-144.md`,
  `.improve/reports/discover4-quality.md` C4 (`:122-152`), `.improve/REPO_PROFILE.md`, `AGENTS.md`.
- Uncommitted diff (`git status`): `src/lib/itemValidation.ts`, `src/lib/backup.test.ts`,
  `src/lib/csv.test.ts`, `.improve/FEATURES.md`; new untracked
  `src/lib/itemValidation.test.ts`, `.improve/reports/{impl,discovered}-IMP-144.md`.
- `git log` head is `a622caf [IMP-143]`; IMP-144 is uncommitted.

## 1. Acceptance criteria

**AC1 — `validateItem` rejects/drops an override whose `start`/`end` is present but non-string, or
whose `status` is invalid.** MET. `asOccurrenceOverride` (`src/lib/itemValidation.ts:64-92`) builds a
fresh `OccurrenceOverride` from known fields only and returns `null` when a known field has the wrong
type; `asOverrides` (`:94-102`) drops that entry. `end` is `string | null` (matches the canonical
`OccurrenceOverride` type, `src/types/recurrence.ts:9`, and `occurrenceEnd` treats `null` as explicit
"no end"), so `end: null` is kept and only non-string/non-null `end` drops.

Independent probe (`validateItem` + `parseBackup` + `csvToItems` + `expandOccurrences`, temporary
`src/lib/__probe_verify_imp144.test.ts`, removed after):

| override | result |
|---|---|
| `{start:5}` | dropped whole, `invalid === 0`, item survives |
| `{end:5}` | dropped whole |
| `{status:'bogus'}` | dropped whole |
| `{title:5}` | dropped whole |
| `{notes:[]}` | dropped whole |
| `{allDay:'yes'}` | dropped whole |
| unknown-only `{bogus:true,extra:9}` | kept as `{}` (harmless; see F2) |
| `{end:null}` | kept as `{end:null}` (valid control) |
| `{start:5,title:'ok'}` (mixed) | dropped whole — no half-apply; the valid `title` is not partially kept |
| valid control `{start,end,allDay,title,notes,status,bogus}` | all valid fields kept, `bogus` dropped |

Sibling survival: `{A:valid, B:{start:5,title:'ok'}, C:{title:'Moved'}}` → `{A:..., C:...}`; only the
bad entry is dropped.

**AC2 — backup/CSV increments `invalid` OR yields only string starts.** MET (second branch). Both
paths keep `invalid === 0`, keep the item, and `expandOccurrences` yields only `string` starts; `5`
never appears in `start`s.

**AC3 — `useOccurrences` never receives a non-string `start`.** MET. The exact hook sort
`(a.start ?? a.occKey).localeCompare(...)` (`src/hooks/useOccurrences.ts:13-17`) is replicated in the
impl test and in the probe: it does not throw, and every `start` is a string. Proven to be the real
defect class: a raw (non-normalized) item carrying `{start:5}` still yields a numeric `start` and the
same sort **does** throw — so the guard is what removes the crash, not an unrelated change.

**AC4 — existing backup/CSV/validation tests still pass.** MET. `src/lib/{itemValidation,backup,csv}.test.ts`
= 55/55 green.

## 2. Import-count semantics / no silent item loss

Coherent and documented. `impl-IMP-144.md:33-45` states the choice explicitly: a malformed override is
**dropped, not counted** (`invalid` unchanged), because an override is an optional sub-record and a bad
one must not discard an otherwise-valid item; AC2 permits either branch. The item and all sibling
overrides survive, so no valid item is silently lost. The only thing lost is the malformed override
itself (and, for a mixed entry, its other fields) — which is exactly what AC1 sanctions. The `end:null`
deviation from the spec's prose is called out and justified against the canonical type.

## 3. Gates

All five pass on the uncommitted tree:

```
npm run typecheck    PASS
npm run lint         PASS (no output)
npm run test         PASS — 77 files / 790 tests
npm run format:check PASS
npm run build        PASS — dist/sw.js generated, 28 precache entries (659.96 KiB)
```

## 4. Mutation check

Bypassing `asOccurrenceOverride` (restoring the old `out[key] = entry as OccurrenceOverride`) makes
**13 tests fail** — matching `impl-IMP-144.md:57-58`:
- `itemValidation.test.ts` (6): start non-string, end non-string, allDay, title/notes, unknown status,
  valid-fields-kept.
- `backup.test.ts` malformed block (6): numeric start, invalid status, numeric title, valid+unknown,
  mixed map, non-string-start sort regression.
- `csv.test.ts` (1): malformed override through the CSV path.

Restored; `asOverrides` is byte-identical to the intended fix, the three test files are green again,
and the probe file was deleted. No stray artifacts remain.

## 5. State/backlog files

No other state/backlog file changed: `STATE.md`, `HANDOFF.md`, `PROGRESS.log`, `CHANGELOG.md`,
`DIMENSIONS.md` are clean vs `HEAD`. **F1:** `.improve/FEATURES.md` carries *two* uncommitted edits —
the expected IMP-144 status flip (`TODO` → `IN-PROGRESS`) **and** an unrelated IMP-143 note edit
(`Commit pending` → `Commit a622caf`). The IMP-143 note change is documentation-only and benign, but
it is a second change to a backlog file and contradicts the impl report's "Backlog/state files not
edited".

## Findings

- **F1 (minor, non-blocking):** unrelated IMP-143 note edit in `.improve/FEATURES.md` alongside the
  IMP-144 status flip (see §5).
- **F2 (informational):** an override containing *only* unknown fields is retained as `{}`, so
  `isOverride` becomes `true` for that occurrence. No behavioral regression (the prior code kept the
  unknown fields too) and no crash; noted only because it is not literally "dropped".
- **F3 (informational, already logged):** `asOccurrences` (the per-occurrence state map) remains
  unvalidated — same class, distinct map, does not reach the `localeCompare` crash. Recorded in
  `discovered-IMP-144.md`.

## Identity / item-level guards (IMP-038 / IMP-072 / IMP-111)

Unchanged. The diff only touches `asOverrides` plus new helpers; `coerceRecurrence`, `coerceItemShape`,
`validateItem`'s id check, and `parseBackup`'s `app`-marker identity guard (`src/lib/backup.ts:52-60`)
are untouched, and their tests pass. Probe confirmed missing/blank `id` is still rejected.

## Conclusion

The fix is correct, minimal, well-tested, and independently reproduces both the defect and its removal.
All five gates pass and the mutation check is honest. **PASS**, with F1 as the only actionable cleanup
(drop the unrelated IMP-143 note edit from the IMP-144 change, or state it explicitly).
