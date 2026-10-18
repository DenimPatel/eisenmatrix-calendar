# IMP-094 — Keep body scroll locked while any modal layer remains

**Status: done.** Branch `improve/auto-20261017`.

## Root cause

`Dialog` and `Sheet` each owned `document.body.style.overflow` inside their keydown
effect: opening wrote `'hidden'`, and the cleanup unconditionally wrote `''`. With the
IMP-079 overlay stack, closing the top layer (e.g. the command palette over the editor
sheet) restored `''` while the lower layer was still open, unlocking background scroll.
Because the restore was hardcoded to `''`, it also clobbered any pre-existing overflow
value.

## Change

New `src/hooks/useBodyScrollLock.ts`: a module-level reference count. The first active
layer captures the current `document.body.style.overflow` (normalized: a pre-existing
`'hidden'` is remembered as `''`) and sets `'hidden'`; the last active layer restores the
captured value. `Dialog` and `Sheet` now call `useBodyScrollLock(open)` instead of
writing `overflow` in their own effects; the keydown effect only handles Escape.

`src/hooks/useBodyScrollLock.test.tsx` (new, jsdom): two lockers hold the lock until the
second deactivates, then restore a prior `'scroll'`; a pre-existing `'hidden'` normalizes
to `''` on unlock; unmount releases without a deactivation render.

`src/components/ui/Dialog.test.tsx`: new case mounting the two stacked store dialogs
(quick add + command palette) with a prior `'scroll'` value, asserting `'hidden'` while
both are open, still `'hidden'` after closing only the top layer, and `'scroll'` once the
last layer closes.

## Verification

```
npm run typecheck    PASS
npm run lint         PASS
npm run test         PASS  45 files / 501 tests (baseline 44/497, +1 file, +4 tests)
npm run format:check PASS
npm run build        PASS  dist/sw.js, 18 precache entries (628.00 KiB)
```

Browser (production preview, SW + caches reset first): `C` (quick add) then `Meta+K`
(command palette) → `document.body.style.overflow === 'hidden'` with two dialogs; one
`Escape` closed the palette only and kept `'hidden'` with Quick add still mounted; the
second `Escape` closed it and restored `''`. Console: 0 errors, 0 warnings.

## Files

- `src/hooks/useBodyScrollLock.ts` (new)
- `src/hooks/useBodyScrollLock.test.tsx` (new)
- `src/components/ui/Dialog.tsx`
- `src/components/ui/Sheet.tsx`
- `src/components/ui/Dialog.test.tsx`
- `.improve/reports/impl-IMP-094.md`

No store, schema, dependency or migration changes. The first preview run showed the old
independent-effect behavior because the browser served the previous bundle from the
service-worker precache; after the documented SW/cache reset the new behavior held.
