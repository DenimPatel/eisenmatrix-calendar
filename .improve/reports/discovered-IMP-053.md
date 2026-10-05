# Discovered findings — IMP-053

Out-of-scope observations made while implementing IMP-053. None are regressions; none are
addressed by that change. Recorded here rather than fixed.

## D1 — Month cell expansion is one-at-a-time by design, not by accident

`CalendarView.tsx` tracks `expandedDay: string | null`, so expanding a second day collapses
the first. I chose this deliberately (a month cell is ~6.5rem inside a fixed 7-column grid;
letting several expand blows out every row on screen). It is a UX tradeoff, not a bug: a user
comparing two busy days must collapse one before opening the other. If a verifier or a later
item wants independent per-day state, the change is `useState<Set<string>>` plus
`new Set(prev)` in the toggle — no other call site changes.

**Not filed as a backlog item** — the current behavior is defensible and IMP-053 did not ask
for multi-cell expansion.

## D2 — Year cards are independent, month cells are not (inconsistent by nature)

Because `YearMonthCard` is its own component with its own `expanded` state, year cards expand
independently while month cells do not. This asymmetry is unavoidable given the component
split (one shared grid vs. 12 sibling cards) and matches how each view is laid out, but it is
worth knowing if the affordance is ever unified behind a single store flag.

## D3 — The `+N more` control is a `<button>` inside a dnd-kit `Droppable`

Month cells render the toggle inside `<Droppable>`, which is a drop target. The click handler
is on the button and dnd-kit's sensors require a drag before activating, so no conflict
observed in the browser (all activations were clean clicks and Enter presses). Noting it
because a future change that makes the cell itself clickable could collide with the drag
gesture. `Droppable` renders no click handler today.

## D4 — Stale service-worker precache masks source changes during verification

This cost real verification time and will do so again. `vite-plugin-pwa` uses
`injectManifest` with `registerType: 'prompt'`; after `npm run build`, the installed worker
serves the **previous** `dist` bundle from `workbox-precache-v2-*` and shows an
"A new version is available" toast. Deleting the Cache Storage entry from inside the page
is **not** sufficient — the already-installed worker re-serves the old assets. A full browser
close/reopen (fresh context) is what actually forces the new bundle.

Consequence for any future UI item in this repo: an apparently-unchanged page after a rebuild
is a verification artifact, not evidence the change is absent from `dist`. Confirm with
`grep '<new copy>' dist/assets/index-*.js` before concluding the change did not land.

Not filed as an item because the app's PWA behaviour is intentional and correct for
end users; this is purely a local-verification workflow hazard.

## D5 — `parseLocalDate(occ.occKey)?.getDate()` in the year card renders as a bare number

`YearMonthCard` prints the day-of-month with no month context, so in the year view a row reads
`20IMP053 probe alpha` — the accessible name has no separator between the day number and the
title (visible in the Playwright snapshot). Pre-existing; IMP-053 only changed the sibling
`+N more` element. A space or `·` separator, or a `title="<full date> — <title>"` attribute
alongside it, would fix the announcement. Left alone as out of scope.
