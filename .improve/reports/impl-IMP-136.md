# IMP-136 — Per-route document title + view announcement

**Status:** done
**Date:** 2026-10-19

## Summary

Each of the 10 nav routes now sets a distinct `document.title` beginning with the view
name (e.g. `Calendar — EisenMatrix Calendar`), and a user-initiated view change moves focus
once to the new view's `<h1>` (or `<main>` when the view has no h1 yet) and announces the
view name through a visually-hidden polite live region. The initial load keeps the static
`<title>` and neither moves focus nor announces.

## Files changed

- `src/features/shell/nav.ts` — added `BASE_TITLE`, `RouteMeta`, `ROUTE_META` (derived from
  `NAV_ITEMS`) and `routeMetaFor(pathname)`. Titles/names stay colocated with the nav
  metadata so a new nav destination cannot drift from its title.
- `src/features/shell/routeChange.ts` (new) — pure helpers:
  - `planRouteChange(pathname, { previousPathname, overlayOpen, typingFieldFocused })`
    returns `{ title, announcement, moveFocus }`.
  - `isTypingElement(element)`.
- `src/features/shell/RouteAnnouncer.tsx` (new) — `RouteAnnouncer` component using
  `useLocation()`; applies the plan (writes `document.title`, focuses `#main h1`/`#main`,
  sets the live-region text) and renders only the visually-hidden `role="status"`
  `aria-live="polite"` region.
- `src/App.tsx` — mounted `<RouteAnnouncer />` inside `HashRouter`, as a sibling of
  `AppShell`, so it can read the location and is always present.
- `src/features/shell/routeChange.test.ts` (new) — pure tests.
- `src/features/shell/RouteAnnouncer.test.tsx` (new) — jsdom tests.

No view was touched: views without an `<h1>` (Calendar, Lists — IMP-152) fall back to
`<main>`, so requirement 3 (no visible UI change) holds and IMP-152 is not implemented.

## Approach

- Route metadata is derived from the existing `NAV_ITEMS`, guaranteeing one distinct title
  per destination and a safe `null` for unknown routes (`/`, `/nope`) — no fallback title is
  written, leaving the static `<title>` in place.
- `planRouteChange` is pure and encodes the policy:
  - no action on the first render (`previousPathname === null`);
  - no action when the pathname is unchanged — this also absorbs React StrictMode's
    double-invoked effect, which must not announce the landing view;
  - no action on the initial root redirect (`/` → `/today`), which is part of the initial
    load;
  - no action for unknown routes;
  - otherwise set the title, announce the name, and move focus unless an overlay is open or
    a typing field is focused.
- `RouteAnnouncer` keeps the previous pathname in a ref and only mutates the DOM inside
  `useEffect` keyed on `pathname`. `focusView()` adds `tabindex="-1"` to the heading before
  focusing, because a heading is not focusable without it (`<main>` already carries it).
- Back/forward are handled for free: history navigation changes `useLocation().pathname`, so
  the effect re-runs and restores the matching title.

## Tests

`src/features/shell/routeChange.test.ts` (node):
- `route metadata > maps every nav destination to a distinct title starting with its view name`
- `route metadata > returns null for unknown routes`
- `planRouteChange > does nothing on the first render`
- `planRouteChange > does nothing when the pathname is unchanged (StrictMode re-run)`
- `planRouteChange > does nothing on the initial root redirect`
- `planRouteChange > falls back safely for an unknown route`
- `planRouteChange > sets the title, announces the view and moves focus on a real navigation`
- `planRouteChange > keeps announcing but does not move focus while an overlay is open`
- `planRouteChange > keeps announcing but does not steal focus from a typing field`
- `isTypingElement > is false for null`

`src/features/shell/RouteAnnouncer.test.tsx` (jsdom):
- `leaves the title, focus and live region untouched on first paint`
- `sets the route title, focuses the heading and announces the view`
- `falls back to focusing main when the view has no heading yet`
- `does not steal focus from an open overlay but still announces`
- `does not steal focus from a typing field`

## Commands and results

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass (no output) |
| `npm run lint` | pass (no output) |
| `npm run test` | 74 files, 722 tests passed |
| `npm run format:check` | All matched files use Prettier code style |
| `npm run build` | built OK; `dist/sw.js` generated |

### Browser verification (preview build, port 4174)

Reset the origin's service worker + caches per AGENTS.md before checking the rebuilt bundle
(the stale precache otherwise served a pre-IMP-125 bundle whose `<main>` had no `id`).

- Initial load at `#/today`: `document.title === 'EisenMatrix Calendar'`, live region empty,
  `document.activeElement === BODY`. ✔ (criterion 2, no focus/announce on load)
- Clicked all 10 nav links; every route set its title and updated the live region:

  | route | title | focus |
  | --- | --- | --- |
  | calendar | `Calendar — EisenMatrix Calendar` | MAIN (no h1) |
  | matrix | `Matrix — EisenMatrix Calendar` | H1 |
  | lists | `Lists — EisenMatrix Calendar` | MAIN (no h1) |
  | goals | `Goals — EisenMatrix Calendar` | H1 |
  | habits | `Habits — EisenMatrix Calendar` | H1 |
  | bills | `Bills — EisenMatrix Calendar` | H1 |
  | shopping | `Shopping — EisenMatrix Calendar` | H1 |
  | notes | `Notes — EisenMatrix Calendar` | H1 |
  | settings | `Settings — EisenMatrix Calendar` | H1 |
  | today | `Today — EisenMatrix Calendar` | H1 |

  Live region text equalled the view name each time. ✔ (criteria 1, 2)
- Back navigation (`history.back`) restored `Settings — EisenMatrix Calendar`. ✔ (criterion 1)
- With the Quick-add overlay open (focus inside the dialog input), a hash change to `#/matrix`
  set the title and live region to `Matrix` but left focus inside the overlay. ✔ (focus guard)
- 0 console errors/warnings.

## Uncertainties / notes

- A fresh deep link (full page load) to a non-landing route keeps the static
  `<title>` (`EisenMatrix Calendar`) and does not announce, matching discovery criterion 3
  ("The initial load keeps the current title") and the implementation guidance ("Preserve
  the existing static `<title>` for the initial load"). The per-route title is applied on
  the first route change. The initial root redirect (`/` → `/today`) is treated the same
  way, so a PWA launch at `start_url` does not announce.
- `RouteAnnouncer`'s live region is a second `role="status"` alongside `RouteFallback`; during
  a lazy chunk load the fallback may announce "Loading…" before the view name. Both are
  polite and sequential, so this is acceptable but not deduplicated.
- Focus falls back to `<main>` for Calendar and Lists because neither renders an `<h1>`
  (IMP-152, explicitly out of scope).
