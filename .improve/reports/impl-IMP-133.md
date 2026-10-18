# impl-IMP-133 — Route-level code splitting for the ten views

Baseline SHA: `1194f66` (HEAD at start). Item: `.improve/FEATURES.md` IMP-133 / `.improve/reports/discover3-features.md` F13.

## What changed

Route views other than Today are now loaded with `React.lazy` behind a `Suspense`
fallback, with a route-level error boundary for chunk-load failures.

| File | Change |
| --- | --- |
| `src/App.tsx` | Today stays a static import; the other nine views use `lazyRoute(() => import(...))`. `RoutedViews` reads `useLocation()` and wraps `<Routes>` in `<RouteErrorBoundary resetKey={location.pathname}><Suspense fallback={<RouteFallback />}>`, so navigating away from a failed view clears the error. |
| `src/lib/lazyRoute.ts` (new) | `React.lazy` wrapper. On a failed chunk it reloads the page once (stale-hash chunk after a deploy), then throws so the boundary handles a second failure. The reload guard uses `sessionStorage` **and** an in-memory module flag, and only reloads when the guard can actually be persisted. |
| `src/components/ui/RouteFallback.tsx` (new) | Accessible loading fallback: `role="status"`, `aria-live="polite"`, `aria-busy="true"`, `min-h-[60vh]` so the shell does not jump, `motion-safe:animate-spin`. |
| `src/components/ui/RouteErrorBoundary.tsx` (new) | Route-scoped error boundary: `role="alert"` with **Try again** (reload) and **Go to Today**; keeps the shell/nav usable and never renders a blank screen. Resets a latched error when `resetKey` changes. |

Today remains eager (landing route, first paint unchanged). Overlays
(`ItemEditorSheet`, `QuickAdd`, `CommandPalette`, `ShortcutSheet`) stay eager and are out
of scope.

## Build sizes (before → after)

`npm run build`, same repo, before = HEAD `1194f66`, after = this change.

| Asset | Before (raw / gzip) | After (raw / gzip) |
| --- | --- | --- |
| entry `index-*.js` | **394.23 kB / 118.55 kB** | **342.69 kB / 105.74 kB** |
| `SettingsView` | — | 18.18 kB / 6.74 kB |
| `ListView` | — | 10.60 kB / 3.53 kB |
| `CalendarView` | — | 7.27 kB / 2.67 kB |
| `HabitsView` | — | 4.80 kB / 1.95 kB |
| `BillsView` | — | 4.56 kB / 1.62 kB |
| `ShoppingView` | — | 4.53 kB / 1.90 kB |
| `NotesView` | — | 3.56 kB / 1.61 kB |
| `GoalsView` | — | 3.37 kB / 1.49 kB |
| `MatrixView` | — | 2.41 kB / 1.12 kB |
| `Droppable` (shared by views) | — | 0.29 kB / 0.23 kB |
| precache entries | 18 (639.72 KiB) | 28 (647.77 KiB) |

Entry chunk: **−51.54 kB raw (−13.1%) / −12.81 kB gzip (−10.8%)**. The remaining entry
is the shell (nav/dnd), the always-mounted overlays and modules shared across several
views, which Rollup hoists to the entry; splitting the views alone is the item's scope.

## PWA / offline

`vite-plugin-pwa` `injectManifest` globs the built `dist/`, so the new view chunks are
added to the precache automatically. `dist/sw.js` precache contains all ten
`assets/*View-*.js` chunks plus `Droppable`. Base path `/eisenmatrix-calendar/` and
`HashRouter` are unchanged.

## Verification

Gates (all pass): `npm run typecheck`, `npm run lint`, `npm run test` (64 files / 617
tests), `npm run format:check`, `npm run build`.

Tests added:
- `src/components/ui/RouteFallback.test.tsx` — status role, `aria-busy`/`aria-live`, reserved height.
- `src/components/ui/RouteErrorBoundary.test.tsx` — children pass through; failed chunk shows retry (not blank); injected retry/home handlers fire; recovery once the child stops throwing; **a changed `resetKey` clears the latched error, an unchanged one keeps it**.
- `src/App.routes.test.tsx` — Today renders eagerly; `#/matrix` resolves its lazy chunk and renders.
- `src/App.routeError.test.tsx` — **integration:** a view that throws shows the alert, then navigating to `#/settings` clears it and renders Settings.
- `src/lib/lazyRoute.test.ts` — **one reload when the guard persists; re-arms after a success; never reloads when `sessionStorage` is blocked; in-memory flag dedupes when storage reads fail**.

Browser check on `npm run preview` (4173), SW/caches reset first:
- Visited all ten routes via hash navigation — each rendered its view, **0 console errors**.
- `context.setOffline(true)`, then a real document load (`about:blank` → route URL) for
  each of the ten routes: **all 10 loaded from the precache with 0 console/page errors**.
- **Fix (1) verified:** with the `MatrixView` chunk and `sw.js` aborted, `#/matrix` showed
  the retry alert after the one-shot reload; changing the hash to `#/settings` cleared the
  alert and rendered Settings (`recovered: true`), with no manual reload. The only console
  errors were the intentionally aborted chunk requests.
- Preview server stopped after the check.

## Round 2 — fixes from `verify-IMP-133.md`

1. **Boundary reset on navigation (criterion fail).** `RouteErrorBoundary` gained a
   `resetKey` prop and `componentDidUpdate` clears a latched error when it changes.
   `App.tsx` passes `resetKey={location.pathname}` from a `useLocation()`-reading
   `RoutedViews`, so the nav rail recovers out of a failed route.
2. **Reload guard without a storage dependency (risk).** `shouldReloadChunk()` now checks
   an in-memory module flag first, then `sessionStorage`, and probes that storage is
   writable before deciding to reload. When storage is blocked it returns `false`, so the
   caller throws to the boundary instead of reloading in a loop. `clearChunkReloadGuard()`
   resets both guards after any successful chunk load.

Not committed or pushed.
