# Discovered while implementing IMP-057

Out-of-scope observations from the IMP-057 pass. None are regressions; none were fixed.

## 1. The "Import complete" dialog has no first field (spec premise)

`SettingsView.tsx:310-323` — the import dialog body is one `<p>` report; there is no input, select or
textbox. The only controls are Close and Done. IMP-057's criterion 3 ("the first field for the
import dialog") cannot be satisfied literally; Done was used instead. If a future import flow gains
fields, that target should be revisited.

## 2. Focusing the heading inside an `aria-label`led dialog may double-announce

`Dialog.tsx:66` sets `aria-label={title}` while also rendering an `<h2>{title}</h2>`. With initial
focus now on that heading (ShortcutSheet), a screen reader can announce the dialog name and then the
heading text. Two cleaner long-term options, both out of scope here:

- focus the dialog container (`tabIndex={-1}` on the `role="dialog"` node) instead of the heading, so
  the accessible name is announced once; or
- switch the dialog to `aria-labelledby` pointing at the heading's id, making the heading the single
  name source (needs generated ids).

## 3. `Sheet` has no `titleRef` equivalent

`src/components/ui/Sheet.tsx` renders its own `<h2>` title with the same shape as `Dialog`, but has no
`titleRef`. It is not a live defect — `ItemEditorSheet` is the only `Sheet` consumer and already
focuses its Title input — but any future `Sheet` that wants to focus its heading must extend
`SheetProps` the same way `DialogProps` was extended here.

## 4. `useFocusTrap` silently ignores a stale initial ref

`useFocusTrap.ts:20-21` — if `initialFocusRef.current` is set but no longer inside the container
(the node unmounted before the 20 ms timer fires), the code falls through to the first focusable with
no signal. That is the right behaviour here, but it means a mistyped ref looks like "no ref" rather
than an error. A dev-only `console.warn` would catch it; not worth the noise for one call site.

## 5. Stale-SW / hash-navigation trap during browser verification

`page.goto` to a URL that differs only in the hash does **not** reload the document, so a rebuilt
bundle is not picked up and a stale service worker keeps serving the old precache. To verify a fresh
build: unregister service workers, delete `workbox-precache-v2-*`, then `location.reload()`. This
extends the procedure noted in `.improve/reports/discovered-IMP-009.md`.

## 6. Not re-checked

Dark theme and the 390 px layout for these three overlays. The change adds no colour or layout
class, and the overlays were visually identical before and after, so this was judged unnecessary;
flagging it in case the verifier wants the extra coverage.
