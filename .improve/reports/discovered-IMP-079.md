# Discovered while implementing IMP-079

## 1. Closing the top overlay releases the surviving overlay's body scroll lock

`Dialog` and `Sheet` each set `document.body.style.overflow = 'hidden'` on open and reset it
to `''` in their own effect cleanup (`src/components/ui/Dialog.tsx`,
`src/components/ui/Sheet.tsx`). With IMP-079's stack, closing the top layer while a lower
layer stays open runs the top layer's cleanup and unlocks body scroll even though a modal is
still on screen. Before IMP-079 this was mostly masked because one Escape closed every
layer; it is now reachable by design (editor + command palette).

Repro (preview): open the editor (`n`), open the palette (`⌘K`), press Escape once. The
editor remains open but `document.body.style.overflow` is `''`.

Suggested fix (not done: out of scope): reference-count active modal layers (or derive the
lock from `overlayStack.length > 0`) and only clear `body.style.overflow` when the last layer
closes. Needs a regression test for the stacked case.
