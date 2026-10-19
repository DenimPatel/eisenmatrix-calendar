# Verify IMP-142 — Disable Subtasks while the editor scope is "This occurrence"

**Verdict:** PASS (with one minor, non-blocking note)
**Verifier:** independent (did not author the change)
**Date:** 2026-10-19
**Workspace:** branch `improve/auto-20261018`, uncommitted

## Scope of change under review

Uncommitted diff (3 files):

- `src/features/item/ItemEditorSheet.tsx` (+85/−43 region) — the Subtasks/Milestones block is
  now wrapped in the existing `SeriesOnlyGroup locked={occurrenceScoped}`, its label gains
  ` · ${SERIES_ONLY_HINT}` under occurrence scope, and `addChild` is guarded with
  `if (occurrenceScoped || !title.trim()) return;`.
- `src/features/item/ItemEditorSheet.test.tsx` (+39, no deletions) — one new case
  `disables the subtasks input and child checkboxes for one occurrence only`.
- `.improve/FEATURES.md` — IMP-142 status `TODO → IN-PROGRESS`, plus an unrelated one-line
  note update (see Finding F1).

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Under "This occurrence" the Subtasks/Milestones input and child checkboxes are disabled and carry the series-only hint, matching Checklist | **MET** | `ItemEditorSheet.tsx:494-538`; browser: both controls inside `fieldset[disabled]` (`min-w-0 space-y-4 opacity-60`), label `Subtasks · Applies to the whole series`, banner present; test asserts `isFieldDisabled` on input and child checkbox |
| 2 | Enabled for "This and future" and "All occurrences" | **MET** | Browser: after clicking each scope, `closest('fieldset[disabled]')` is `null` and the hint suffix is gone; test asserts `isFieldDisabled === false` for both |
| 3 | No subtask can be created from the editor in occurrence scope (Enter/programmatic path) | **MET** | `addChild` early-returns on `occurrenceScoped` (`:261`); browser synthetic Enter with text left IDB item count at 2 (no child); test asserts `itemRepo.children(item.id)` length stays 1 |

## Detailed verification

### Static review
- The Subtasks block is the **only** new `SeriesOnlyGroup`; the Checklist block
  (`:541-582`) is unchanged context in the diff and keeps its own wrapper, so no other block
  was accidentally wrapped.
- `SeriesOnlyGroup` returns a disabled `fieldset` when locked (`:98-114`); the same
  `occurrenceScoped` flag (`:164`) drives Checklist, Tags, List, Urgency/Importance, so the
  Subtasks block now matches them.
- The guard makes the programmatic path independent of the DOM disabled state, so a synthetic
  Enter/keydown (or a future refactor removing the fieldset) cannot write a series-wide child.
- `addChild` is the only mutation path for a child from the editor; `createItem` sets
  `parentId: draft.id` (series id).

### Gates (all run, all PASS)
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS, **75 files / 761 tests** (was 760; +1 new case)
- `npm run format:check` — PASS
- `npm run build` — PASS (`dist/sw.js`, precache 28 entries)

### Browser check (isolated preview, port 4189, SW/caches unregistered+deleted, `about:blank`
round-trip, fresh IndexedDB)
Seeded a daily recurring task "Standup" via quick add and one child "Write notes" (added in
"All occurrences"), then opened the 2026-10-18 occurrence on `#/calendar`.

| Scope | Add-subtask in `fieldset[disabled]` | Child checkbox in `fieldset[disabled]` | Hint |
|-------|:---:|:---:|------|
| This occurrence | yes | yes | `Subtasks · Applies to the whole series` |
| This and future | no | no | absent |
| All occurrences | no | no | absent |

- Synthetic Enter with `Sneaky child` in the occurrence-scoped add input: IDB item count
  `2 → 2`; stored titles `["Standup","Write notes"]`. No child created.
- Console: **0 errors, 0 warnings** (the only warning recorded was my own
  `deleteDatabase('eisenmatrix')` during the reset).
- Artifacts: `.improve/artifacts/IMP-142/occurrence-scope-1280x800.png`,
  `occurrence-scope-390x844.png` (plus the author's `future-scope-enabled-1280x800.png`).

### Mutation check
Backed up the source, then mutated and ran the new case in isolation:

1. `SeriesOnlyGroup locked={false}` for the Subtasks block only → test **FAILS** at
   `ItemEditorSheet.test.tsx:442` (`expected false to be true`) on the disabled assertion.
2. `addChild` guard reverted to `if (!title.trim()) return;` (fieldset lock kept) → test
   **FAILS** at `:454` (`expected [ … ] to have a length of 1 but got 2`) — the programmatic
   path creates a child.

Both were restored; `git diff --stat` again shows the original `+85/−43` for
`ItemEditorSheet.tsx`, the guard line is present, and the new case passes.

## Findings

**F1 (minor, non-blocking) — extra edit in FEATURES.md beyond the status flip.**
The `.improve/FEATURES.md` diff contains the expected `IMP-142: TODO → IN-PROGRESS` flip
**and** an unrelated one-line change to IMP-141's Notes: `Commit pending.` →
`Commit 25db21c.` (25db21c is a real commit). No other state/backlog file
(`STATE.md`, `PROGRESS.log`, `CHANGELOG.md`, `HANDOFF.md`, `DIMENSIONS.md`) is modified. The
extra line is factual cleanup, not a regression, but it is technically beyond the requested
"status flip only".

**No other findings.** The implementation is minimal, reuses the existing pattern, changes no
layout beyond the established `opacity-60` disabled styling, and leaves Checklist behaviour
untouched.

## Health delta

- Tests: 760 → 761 (+1, the new case); all gates green.
- Lint/typecheck/format/build: green before and after.
- Browser: 0 console errors; disabled/hint behaviour correct at 1280×800 and 390×844.
- Risk: low; single-file product change with a guarded programmatic path and a
  mutation-verified test.
