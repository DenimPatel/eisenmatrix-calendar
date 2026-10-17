# discovered-IMP-027 — findings noticed while fixing IMP-027 (not fixed)

## 1. `Dialog` without title or description renders no close button

`src/components/ui/Dialog.tsx:80` renders the header (including the "Close dialog" `Button`)
only when `(title || description)` is truthy. A caller that passes only `children` gets a
dialog with no visible close control (Escape and backdrop click still work). This change now
gives that case an accessible name (`Dialog` or `ariaLabel`), but the missing close button is
untouched. All current call sites pass a title, so this is latent.

## 2. Accessible-name assertions are hand-rolled because the test stack lacks a name resolver

There is no `@testing-library/dom` / `dom-accessibility-api` dependency, so the new tests
resolve `aria-labelledby`/`aria-describedby` manually rather than through
`computeAccessibleName`. This is enough for the primitives' contract but would not catch a
regression where the referenced node renders no text. Adding `dom-accessibility-api` (or
testing-library) would make future a11y tests stronger; out of scope for this item's no-new-
dependencies rule.
