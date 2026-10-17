# Impl — IMP-059: Focus overlays in the mount commit, not 20 ms later

## Files changed
- `src/hooks/useFocusTrap.ts`
- `src/hooks/useFocusTrap.test.tsx`

## Approach
- Swapped the overlay setup effect from `useEffect` to `useLayoutEffect`, so initial
  focus runs synchronously in the same commit that mounts the overlay.
- Removed the `window.setTimeout(focusInitial, 20)` deferral and the matching
  `clearTimeout` cleanup. No timer remains whose late callback could steal focus after
  unmount.
- Left the captured `previouslyFocused` restore, the keydown Tab loop, and the effect
  dependencies (`active`, `initialFocus`) unchanged.
- Added a jsdom test that mounts the trap with `act` and asserts the initial ref is
  focused immediately, without any timer wait/advance. The existing tests still cover
  first-focusable fallback, Tab wrapping, and focus restore on close.

## Commands / results
`npm run typecheck && npm run lint && npm run test` — all pass.
- typecheck: no diagnostics
- lint: no output
- test: 33 files / 343 tests passed (baseline 342; +1 new test)

## Uncertainty
- Nothing observed. `useLayoutEffect` warns in SSR, but this app is a client-only Vite
  SPA with no SSR path, and the hook only runs in overlay components.
- `.improve/FEATURES.md`, `.improve/PROGRESS.log`, and `.improve/STATE.md` were already
  modified in the working tree; they were not touched by this change.
