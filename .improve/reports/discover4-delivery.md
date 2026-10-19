# Discovery 4 — Delivery / Performance / Accessibility Audit

Scope: the built `dist/` bundle served by `npm run preview` at
`http://localhost:4173/eisenmatrix-calendar/` — all 10 routes (Today, Calendar, Matrix, Lists,
Goals, Habits, Bills, Shopping, Notes, Settings) plus Quick add, the item editor, the command
palette, the shortcut sheet and Help. Read-only on `src`; no source or state file was edited.
Evidence: `.improve/artifacts/discover4/` (raw JSON probes, an AX snapshot and screenshots).

Method: CDP `Accessibility.getFullAXTree` for names/roles/states and heading structure (not
just source attributes), `PerformanceObserver` for `longtask` and `layout-shift`, the
Navigation/Resource Timing APIs for payload and route timing, and a head/static-file probe of
`dist/`. Databases used: an empty DB, a 26-item fixture and a 580-item fixture (seeded directly
into the shared `eisenmatrix` IndexedDB; churn announced on the board). Overlays were checked in
the accessibility tree with the modal open, and all overlay states were re-read after the DOM
settled so transient renders were not reported as defects.

Existing items were reviewed first. IMP-047 (PNG icons), IMP-067 (branch protection), IMP-034
(license), IMP-091 (mobile List header), IMP-106/108/109 (visual TODOs) and the discover4-visual
findings V1–V10 (including V10's `text-muted`-on-`accent-soft` 4.26:1) are **not** re-proposed.
IMP-133 (route splitting), IMP-131 (year view) and IMP-132 (editor analytics) were re-measured and
still hold.

## What is already healthy (measured, no item raised)

- **Deep link + refresh works on every route.** Hard navigation to `/eisenmatrix-calendar/#/<route>`
  for all 10 routes rendered with zero page errors (`HashRouter`).
- **Offline reload works.** After SW activation, network-off reloads of Today, Calendar and
  Settings all rendered with no errors; the precache holds 24 entries including all nine lazy view
  chunks, so a route works offline even if it was never visited online.
- **Stale-SW handling exists.** `registerType: 'prompt'` plus `src/pwa/register.ts:11-19` shows a
  persistent "A new version is available" toast with a Reload action.
- **No mixed content.** No external `http(s)` resource is referenced from `src/` or `public/`.
- **Route transitions are cheap.** 31–98 ms and zero long tasks for 9 of 10 routes with 580 items;
  Calendar month/week/day/year switches take 11–13 ms (IMP-131 holds).
- **Editor typing is smooth.** Opening the editor takes 40 ms; typing 51 characters produced no
  long tasks (IMP-132 holds).
- **Interactive names/roles are complete at route level.** Zero unnamed buttons/links/inputs on any
  route; `[role=switch]` exposes `aria-checked`; the active nav link carries `aria-current="page"`;
  zero dangling ARIA idrefs; the toast live region receives messages; the Quick add dialog's
  `aria-labelledby`/`aria-describedby` both resolve.
- **Focus visibility and reduced motion are respected.** All 18 Tab stops on Today are visible with
  a 2 px outline + accent ring (skip link first); `src/styles/index.css:68-77` neutralises
  animation/transition durations and the spinner uses `motion-safe:animate-spin`.
- **Small-text contrast passes in dark mode.** 17 unique ≤12 px text nodes on Today measured ≥4.5:1.

---

### IMP-A2 — Update the document title and announce the view when the route changes

- **Status:** TODO
- **Area / files:** `src/App.tsx:70-92` (`RoutedViews`; no title/announcement effect),
  `src/features/shell/AppShell.tsx:140-160` (nav links), `index.html:13` (static `<title>`)
- **Evidence:** `.improve/artifacts/discover4/a11y-ax-audit.json` (`documentTitlePerRoute`,
  `routeChange`). `document.title` is `EisenMatrix Calendar` on all 10 routes; there is no
  `document.title` write anywhere in `src/` (grep). Clicking the Calendar nav link leaves
  `document.activeElement` on the link and both `aria-live` regions empty, so nothing tells a
  screen-reader user the view changed. `RouteFallback` announces only the *pending* state.
- **Intent:** a hash-routed SPA has no document navigation, so title + an announcement are the only
  cues that a new view loaded; today every route is indistinguishable to AT and to browser history.
- **Acceptance criteria:**
  1. Each of the 10 routes sets a distinct `document.title` that starts with the view name
     (e.g. `Calendar — EisenMatrix Calendar`), restored on back/forward.
  2. Navigating between views moves focus to the new view's heading (or `<main>`) once, without
     trapping it, and announces the view name through a live region.
  3. The initial load keeps the current title and does not announce on first paint.
- **Verification method:** Playwright: for each route assert `document.title` differs and matches the
  view; click each nav link and assert `activeElement` is the view `<h1>`/`<main>` and the live
  region text equals the view name. Run the four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/5/5 (score 15) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-125 added a skip link and an addressable `<main>` but no per-route
  title or route-change announcement, and no item mentions `document.title` at all.

### IMP-D1 — Ship Open Graph and Twitter Card metadata so shared links preview

- **Status:** TODO
- **Area / files:** `index.html:1-14` (head), `dist/index.html:1-25` (built head)
- **Evidence:** `.improve/artifacts/discover4/delivery-probe.json` (`headTags`). The built head has
  `description`, `theme-color`, favicon and `apple-touch-icon` only: **no** `og:title`,
  `og:description`, `og:type`, `og:url`, `og:image`, `twitter:card` or `canonical`. There is no
  raster image in `dist/` at all, so an `og:image` would have to be added.
- **Intent:** the README and the Pages URL are the only distribution channel; pasting the link into
  chat, Slack, an issue or a social post currently renders a bare URL with no title or description.
- **Acceptance criteria:**
  1. The built `dist/index.html` contains `og:title`, `og:description`, `og:type`, `og:url` and
     `twitter:card`, with `og:url` equal to the Pages URL including the base path.
  2. A social preview image is referenced (an `og:image` file that exists in `dist/`, or the
     existing SVG icon where no raster is available) and its URL is absolute.
  3. `og:title`/`og:description` match the `<title>`/`<meta name="description">` values.
- **Verification method:** `npm run build` then assert `grep -c 'property="og:' dist/index.html` ≥ 4
  and that any referenced `og:image` path resolves to a real file in `dist/`.
- **Severity:** S3 **Impact/Reach/Confidence:** 3/3/5 (score 15) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-047 is scoped to PNG *PWA icons* for installers, and no item covers
  the document head's social/SEO metadata.

### IMP-A4 — Give every route one level-1 heading and stop skipping heading levels

- **Status:** TODO
- **Area / files:** `src/features/calendar/CalendarView.tsx:131` (`<h2>` is the only heading),
  `src/features/list/ListView.tsx` (no heading; empty state is `EmptyState.tsx:23` `<h3>`),
  contrast the eight views that do render `<h1>` (e.g. `TodayView.tsx:128`, `GoalsView.tsx:51`)
- **Evidence:** `.improve/artifacts/discover4/a11y-ax-audit.json` (`headingsByRouteAX`, read from the
  AX tree): Calendar exposes only `October 2026` at level 2; Lists exposes **no heading at all**;
  Goals/Habits/Bills/Shopping/Notes expose `H1 → H3` with no level 2. 8 of 10 views render `<h1>`.
- **Intent:** the document outline is the primary navigation aid for screen-reader users; two routes
  have no entry point and five skip a level, so "jump to next heading" lands inconsistently.
- **Acceptance criteria:**
  1. Every route renders exactly one `<h1>` that names the view (Calendar → e.g. "Calendar",
     Lists → e.g. "Lists"), present in the AX tree as level 1.
  2. No route skips a heading level: the first heading after the `<h1>` is level 2.
  3. Existing visually-hidden/`aria-hidden` cases are unchanged and no new visible text is added.
- **Verification method:** Playwright + `Accessibility.getFullAXTree`: for each route assert exactly
  one level-1 heading and that no heading level increases by more than 1. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/4/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-121 (accessible names on form controls), IMP-123 (Tabs/weekday
  picker) and IMP-125 (skip link) all touch the accessibility tree but none covers heading structure.

### IMP-A1 — Remove background content from the accessibility tree while a modal is open

- **Status:** TODO
- **Area / files:** `src/components/ui/Sheet.tsx:55-63` (`role="dialog" aria-modal="true"`),
  `src/components/ui/Dialog.tsx:74-75` (same), background owner
  `src/features/shell/AppShell.tsx:110-261` (`DndContext` → nav + `<main id="main">`)
- **Evidence:** `.improve/artifacts/discover4/a11y-ax-audit.json` (`modalBackground`) and
  `.improve/artifacts/discover4/a11y-shortcut-sheet-ax-snapshot.yml`. With the shortcut sheet open,
  the AX tree contains the dialog **and** the full background as non-ignored siblings: nav links
  Today…Settings, `heading "Today" [level=1]`, `"Today's agenda 26" [level=2]`, `"Habits 1"`,
  `"Bills due soon 0"`, `"Goal progress 0"`. `#root`/`<main>`/`<nav>` have no `aria-hidden` and no
  `inert`; nav links keep `tabIndex 0`. Only `aria-modal="true"` guards the background, and it is
  honoured inconsistently across screen readers, so the virtual cursor can still read behind the
  modal.
- **Intent:** a screen-reader user who opens Quick add, the editor, the palette, the shortcut sheet,
  Help or a confirm dialog can wander into and activate the view behind it, which is exactly what
  the focus trap prevents for keyboard users.
- **Acceptance criteria:**
  1. While any overlay is open, the app shell (nav + `<main>` + header) is excluded from the
     accessibility tree (no background `heading`/`link`/`button` nodes are non-ignored).
  2. The overlay itself keeps its accessible name and remains the only interactive region.
  3. On close, the background is restored and focus returns to the opener (IMP-057/IMP-079
     behaviour unchanged).
- **Verification method:** Playwright + `Accessibility.getFullAXTree`: open each of the six overlays
  and assert no node outside the dialog has role `heading|link|button`; close and assert the
  background reappears. Run the four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/4/3 (score 9) **Effort:** S **Risk:** low
- **Depends on:** IMP-094 (overlay layering), IMP-057/IMP-059 (focus) conceptually
- **Not covered because:** IMP-027/057/059/079/094 cover names, initial focus, mount timing, Escape
  ordering and scroll locking — none hides the background from AT.

### IMP-D2 — Add a `404.html` (and decide the robots/sitemap question) for the Pages origin

- **Status:** TODO
- **Area / files:** `public/` (only `.nojekyll`, `favicon.svg`, `maskable.svg`, `pwa-192.svg`,
  `pwa-512.svg`), `dist/` (no `404.html`), `vite.config.ts:7` (base path)
- **Evidence:** `.improve/artifacts/discover4/delivery-probe.json` (`staticFiles`,
  `previewFallbacks`). `dist/` contains no `404.html`, `robots.txt` or `sitemap.xml`; on preview
  every unknown path returns the SPA `index.html` (200, `text/html`, 1375 bytes), which is the
  preview server's fallback, not a file. GitHub Pages serves its own 404 for unknown paths when no
  `404.html` exists, so a trimmed/typed URL such as
  `…/eisenmatrix-calendar/calendar` (no `#`) lands on GitHub's page instead of the app.
- **Intent:** the app is hash-routed, so in-app navigation never 404s, but a link a user trims by
  hand (or an old pre-hash link) should still land on the app rather than a GitHub-branded 404.
- **Acceptance criteria:**
  1. `npm run build` emits `dist/404.html` that renders the SPA shell (same asset graph as
     `index.html`) so a non-hash path on Pages boots the app.
  2. `robots.txt` is either shipped (with an explicit policy for this personal app) or explicitly
     documented as intentionally absent — the repo currently has no decision recorded.
  3. The added files do not change `index.html`, the manifest or the service-worker precache
     behaviour.
- **Verification method:** `npm run build && ls dist/404.html dist/robots.txt`; serve `dist/` and
  request `/eisenmatrix-calendar/calendar` expecting the SPA shell, then confirm the app boots.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/2/4 (score 8) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** no item mentions a 404 fallback, `robots.txt` or a sitemap; IMP-067/081
  are CI/branch-protection concerns only.

### IMP-A5 — Give the icon-only header controls real names and expose the theme toggle's state

- **Status:** TODO
- **Area / files:** `src/features/shell/AppShell.tsx:203` (theme), `:210` (shortcuts), `:218`
  (Help), `:229` (New task)
- **Evidence:** `.improve/artifacts/discover4/a11y-ax-audit.json` (`headerControls`). All four
  controls render empty text and no `aria-label`; their AX name comes only from `title`
  (`Theme: system`, `Keyboard shortcuts`, `Help & syntax`, `New task (N)`). The theme control is a
  cycling button with no `aria-pressed`/`aria-expanded` and a name that describes the current state
  but not the action; `title` tooltips never appear on touch, so on a phone these four buttons are
  unlabelled for both sighted and AT users.
- **Intent:** the header is the only persistent control strip; four of its five controls are
  icon-only, and the theme toggle is the app's sole theme switch.
- **Acceptance criteria:**
  1. Each icon-only header control has an explicit `aria-label` whose text matches its `title`, so
     the name does not depend on the tooltip.
  2. The theme control exposes its state to AT (a `switch`/menu with `aria-checked`/`aria-expanded`,
     or a single button whose label states the action and result).
  3. Names/states are present at 390 px as well as 1280 px and no visual layout changes.
- **Verification method:** Playwright + AX tree at 1280/390: assert each header button has a
  non-empty name with no reliance on `title` (check `aria-label`), and assert the theme control
  exposes a checked/expanded state. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/4 (score 8) **Effort:** S **Risk:** low
- **Depends on:** IMP-033 (toggle ARIA, closed) conceptually
- **Not covered because:** IMP-121 scoped *form controls*; IMP-033 scoped the switches/sortable
  headers in the views. Neither covers the icon-only header buttons or the theme cycle control.

### IMP-P1 — Eliminate the ~0.55 layout shift on Today's first paint with data

- **Status:** TODO
- **Area / files:** `src/features/today/TodayView.tsx:157` (main `grid grid-cols-1 gap-4
  lg:grid-cols-3`), `:351-352` (footer text), conditional blocks at `:145-155` and the
  `Section`-driven columns below it; data arrives via `src/hooks/useData.ts` live queries
- **Evidence:** `.improve/artifacts/discover4/perf-measurements.json` (`clsTodayFirstLoad`).
  Three consecutive fresh-context loads against a 26-item database each report **CLS 0.554**, a
  single shift at t≈115–134 ms whose sources are the `grid grid-cols-1 gap-4 lg:grid-cols-3`
  element and the `text-center text-xs text-muted` footer. With 580 items it is **0.668** plus a
  97 ms long task. With an empty database CLS is **0**. So the shift is caused by the first paint
  rendering a short page and the live query filling it in afterwards.
- **Intent:** CLS 0.55 is in the "poor" band (>0.25) and it is the *landing* route, so every
  returning user sees the content jump on every load — the most visible performance defect measured.
- **Acceptance criteria:**
  1. With a populated database, CLS for the Today route is <0.1 on a cold load at 1280 px and 390 px.
  2. Space for the agenda list and the three sidebar cards is reserved (skeleton/sized placeholder)
     before the live query resolves, so the footer does not move.
  3. The empty-database case stays at CLS ≈ 0 and no new loading spinner is shown for data that
     resolves within one frame.
- **Verification method:** Playwright + `PerformanceObserver('layout-shift')` with a populated DB,
  three cold loads, assert cumulative CLS <0.1 and that no shift entry names `TodayView.tsx:157`.
  Run the four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/5/4 (score 6) **Effort:** M **Risk:** med
- **Depends on:** none
- **Not covered because:** the Performance dimension lists only IMP-008/060/131/132/133 (memoisation,
  shared query, year view, editor analytics, chunk splitting); no item measures or budgets CLS.

### IMP-A3 — Give the month calendar programmatic grid structure and real date names

- **Status:** TODO
- **Area / files:** `src/features/calendar/CalendarView.tsx:169-172` (weekday labels),
  `:186-250` (month grid cells), `:208` (`aria-label={\`Add item on ${key}\`}`)
- **Evidence:** `.improve/artifacts/discover4/a11y-ax-audit.json` (`calendarMonthSemantics`) and
  `.improve/artifacts/discover4/a11y-calendar-month-1280.png`. The month view exposes **1 heading**
  (`H2 October 2026`), **0** `role=grid|table|row|columnheader|gridcell` nodes, and its seven weekday
  labels are plain `DIV`s; the 7×N day grid is 80 buttons in `<main>` (35 cells contain two or more
  buttons: the per-day "Add item on …" button plus one button per occurrence chip). Day-cell names
  are raw ISO dates (`Add item on 2026-09-28`), which AT reads digit-by-digit.
- **Intent:** the month view is a data grid visually but not programmatically, so a screen-reader
  user cannot learn the weekday of a cell, the current row/column, or move cell-to-cell; and 80+
  sequential tab stops make keyboard traversal of one month onerous.
- **Acceptance criteria:**
  1. The month grid exposes grid/table semantics with weekday column headers (roles or a real
     `<table>`), verified in the AX tree.
  2. Each day cell has an accessible name that includes the localised date and the weekday, and its
     "add" control is reachable without tabbing through every occurrence chip (roving tabindex or
     equivalent).
  3. Week/Month/Day/Year rendering and the `weekStartsOn` behaviour are unchanged and the day view's
     existing `Agenda` list keeps its semantics.
- **Verification method:** Playwright + `Accessibility.getFullAXTree` on the month view: assert
  columnheader/gridcell (or table) roles exist, that day-cell names contain a localised month name,
  and that the count of Tab stops in `<main>` is bounded (e.g. ≤ 7 per row, not one per chip).
  Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/5 (score 5) **Effort:** M **Risk:** med
- **Depends on:** IMP-049/IMP-058 (week start) and IMP-100 (tap targets) conceptually
- **Not covered because:** IMP-049/058 changed the weekday *order*, IMP-100 enlarged tap targets;
  no item addresses the month grid's programmatic structure or its date labels.

### IMP-P2 — Bound the DOM node count of the item views with windowing

- **Status:** TODO
- **Area / files:** `src/features/list/ListView.tsx:287-416` (ARIA table with one `role="row"` per
  item), `src/features/matrix/MatrixView.tsx:79` (`quadrantItems.map`),
  `src/features/habits/HabitsView.tsx:136` (`habitData.map`)
- **Evidence:** `.improve/artifacts/discover4/perf-measurements.json` (`routeTransitions`). With 580
  items, Lists renders **9,011** DOM nodes, Habits **7,269** and Matrix **5,650** (Today 1,575,
  Settings 346). The Lighthouse "excessive DOM" heuristic is ~1,400 nodes; the count scales linearly
  with the item count because every row is mounted. The routes still complete in 73/74/65 ms locally
  with no long tasks, so this is a headroom/slope problem rather than a present-day stall.
- **Intent:** a personal OS accumulates thousands of items; an unbounded row count is what turns a
  73 ms transition into a multi-hundred-ms jank on a low-end phone, and it also inflates the cost of
  every live-query-driven re-render.
- **Acceptance criteria:**
  1. For a 500+ item database the Lists/Matrix/Habits views stay below a fixed node budget
     (e.g. ≤2,000 nodes) by windowing/virtualising the rows, with no visual change to the visible
     rows.
  2. Scrolling to the end of a long list still reaches every item and keyboard/DnD interaction on
     the visible rows is unchanged.
  3. Existing ListView/MatrixView/HabitsView tests pass and a node-count assertion is added for a
     500-item fixture.
- **Verification method:** Playwright with a 580-item fixture: assert
  `document.querySelectorAll('*').length` below the budget on each view, and screenshot-scroll to the
  last row. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/3 (score 3) **Effort:** M **Risk:** med
- **Depends on:** IMP-008/IMP-060 (stable shared items query) conceptually
- **Not covered because:** the Performance dimension has no item on DOM size or list virtualisation;
  IMP-131 measured only the calendar's expansion passes.

---

## Summary

| # | Title | Sev | I/R/C | Score | Effort |
|---|-------|-----|-------|-------|--------|
| IMP-A2 | Update title + announce the view on route change | S2 | 3/5/5 | 15 | S |
| IMP-D1 | Ship Open Graph / Twitter Card metadata | S3 | 3/3/5 | 15 | S |
| IMP-A4 | One H1 per route; stop skipping heading levels | S3 | 2/4/5 | 10 | S |
| IMP-A1 | Remove background from the AX tree while a modal is open | S2 | 3/4/3 | 9 | S |
| IMP-D2 | Add `404.html` (and decide robots/sitemap) for Pages | S3 | 2/2/4 | 8 | S |
| IMP-A5 | Real names/state for icon-only header controls | S3 | 2/3/4 | 8 | S |
| IMP-P1 | Eliminate the ~0.55 CLS on Today's first paint | S2 | 3/5/4 | 6 | M |
| IMP-A3 | Programmatic grid structure for the month calendar | S3 | 2/3/5 | 5 | M |
| IMP-P2 | Bound DOM node count with windowing | S3 | 2/3/3 | 3 | M |

No S0/S1 defect was found. Delivery is the healthiest area: deep-link refresh, offline reload, the
stale-SW prompt and mixed-content checks all pass, so both delivery items are small metadata/host
polish. The strongest, most objectively verifiable findings are **IMP-A2** (title identical on 10/10
routes, no announcement — measured in the AX tree), **IMP-D1** (four required `og:` tags absent from
the built head) and **IMP-A4** (Calendar has no H1, Lists has no heading, five views skip a level).
**IMP-A1** and **IMP-P1** are the highest-impact behavioural defects (modal background leaks into the
AX tree; CLS 0.554 deterministic on the landing route). **IMP-A3**, **IMP-P2** and **IMP-A5** are the
weakest and are included for completeness.
