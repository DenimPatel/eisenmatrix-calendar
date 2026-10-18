# Verify IMP-094 — Keep body scroll locked while any modal layer remains

**Verdict: PASS** (independent review; no source changes made by the reviewer)

Reviewed `git diff` + untracked files at HEAD `809d217`:

- `src/hooks/useBodyScrollLock.ts` (new)
- `src/hooks/useBodyScrollLock.test.tsx` (new)
- `src/components/ui/Dialog.tsx`, `src/components/ui/Sheet.tsx`
- `src/components/ui/Dialog.test.tsx`
- `.improve/reports/impl-IMP-094.md`

## Acceptance criteria

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Scroll lock ref-counted (or derived from `overlayStack.length`) so closing one of two layers keeps the body locked | PASS | `useBodyScrollLock.ts:3-24` module-level `lockCount`; `Dialog.tsx:50` / `Sheet.tsx:38` call it; the keydown effects no longer touch `overflow`. `Dialog.test.tsx:303-322` and `useBodyScrollLock.test.tsx:46-73` assert `hidden` after the first of two layers closes. |
| 2 | Closing the last layer restores the *prior* body overflow value | PASS | First lock captures `normalizeOverflow(document.body.style.overflow)` and the last cleanup writes it back (`useBodyScrollLock.ts:13-22`). Tests use a prior `'scroll'` and assert `'scroll'` after the final close; a pre-existing `'hidden'` is normalized to `''` per the item note. |
| 3 | A test covers stacked open/close order and the final unlock | PASS | New case mounts the two stacked store dialogs (quick add + command palette) and asserts `hidden` → close top → `hidden` → close last → prior value (`Dialog.test.tsx:303-322`), plus a 3-case hook suite. |

## Independent checks requested

- **Other modal-like components bypassing the hook:** none. The only overlay primitives in `src` are `Dialog.tsx:67,74` and `Sheet.tsx:55,62` (`fixed inset-0` / `role="dialog"`); every consumer routes through them — QuickAdd, CommandPalette, ShortcutSheet, ConfirmDialog → `Dialog`; ItemEditorSheet → `Sheet`. A grep for `body.style` / `overflow` outside tests finds only the new hook (plus unrelated `documentElement` nav-height and theme vars). Both primitives import the same `@/hooks/useBodyScrollLock` specifier, so there is a single counter instance.
- **Unmount-during-StrictMode double effects do not leak a count:** verified. `src/main.tsx:11` wraps the app in `StrictMode`. I ran a throwaway jsdom test (created then deleted, tree left clean) mounting the lockers inside `StrictMode` with a prior `'scroll'`: single locker → `hidden` on mount and `'scroll'` after unmount; two lockers → `hidden` until both deactivate; remount cycle → `hidden`/`''` with no residual lock. All 3 assertions passed. The `useEffect` deps are `[active]` only, and cleanup is paired with each effect run, so the mount/cleanup/mount double-invoke nets to one held lock and releases on unmount.
- **HMR-safe:** acceptable. Module-level `lockCount`/`restoreOverflow` reset on a hot module replacement while locked, which would orphan `overflow: 'hidden'`; because the app never sets a non-empty `body.style.overflow` itself and `normalizeOverflow` maps `'hidden'` → `''`, the next open recaptures `''` and the state self-heals on the following close. Dev-only, no production impact.

## Gates (run by reviewer, current tree)

```
npm run typecheck    PASS
npm run lint         PASS
npm run test         PASS  45 files / 501 tests
npm run format:check PASS
npm run build        PASS  dist/sw.js, 18 precache entries (628.00 KiB)
```

Matches the impl report's numbers (baseline 44/497 → 45/501).

## Non-blocking observations

1. `restoreOverflow` is a single module variable captured only at `lockCount === 0`; correct for LIFO/FIFO close orders and StrictMode, but an external writer of `body.style.overflow` mid-lock would be clobbered. Not reachable in this app.
2. The new hook test's `afterEach` clears `innerHTML` but does not unmount React roots on failure, so a failing assertion could leave `lockCount` elevated for later tests in that file. Cosmetic test hygiene only.
3. `.improve/FEATURES.md:1497-1511` still lists IMP-094 as `TODO`; the status flip is a backlog/session-state step outside this diff, not a code defect.

No S0/S1 issues. No regressions found in the reviewed change.
