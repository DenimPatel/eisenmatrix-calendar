# IMP-087 — Undo of an editor-created parent must not leave pre-saved subtasks orphaned

**Status: done.** Branch `improve/auto-20261017`.

## Root cause

The editor persists a subtask immediately via `createItemsPersisted` while the new
parent still exists only as a draft. Saving the parent then goes through
`saveItem`'s create branch, whose IMP-069 undo closure removed only `item.id`, so the
latest `⌘Z` deleted the parent and left the child with a dangling `parentId`. The child's
own create entry sat underneath, requiring a second undo.

## Change

`src/domain/itemActions.ts` (`saveItem`, create branch only): snapshot the descendants of
the new parent before writing the parent row, then remove the parent plus that snapshot in
one undo. A brand-new parent id cannot own descendants that predate the editor session, so
the snapshot is exactly the subtasks persisted for this draft (including deeper
descendants), and children of any other parent are untouched. History and edit-branch undo
semantics are unchanged; the label stays `Create “<title>”`.

`src/domain/itemActions.test.ts`: new `saveItem` case that mirrors the editor flow —
`createItemsPersisted` writes a child with `parentId` set to the unsaved parent's id, an
unrelated parent/child pair already exist, then `saveItem(parent)` pushes exactly
`['Create 1 items', 'Create “Parent”']`. One undo removes both the parent and its child,
leaves no row whose `parentId` is the removed parent, and keeps the unrelated parent and
child.

## Verification

```
npm run typecheck   PASS
npm run lint        PASS
npm run test        PASS  42 files / 454 tests (baseline 453, +1)
npm run build       PASS  dist/sw.js, 18 precache entries (622.80 KiB)
npm run format:check PASS
```

Focused run: `npx vitest run src/domain/itemActions.test.ts` → 44/44.

Browser (production preview, SW/caches reset first): `N` → title “Parent task” → add
subtask “Child task” → Save → `Meta+z`. IndexedDB `items` went from 11 to 9 rows: both
`Parent task` and `Child task` were gone, the other 9 (including pre-existing seeded rows)
survived. Console: 0 errors, 0 warnings.

## Files

- `src/domain/itemActions.ts`
- `src/domain/itemActions.test.ts`
- `.improve/reports/impl-IMP-087.md`
- `.improve/reports/discovered-IMP-087.md`

No new dependencies, schema or migration changes; no `.improve/` state files edited.
