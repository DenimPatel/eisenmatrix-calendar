# Discovered findings — IMP-013

Out-of-scope observations made while implementing IMP-013. **Not** fixed; none are regressions from
this item (all reproduce on the parent commit `4f4b361`).

## 1. `⌘K` can still stack the command palette over an open Sheet

**Where:** `src/hooks/useKeyboardShortcuts.ts` — the `meta + k` branch runs before the
`isOverlayOpen` guard.

Press `⌘K` with the item editor open and the palette opens on top of it. Both are `Dialog`s with
`role="dialog"` at `z-50`, so they overlap and either one's focus trap is live.

**Why it was left alone:** no acceptance criterion covers `⌘K`, and the branch deliberately sits
*before* the `isTypingTarget` bail so the palette is reachable from inside a text field (e.g. the
editor's title input). Gating it on `isOverlayOpen` would be a one-line change but would also remove
that capability — a product decision, not a bug fix.

**Repro:** Today → `N` → editor opens → focus the title field → `⌘K` → two dialogs on screen.

## 2. The spec's "theme shortcut" does not exist

IMP-013 AC1 says "navigation/create/theme shortcuts do not fire". There is no theme binding in
`useKeyboardShortcuts`; the theme toggle is a header button (`AppShell.tsx:183`). Nothing to
suppress, so AC1's theme clause is vacuously satisfied. Flagging in case the spec was written
against an intended shortcut that was never implemented — `Shift+D`/`T` would be a plausible binding
if that behaviour is wanted.

## 3. Creating an item in the editor pushes no undo entry

**Where:** `src/domain/itemActions.ts:69` `saveItem`.

```ts
if (existing) { pushUndo(`Edit "${item.title}"`, …); }
// no pushUndo on the create branch (itemRepo.create at :76)
```

Creating a task via the editor (`N` → type a title → Save) is therefore **not** undoable, while
`createItemPersisted` (Quick add, Matrix cards) is. My browser verification hit this directly: I
saved a new task, pressed `⌘Z`, and nothing happened — the stack was empty, not the shortcut broken.

Related and already-known, but adjacent enough to matter here: the undo entry that *is* pushed for
edits re-`create`s the previous row (`itemRepo.create(existing)`), which does not undo deletions of
children.

## 4. Two dialogs can be open at once, and `Esc` closes both

`Dialog` registers its own `document`-level `keydown` listener for `Escape` per open instance
(`src/components/ui/Dialog.tsx:41-51`). With two dialogs stacked (reachable today via finding 1, or
by clicking the header search button while a Sheet is open — the backdrop is `z-50`, the header is
`z-30`, but the Quick add / palette buttons are still reachable while the *editor* Sheet is open if
it has not yet covered them), one `Esc` closes both because both listeners fire.

This is a consequence of the overlay set not being mutually exclusive: nothing in the store clears
the other flags when one opens. A single `Escape` handler that closes the top-most overlay, or
mutual exclusion on open, would fix it.

## 5. (Verification note, not a defect)

The already-open preview tab serves the **stale** bundle from the SW precache. My first Playwright
run against the fixed build reproduced the *original* bug (route changed to `#/notes`, quick add
opened behind the editor) purely because of this. Unregister the service worker, delete `caches`,
then perform a **full** reload — navigating by hash alone does not re-fetch the bundle. Same trap
recorded in `discovered-IMP-012.md` §3.
