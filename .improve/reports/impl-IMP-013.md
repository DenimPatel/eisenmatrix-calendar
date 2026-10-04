# IMP-013 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File                                    | Change                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/store/useUiStore.ts`               | New `OverlayState` interface (the four modal flags) + pure predicate `isOverlayOpen(state)`. Nothing else in the store changed. |
| `src/hooks/useKeyboardShortcuts.ts`     | Subscribes to `isOverlayOpen`; one guard `if (overlayOpen) return;` placed after the `⌘K`/`⌘Z` branches and the typing-target bail. `overlayOpen` added to the effect deps. |
| `src/hooks/useKeyboardShortcuts.test.tsx` (new) | 16 tests: 6 pure-predicate cases (no mount) + 10 behaviour cases driving real `keydown` events through the mounted hook. |

```ts
export interface OverlayState {
  commandOpen: boolean;
  quickAddOpen: boolean;
  shortcutsOpen: boolean;
  editor: EditorState;
}

/** Any modal layer that owns the screen; global shortcuts must stand down while one is up. */
export function isOverlayOpen(state: OverlayState): boolean {
  return state.commandOpen || state.quickAddOpen || state.shortcutsOpen || state.editor.open;
}
```

```ts
if (isTypingTarget(event.target)) return;
if (overlayOpen) return;
```

Two production lines of behaviour change; everything else is the selector.

### Design notes

- **Placement is the whole fix.** The guard sits *after* the `⌘K` and `⌘Z` branches, so undo keeps
  working inside an overlay (AC2) and `⌘K` keeps its deliberate "works even from inside a text
  field" behaviour. Everything gated behind it — `?`, `/`, `c`, `n`, `1`–`9` — is exactly the set
  of shortcuts that navigates or opens a *second* overlay.
- **`/` is gated even though no AC names it.** It opens the command palette, which is the same
  "second overlay on top" defect as `c`; leaving it ungated would have made `?` and `/`
  inconsistent. AC3 ("the sheet still opens with `?` **when no overlay is open**") implies `?` is
  meant to be gated too.
- **`⌘K` is left working.** It sits before the typing-target bail on purpose and no AC covers it;
  gating it would also remove a capability (jump to search from the editor's title field). Logged
  as a residual in `discovered-IMP-013.md` §1 for whoever wants strict modal semantics.
- **AC1 mentions "theme shortcuts" — none exist.** The theme toggle is a header button only, so
  there was nothing to suppress. Noted in `discovered-IMP-013.md` §2.
- **Selector over a derived object.** `isOverlayOpen` returns a `boolean` primitive, so using it
  directly as a zustand selector (`useUiStore(isOverlayOpen)`) cannot cause an identity churn /
  render loop. `OverlayState` is a structural subset of `UiState`, so contravariant assignment to
  the selector signature typechecks under `strict`.

## Acceptance criteria

1. **Nav/create shortcuts do not fire while any of the four overlays is up.** Unit-covered by the
   `it.each` cases: for each of `commandOpen` / `quickAddOpen` / `shortcutsOpen` / `editor.open`,
   the handler is driven with all of `1`–`9`, `c`, `n`, `?`, `/` and a snapshot of
   `{route, commandOpen, quickAddOpen, shortcutsOpen, editor.open, editor.item.id}` is asserted
   **unchanged** after every key. Using a snapshot rather than "is false" matters for the flag that
   was already true.
2. **`⌘/Ctrl+Z` still works from inside an overlay.** "still runs undo from inside an open overlay"
   opens the editor, then `⌘Z` from a non-input target asserts the entry ran, the stack emptied, and
   the `Undone` toast appeared. The companion test asserts undo still does *not* fire when the target
   is an `<input>` (AC2's "when the event target is not a typing field").
3. **`?` still opens the sheet with no overlay open.** "opens the shortcut sheet with ?" covers it;
   `2` → `/calendar`, `c` → quick add, `n` → new-task editor are pinned too, so the guard cannot
   regress the happy path.

## Tests

`src/hooks/useKeyboardShortcuts.test.tsx` — jsdom, 21 → 22 files, 140 → 156 tests, all passing.

- **Pure predicate (no mount):** false when all closed; true for each of the three boolean flags
  individually; true for the editor alone; false for a real store with a toast pushed (proves it
  reads only the overlay slice).
- **Hook behaviour:** the hook is mounted in a `MemoryRouter` inside a `Harness` that renders
  `useLocation().pathname`, and keys are dispatched as real `KeyboardEvent`s on `document`
  (same pattern as `CommandPalette.test.tsx` / `QuickAdd.test.tsx`; the handler is registered on
  `document`, so no target element is needed).

**Mutation check:** replacing the guard with `void overlayOpen` fails exactly the 4 suppression
tests (`it.each` × 3 + the editor case) and leaves the other 12 green — the suite pins the fix, not
the plumbing. Two earlier failures were my own bad expectations (I asserted `quickAddOpen === false`
in a test where I had just set it to `true`); the snapshot approach removed that class of mistake.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean, no new warnings) ·
`npm run test` (22 files, 156 tests passed) · `npm run build` (OK, `dist/sw.js` emitted, 18 precache
entries, 603.65 KiB) · `npx prettier --write` applied to the touched files.

## Browser verification (preview + Playwright)

`npm run preview` → `http://localhost:4173/eisenmatrix-calendar/`.

| Scenario | Expected | Seen |
| --- | --- | --- |
| Editor open (`n`), focus on the **Details** tab (a non-input inside the Sheet), then `1`–`9`, `c`, `n`, `?`, `/` | route unchanged, no new overlay | `prevented=false` for all 13; `location.hash` stayed `#/today` throughout; dialog count stayed `1` ("Untitled") |
| Editor open, focus on the **History** tab, `⌘Z` | undo runs | toast **"Undone"**; task reverted `1/1 done` → `0/1 done`; "What's next" row returned; editor stayed open |
| No overlay, `?` | sheet opens | dialog "Keyboard shortcuts" rendered with all 8 rows |

Console clean. Probe task deleted afterwards.

Caveat for re-verification: the already-open preview tab keeps serving the **old** bundle from the
service-worker precache — my first run reproduced the *original* bug against the fixed code and
showed a "A new version is available" prompt. Unregister the SW, delete `caches`, then do a **full**
reload (a hash-only navigation does not re-fetch). Same trap as `discovered-IMP-012.md` §3. The one
console 404 in my session came from my own dynamic-import probe, not the app.

## Notes for the verifier

- Out-of-scope findings, do not fold them into this item:
  `.improve/reports/discovered-IMP-013.md` — (1) `⌘K` can still stack the palette over an open
  sheet, (2) the spec's "theme shortcut" does not exist, (3) creating an item in the editor pushes
  no undo entry, (4) two dialogs can be open at once, so `Esc` closes both.
