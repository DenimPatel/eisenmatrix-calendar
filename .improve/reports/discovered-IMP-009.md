# Discovered findings — IMP-009 implementation

Out-of-scope observations made while implementing IMP-009. Nothing here was changed.

## D1 — A stale service worker can make a correct fix look broken (verification hazard)

`npm run preview` serves the previously-installed service worker until it is unregistered. After
rebuilding, the first Playwright pass still reported the Close button as focused because the SW
precache (`workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/`) served the previous
`index-*.js`; the page even showed the in-app "A new version is available" prompt. Clearing it:

```js
const regs = await navigator.serviceWorker.getRegistrations();
await Promise.all(regs.map((r) => r.unregister()));
await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
```

then reloading reproduces the real behaviour. Also note the harness detail: a synthetic `keydown`
dispatched on `document` never reaches the trap container (the event cannot propagate down from
`document`), so Tab-wrap checks must dispatch on `document.activeElement`.

Not a product defect — but any future verifier that opens overlays against a `preview` build after
another build may report a false regression.

## D2 — Overlays without an `initialFocusRef` still focus their Close button

`ConfirmDialog` / `SettingsView` dialogs and `ShortcutSheet` (`src/features/shell/ShortcutSheet.tsx`,
a `Dialog` opened with `?`) do not pass an `initialFocusRef`, so they keep the old behaviour. That is
the documented default and no acceptance criterion covers them, but if the intent is "no overlay
opens on its Close button", the shortcut sheet is the one remaining case and needs a target (or a
`tabIndex={-1}` heading).

## D3 — Initial focus still lands on a 20ms timeout

`useFocusTrap` focuses through `window.setTimeout(focusInitial, 20)` (pre-existing, not touched).
For a few frames focus is still on `<body>` after the overlay mounts. Removing the overlays'
`autoFocus` (required for the focus-restore fix documented in the impl report) means the delay is now
user-visible to very fast keystrokes and to automated checks that assert focus in the same tick.

## D4 — jsdom cannot exercise the focus trap's Tab loop unmodified

`useFocusTrap`'s handler filters candidates with `el.offsetParent !== null`, and jsdom always returns
`null`, so any test of Tab trapping must shim
`Object.defineProperty(HTMLElement.prototype, 'offsetParent', …)`. Doing so in one shared setup file
would let any future a11y test reuse it; for now the shim is local to
`src/hooks/useFocusTrap.test.tsx`.