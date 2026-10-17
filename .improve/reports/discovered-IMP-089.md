# Discovered findings — IMP-089

Out-of-scope observations made while implementing IMP-089. Nothing here was fixed.

## 1. Habit `toggleDone` streak write is still a separate non-atomic read/patch

**Where:** `src/domain/itemActions.ts` (`toggleDone`, after the `setStatus` call).

`setStatus` is now atomic, but the habit branch then re-reads the row and calls `patchItem` with
the derived `data.streak`. Two unawaited habit toggles can both read the occurrence state before
either streak write lands; each writes a streak computed from its own snapshot. Undo count is
unaffected (`trackUndo: false`), but the persisted streak is last-writer-wins. This is outside
IMP-089's scope (occurrence status records), but the same transactional shape could later cover
the derived write if concurrent habit toggles become reachable in the UI.

## 2. Other occurrence edits keep read-then-write semantics

**Where:** `src/domain/itemActions.ts` (`updateRecurring`, `skipOccurrence`), `saveItem`,
`patchItem`.

These still read the row and then call `patchItem`, which re-reads and writes separately.
Concurrent calls can drop sibling edits in the same way IMP-089 fixed for `setStatus`. No current
UI path fires them concurrently, so this was left unchanged to keep the fix targeted.
