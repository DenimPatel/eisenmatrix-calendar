# IMP-079 — Implementation report

**Status:** implemented
**Branch:** `improve/auto-20261017`

## Change

Added a shared overlay layer stack so Escape acts on exactly one overlay.

| File | Change |
| --- | --- |
| `src/store/useUiStore.ts` | New `overlayStack: string[]` plus `registerOverlay`, `unregisterOverlay` and `isTopOverlay(id)` actions. The stack records open overlay instances in mount/open order; the last entry is the topmost layer. |
| `src/hooks/useOverlayLayer.ts` | New hook: assigns a stable per-instance `useId`, pushes it onto the store stack while `active`, removes it on close/unmount, and returns a stable `isTop()` predicate that reads the live store stack. Registration deliberately does not depend on `onClose`, so a lower layer re-rendering with a new inline callback cannot jump above the layer opened after it. |
| `src/components/ui/Dialog.tsx` | Escape now calls `onClose` only when `isTopOverlay()` is true. |
| `src/components/ui/Sheet.tsx` | Same change; the Sheet shares the stack with Dialog, so mixed stacks work. |
| `src/components/ui/Dialog.test.tsx` | Two new jsdom tests: two store-controlled Dialogs and a Dialog over a Sheet. Each presses Escape twice and asserts one layer closes per press, focus returns into the surviving layer, and the underlying open flag stays true. Store state is reset in `afterEach`. |

`useKeyboardShortcuts` was not modified: the `⌘K` branch still runs before the typing/overlay
guards, so the palette remains reachable from the editor's title field (IMP-013 / AC4), and
stacking remains reachable.

Layer order comes from the order overlay components mount / flip `open` to true, which
matches DOM paint order (the later layer is rendered later and painted on top). Focus return
is provided by the existing `useFocusTrap` cleanup: when the top layer unmounts it restores
the element that was focused when it opened, which is inside the layer below.

## Acceptance criteria

1. **Two overlays, one Escape closes only the top** — verified in jsdom and in the preview
   build. The remaining overlay stays open and focus returns into it (asserted as the
   surviving dialog's title heading).
2. **One overlay, Escape still closes it** — existing `ConfirmDialog`, `CommandPalette` and
   `QuickAdd` Escape tests still pass unchanged.
3. **Store gains a most-recently-opened notion** — `overlayStack` in `useUiStore`; Dialog and
   Sheet decide topmost via `isTopOverlay(id)` rather than by their independent booleans.
4. **`⌘K` from a text field still opens the palette** — `useKeyboardShortcuts` untouched;
   verified in the browser from the editor's title input.

## Verification

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test` — 42 files / **445 tests** pass (baseline 443; +2 new cases).
- `npm run build` — pass (`dist/sw.js` generated, 18 precache entries).
- Preview (port 4173, service worker/caches reset first): `n` opened the editor with focus
  in the title input; `⌘K` produced two dialogs (`Untitled`, `Command palette`); the first
  Escape left only `Untitled` open with focus back in the "What is it?" title input; the
  second Escape closed it. Console: 0 errors/warnings.

No new dependencies, no comments added, no formatting churn.
