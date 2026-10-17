# IMP-039 — Implementation report

**Status:** implemented (all gates pass; backlog state untouched)

## Change

| File | Change |
| --- | --- |
| `src/components/ui/ErrorBoundary.tsx` | **New.** Class boundary (`getDerivedStateFromError` + `componentDidCatch`) rendering a token-styled `role="alert"` fallback with a fixed message, **Reload** (`window.location.reload()`) and **Try again** (resets boundary state). No raw error text is rendered. |
| `src/components/ui/ErrorBoundary.test.tsx` | **New.** jsdom tests: children render untouched; a throwing child yields the fallback with both actions and without the thrown message; **Try again** recovers once the child stops throwing. |
| `src/lib/bootFailure.ts` | **New.** `reportBootFailure(message, error)` logs locally and pushes one persistent (`duration: 0`) error toast with a Reload action; identical messages are reported once per session. Fixed user-facing copy, never the error text. |
| `src/lib/bootFailure.test.ts` | **New.** Asserts the toast shape, that a secret in the thrown error is absent from the toast state, and dedupe of repeated messages. |
| `src/db/repository.ts` | Added `ensureDbOpen()` (the only new Dexie touch, inside `src/db/`). |
| `src/App.tsx` | Boot effect now opens the DB and catches **DB open/upgrade**, legacy migration, notification-gate migration and synchronous PWA setup failures, reporting each through the toast helper instead of `console.warn`/`void`. |
| `src/hooks/useTheme.ts` | Both settings reads now catch rejection and report the same storage-unavailable toast, removing an unhandled boot rejection on blocked storage. |
| `src/pwa/register.ts` | Added `onRegisterError` so asynchronous service-worker registration failures also surface instead of being dropped by `registerSW`. |
| `src/main.tsx` | `<App />` is wrapped in `<ErrorBoundary>` at the root; a missing `#root` now creates a mount node instead of throwing and blanking the page. |

No new dependencies. No route-change reset: the spec does not ask for one, and both fallback
actions recover (reload / retry).

## Acceptance criteria

1. **Top-level boundary with recoverable fallback** — `src/main.tsx:10-15` wraps the whole app.
   Fallback is `src/components/ui/ErrorBoundary.tsx:28-56`; verified by the three jsdom tests.
2. **Boot promises caught and surfaced** — `src/App.tsx:34-51` catches DB open, both migrations
   and sync PWA setup; `useTheme` catches settings reads; `register.ts` handles async
   registration errors. Failures produce a persistent toast with Reload.
3. **Dexie open/upgrade failure does not blank the app** — `ensureDbOpen()` rejection is caught
   and toasted; the tree keeps rendering with hook fallbacks, and any render failure is caught
   by the boundary.
4. **No secrets exposed** — fallback and toast copy is fixed; error objects are only logged to
   the local console for debugging (no network reporting exists). The boundary test throws
   `token=sk-live-secret` and asserts it never reaches rendered output.

## Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run test` **41 files / 425 tests
passed** (baseline 420; +5) · `npm run build` OK (`dist/sw.js`, 18 precache entries,
620.63 KiB).

## Browser verification

`npm run preview` on :4173, fresh bundle loaded after unregistering the previous service worker:
`#/today` rendered the Today dashboard, the new bundle (`index-BXHYn6op.js`) was served, and
there were **0 console errors/warnings**. The boundary is transparent when healthy, so the
throwing-child unit tests are the executable evidence for the fallback path.

## Discovered

See `.improve/reports/discovered-IMP-039.md`.
