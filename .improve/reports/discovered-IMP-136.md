# Discovered during IMP-136

Findings unrelated to IMP-136 (not fixed here):

- **Stale SW precache masks a rebuild.** Against `npm run preview`, a previously visited
  origin served a pre-IMP-125 bundle whose `<main>` had no `id`, so `#main` selectors and
  the skip link silently targeted nothing until the origin's SW registrations and caches
  were cleared. This is the hazard AGENTS.md documents; worth a dev-only warning if cheap.
- **Two polite live regions.** `RouteFallback` and the new `RouteAnnouncer` both use
  `role="status"`; a lazy navigation can announce "Loading…" then the view name. Consider a
  single shared status region or `aria-busy` coordination (not required by IMP-136).
- **Calendar and Lists still have no `<h1>`** (IMP-152, TODO). IMP-136 falls back to
  `<main>`; once IMP-152 lands, focus will naturally move to the headings with no change to
  the announcer.
