# discovered during IMP-024 — not fixed here

Observations from implementing the mobile bottom-nav scroll cue. All are out of scope for
IMP-024; recorded so they are not rediscovered.

## 1. The strip does not follow the active destination
`src/features/shell/MobileBottomNav.tsx` renders all ten links but never scrolls the strip
to the active one. If the user is scrolled to the left end and reaches a right-hand
destination by keyboard shortcut (`1`–`9`) or by any non-nav route change, the active link
(`aria-current="page"`) stays off-screen and the bar shows no active state. Observed:
after scrolling to the end and clicking through routes in order, Today/Calendar/Matrix/Lists
were off to the left of the visible strip while their `aria-current` was set.

Suggested fix (needs a decision, so it was not taken here): a `useLocation()` effect that
calls `scrollerRef.current.querySelector('[aria-current="page"]')?.scrollIntoView({ block:
'nearest', inline: 'nearest' })`. Note `scrollIntoView` is absent in jsdom, so a guard or a
test stub is required.

## 2. The spec's "mobile bottom-padding fix" note is stale
`.improve/FEATURES.md:727` says to pair IMP-024 with a mobile bottom-padding fix that was
"not promoted below", but the bottom padding already exists at `AppShell.tsx:208`
(`p-3 pb-24 sm:p-5 sm:pb-6`, present at HEAD as well). Either the note predates that change
or it refers to a different symptom. At 390px the fixed bar is 55px tall and `pb-24` (96px)
clears it, so nothing is obscured — verified in the browser.

## 3. Nav landmark naming is now asymmetric
The desktop rail's `<nav>` (`AppShell.tsx:119`) still has no accessible name, while the
mobile strip is `aria-label="Primary"`. Only one of the two is ever in the a11y tree
(`sm:hidden` / `hidden sm:flex`), so this is cosmetic, but a screen-reader user who resizes
the window sees the landmark appear and disappear with no name. Either label the rail too
or drop the label from the mobile strip.

## 4. Retained overflow is the one reading of AC1 that can look like a failure
At 390px `nav.scrollWidth` is still 564 vs `clientWidth` 390 — deliberately, because AC2
sanctions keeping the scroll when a cue is visible. A checker that asserts
`scrollWidth <= clientWidth` without also asserting the cue will report a false failure. If
a stricter non-scrolling layout is ever wanted, the smallest version is: keep the first five
`NAV_ITEMS` inline and render the remaining five in a `Sheet` opened from a `More` button
(the `Sheet` primitive already exists with a focus trap and Escape handling) — roughly the
same amount of code as the cue, but it puts three destinations behind a second activation
and out of the a11y tree until opened.

## 5. Verification footgun: the service worker serves the previous build
`npm run preview` on an already-visited origin keeps serving the precached bundle after a
rebuild; the page then shows the app's own "A new version is available" toast while the DOM
is the *old* build. During IMP-024 verification the first load measured the pre-fix nav
(`nav.scrollWidth = 564`, no cue, no `aria-label`) and looked like the fix had not landed.
Unregistering the service worker, deleting `caches['workbox-precache-v2-<origin>']`, then
reloading with a cache-busting query string serves the new build. Worth knowing for any
future Playwright check of a rebuilt bundle.