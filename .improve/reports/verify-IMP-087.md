# Verify — IMP-087: Undo of an editor-created parent must not orphan pre-saved subtasks

Reviewer: independent (did not author the change)
Branch: `improve/auto-20261017` (HEAD `fbcd4f`, IMP-087 uncommitted)
Date: 2026-10-17

**VERDICT: PASS** — all three criteria hold, the new test is non-vacuous and covers the
unrelated-item case, and the browser check reproduces the fixed behavior with zero console
errors. Two non-blocking advisories are recorded at the end.

## Scope reviewed

| File | Change |
|---|---|
| `src/domain/itemActions.ts` | `saveItem` create branch only: snapshot `collectDescendants(item.id)` before `create`, remove parent + snapshot in the pushed undo closure (`:84-88`) |
| `src/domain/itemActions.test.ts` | +23 lines: one `saveItem` case mirroring the editor flow (`:139-158`) |
| `.improve/*` | FEATURES status IN-PROGRESS and reports; the CHANGELOG/PROGRESS lines shown in `git diff` are the pre-existing IMP-060 entries, not this item |

Production diff is 2 added / 1 removed line confined to the create branch. No new imports,
dependencies, comments, schema or migration changes. `git diff --check` is clean; Prettier
passes. No debugger/console/TODO leftovers. No direct Dexie access outside `src/db/`.

## Criteria

1. **PASS — one undo removes children created in the same editor session.**
   `saveItem` snapshots the fresh parent's transitive descendants immediately before writing
   the parent row and the undo pops `[parent, ...descendants]` in one `removeMany`. Browser:
   child persisted pre-save (12 rows), parent saved (13 rows), one `⌘Z` → 11 rows; both
   `Parent task` and `Child task` gone, no row keeps the removed `parentId`. Unit test asserts
   the same in fake-indexeddb.
2. **PASS — pre-existing/unrelated children survive.** The snapshot is scoped to
   `collectDescendants(item.id)` only, so rows under other parents are never candidates. The
   test seeds an unrelated `other → other-child` pair and asserts exactly those two rows
   remain after undo; the browser check kept both unrelated Quick Add tasks plus the 9
   pre-existing rows.
3. **PASS — edit branch and undo/history semantics unchanged.** The diff touches only the
   `else` (create) branch; the edit branch, history construction, edit-undo closure, label
   and one-entry-per-save behavior are byte-identical. Existing `saveItem` tests (single
   create entry, silent create, single edit entry, history accumulation) still pass.

### Snapshot timing / collision analysis

- The snapshot is taken **before** `create`, which is required: the editor's child row exists
  while the parent is still a draft. Taking it after `create` would be equivalent here (no
  concurrent editor writes during the awaited save), but before is safe.
- `collectDescendants` is the IMP-002 BFS walker, so deeper descendants are included; the
  test exercises only one level, but the walker itself is already covered.
- The create branch is entered only when `itemRepo.get(item.id)` is `undefined`, so a
  pre-existing parent id takes the edit branch. New drafts come from `createItem` → fresh
  `newId()`, and a cancelled draft's id is never reopened, so "same session" descendants are
  in practice the only rows that can point at a brand-new UUID. An orphan row would have to
  carry a colliding future UUID — not realistic.
- Concurrent double-save of the same draft can still create two create entries (pre-existing
  behavior); both snapshots cover the same children, and the first undo removes the tree
  while the second no-ops. No orphan results.

## Non-vacuity (HEAD differential)

A temp copy of HEAD source (`git archive HEAD`, outside the workspace, new test copied in,
`node_modules` symlinked) ran the new case:

```
× removes the subtasks saved before the parent on undo, leaving unrelated rows
AssertionError: expected [ 'child', 'other', 'other-child' ]
                to deeply equal [ 'other', 'other-child' ]
```

On HEAD the parent is removed but `child` remains with a dangling `parentId`, so the test
fails for the defect. The unrelated `other`/`other-child` rows survive in both versions,
which proves the unrelated assertion is live rather than incidental.

## Gates (workspace)

```
npm run typecheck    PASS  tsc --noEmit, no diagnostics
npm run lint         PASS  eslint ., no output
npm run test         PASS  42 files / 454 tests (baseline 453, +1)
npm run build        PASS  tsc + vite + PWA; dist/sw.js; 18 precache entries (622.80 KiB)
npm run format:check PASS  All matched files use Prettier code style
```

## Browser check (production preview)

Built bundle served at `http://localhost:4173/eisenmatrix-calendar/`; service worker
unregistered and the workbox precache deleted, then a real document reload via
`about:blank`.

- `N` → `Parent task` → subtask `Child task` + Enter → Save → `Meta+z`.
- IndexedDB `items`: 11 → 12 (child only, draft `parentId`) → 13 (parent + child) → **11**
  after one undo. `parentChildLeft: []`, `orphanParentIds: []`,
  `unrelated: ["Unrelated alpha", "Unrelated beta"]`; neither removed title renders.
- Console: **0 messages (0 errors, 0 warnings)**.
- Evidence: `.improve/artifacts/IMP-087/browser-evidence.md`,
  `.improve/artifacts/IMP-087/after-undo.png`.

## Advisories (non-blocking)

1. The child's own `Create 1 items` entry remains underneath after the parent undo. A second
   `⌘Z` pops it and `removeMany` no-ops on the deleted ids, so there is no data corruption;
   the stack is just stale. The implementer documented this in `discovered-IMP-087.md`;
   removing it needs a new remove-specific-entry store API, which is outside this item.
2. `ItemEditorSheet.addChild` still persists children before the parent is saved, so a
   cancelled draft keeps its subtask rows with a dangling `parentId`. That is pre-existing,
   unchanged by this fix, and orthogonal to undo.

Neither advisory affects the three criteria. No scope creep or style issue found.

## Suggested Bugs/Correctness health delta

**+1**: closes a real undo-integrity/data-orphaning defect (listed pre-existing in
`REPO_PROFILE.md §7`) with a narrow, well-tested change; no new correctness debt beyond the
documented stale undo entry.
