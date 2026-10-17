# IMP-069 — Make editor-created items undoable

## Files changed

- `src/domain/itemActions.ts` — `saveItem` now pushes a `Create “<title>”` undo entry in
  the create branch, with a closure that removes the new row. The edit branch is unchanged
  (`Edit “<title>”`), so an existing row still gets exactly one entry. `options.silent`
  continues to gate only the toast; the undo entry is always pushed.
- `src/domain/itemActions.test.ts` — added a `saveItem` suite:
  1. create pushes one `Create “New task”` entry; invoking the top undo removes the row
     from IndexedDB and leaves the prior stack entry on top at the previous depth;
  2. `{ silent: true }` suppresses the toast but keeps the create undo entry;
  3. saving an existing item pushes exactly one `Edit “Renamed”` entry (not two).

## Approach

Reused the existing `pushUndo` helper and the exact label/closure shape of
`createItemPersisted`, avoiding any refactor of `saveItem`'s existing branches. No changes
to routes, persistence schema, or editor callers.

## Commands / results

```
npm run typecheck   # pass, no diagnostics
npm run lint        # pass, no output
npm run test        # pass, 32 files / 332 tests
```

## Uncertainties

None. Browser-level Playwright verification (N → save → ⌘Z) was not run in this session;
the fake-indexeddb unit test covers the same code path end to end.
