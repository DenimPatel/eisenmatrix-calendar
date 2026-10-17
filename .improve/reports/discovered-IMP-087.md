# Discovered while implementing IMP-087

## INFO — a subsumed child create entry stays on the undo stack

After the fix, one undo of an editor-created parent removes the parent and its pre-saved
subtasks together, but the subtask's own `Create 1 items` entry remains underneath on the
undo stack. A later undo pops it and `removeMany` no-ops on already-deleted ids, so there
is no visible corruption; the entry is simply stale. Removing it would require an undo-stack
API to delete a specific entry (the store only exposes push/pop/clear), which is outside this
item's smallest-change scope.

## INFO — subtasks of an unsaved parent still appear only after an immediate write

`ItemEditorSheet.addChild` still persists the child before the parent is saved. IMP-087
makes that safe for undo, so deferring child persistence (acceptance criterion 2's
fallback) was not needed. A future change that makes the child list draft-local would also
change the cancel-editor behavior (currently a cancelled draft keeps its added subtasks),
so it should be treated as a UX decision, not a bug fix.
