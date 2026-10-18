# verify-IMP-133 — Route-level code splitting (independent review)

Reviewer: independent skeptical pass. Baseline SHA `1194f66` (branch `improve/auto-20261017`).
Scope: `.improve/reports/impl-IMP-133.md`, working-tree diff (`src/App.tsx`, new
`src/lib/lazyRoute.ts`, `src/components/ui/RouteFallback.tsx`,
`src/components/ui/RouteErrorBoundary.tsx`, tests). No source modified.

## Gates — all pass

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test` | 62 files / 610 tests pass |
| `npm run format:check` | pass |
| `npm run build` | pass; entry `index-CwY2J-7T.js` 342.29 kB / 105.62 kB gzip; precache 28 entries |

## Criteria

### Deep links via hash load directly into a lazy route — PASS
Full document loads of `#/today … #/settings` each rendered the correct view, **0 console
errors**. `App.routes.test.tsx` covers `#/matrix`.

### Chunk-load failure shows the retry boundary, retry recovers — PASS
With the SW unregistered, caches cleared and the chunk request aborted
(`page.route('**/MatrixView-*.js', abort)` + `**/sw.js` abort):
- Two failed requests observed (`MatrixView-B-76bCg0.js` twice): the `lazyRoute`
  reload-once ran, then the boundary rendered.
- `role="alert"` showed "This view could not load" with **Try again** / **Go to Today**;
  the shell/nav stayed usable.
- After unblocking the chunk, **Try again** reloaded and the Matrix view rendered (flag
  cleared on success). **Go to Today** also recovered to `#/today`.

### Error boundary resets on navigation — FAIL
With the boundary in the error state (`#/matrix`, chunk aborted), clicking the nav rail
link to `#/settings` changed the hash but the alert persisted and the Settings view never
rendered (`#main` still "This view could not load"). The boundary is not keyed to the
location and is never remounted, so **any in-app navigation out of a failed route stays
stuck on the error** until the user presses "Go to Today" or does a real browser reload.
This contradicts the stated criterion. Reproduced twice. Severity: medium (recoverable,
but the nav rail appears broken).

### Stale SW + new deploy chunk-hash mismatch — PASS (with a risk)
`dist/sw.js` precache contains **all ten view chunks** plus shared chunks
(`Droppable`, `dates`, `dnd`, `react`, `dexie`, `state`, `index`, CSS) — 28 entries, so a
new deploy precaches the new hashed chunks and `cleanupOutdatedCaches` drops old ones. An
open stale tab that 404s a chunk is reloaded once by `lazyRoute` to pick up the new build
(observed as the double request above).
**Risk:** the reload-once guard latches via `sessionStorage`. If `sessionStorage` is
unavailable (private mode / embedded webview) `writeReloadFlag` silently fails, so a
persistent chunk error reloads forever instead of surfacing the boundary. The code
comments acknowledge the unavailable-storage case but the loop guard still depends on it.

### Offline navigation to every route after first load — PASS
After one online load (SW controlling), `context.setOffline(true)` then a full document
reload of each of the ten `#/route` URLs rendered every view with **0 console errors**;
offline hash navigation across all routes also rendered with 0 errors.

### Suspense fallback doesn't flash/jump layout — PASS (partially observable)
`RouteFallback` has `role="status"`, `aria-live="polite"`, `aria-busy="true"` and
`min-h-[60vh]` (the class is present in the built CSS: `.min-h-\[60vh\]{min-height:60vh}`).
`#main` top stayed at 56px before/during/after every navigation, so the shell does not
shift. A live fallback could not be forced in the MCP browser because view chunks are
served from the SW precache / HTTP cache (so in practice there is no visible flash on
repeat visits); the a11y/height contract is covered by the unit test.

### Focus management / route announce — PASS (no regression)
The app has no route-change announcer (pre-existing; `aria-live` exists only in
`ToastHost`), so splitting adds nothing to regress. The fallback does not steal focus
(`document.activeElement` stayed `BODY` across navigations); `#main` keeps `tabIndex=-1`.

### Keyboard shortcuts 1–9 navigate — PASS
Pressing `1`–`9` navigated to `#/today … #/notes` respectively, all correct.

## Verdict

**PASS WITH ISSUES.** Implementation meets the splitting, offline, deep-link, chunk-retry,
fallback, focus and shortcut criteria, and every gate is green. Two issues remain:
1. **(criterion fail)** the route error boundary does not reset on in-app navigation, so
   the nav rail is unusable while a route is in error;
2. **(risk)** the reload-once guard depends on `sessionStorage`; when storage is blocked
   the guard never latches and a persistent chunk error can reload-loop.

Preview server stopped after the checks.
