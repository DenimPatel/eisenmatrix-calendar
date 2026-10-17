# Independent verification — IMP-039

**Verdict: PASS** (non-blocking issues noted below)

Reviewed working tree on `improve/auto-20261017`: `src/main.tsx`, `src/App.tsx`,
`src/db/repository.ts`, `src/hooks/useTheme.ts`, `src/pwa/register.ts`, the new
`ErrorBoundary` and `bootFailure` modules/tests. The `.improve/CHANGELOG.md`/`PROGRESS.log`
dirty lines are IMP-061 bookkeeping, unrelated to this item; `FEATURES.md` only flips
IMP-039 to IN-PROGRESS.

## Acceptance criteria

1. **PASS — boundary + recoverable fallback.** `src/main.tsx:9-15` wraps `<App />`.
   `src/components/ui/ErrorBoundary.tsx:28-56` renders a token-styled (`bg-bg`, `bg-surface`,
   `text-fg`, `border-border`, `text-q1`) `role="alert"` with fixed copy and **Reload**
   (`window.location.reload()`) / **Try again** (state reset). No error text is rendered.
2. **PASS — boot promises surfaced.** `src/App.tsx:34-50` catches DB open, legacy migration,
   notification gate and synchronous PWA setup; `src/pwa/register.ts` adds `onRegisterError`
   for async SW registration; `useTheme` catches both settings reads. `bootFailure.ts` dedupes
   by message and pushes one persistent (`duration: 0`) error toast with Reload. No secrets:
   only fixed copy reaches the UI/store; the error object goes to the local console.
3. **PASS — Dexie open failure cannot blank.** `ensureDbOpen()` rejection is caught and toasted;
   the tree keeps rendering (empty states) and any render failure is caught by the boundary.

## Gates

- `npm run typecheck` PASS; `npm run lint` PASS.
- `npm run test` PASS: **41 files / 425 tests** (baseline 420; +5, as expected).
- `npm run build` PASS: `dist/sw.js`, 18 precache entries, 620.63 KiB.
- Non-vacuous check: a scratch copy of the throwing-child scenario **without** the boundary
  failed with the thrown error and no `[role="alert"]`; scratch file removed. Fallback tests
  also assert `sk-live-secret` never appears in rendered output.

## Browser (preview :4173)

- Healthy boot: `#/today` and `#/calendar` render; **0 console errors/warnings**.
  Evidence `.improve/artifacts/IMP-039/healthy-boot.png`.
- Simulated blocked storage (`Object.defineProperty(window, 'indexedDB', { value: undefined })`
  via an init script before navigation): the app still renders Today instead of a blank page,
  with three persistent recoverable toasts and Reload actions; clicking Reload reloads.
  Evidence `storage-blocked-fallback.png`, `storage-blocked-console.log`.
- The render-fallback path itself was not forced in the production bundle; the jsdom tests are
  the executable evidence for it.

## Non-blocking issues

1. **Three toasts for one root cause.** Blocked storage surfaces storage, legacy-migration and
   notification-gate messages simultaneously (dedupe is per message). Matches the implementer's
   discovered §3; noisy but each failure is truthful and recoverable.
2. **Residual uncaught rejection.** On blocked storage, `src/pwa/ReminderRuntime.tsx:149`
   (`void reminderLogRepo.pruneBefore(...)`, same for the `:150-162` async IIFE) rejects
   unhandled (`MissingAPIError`); see `storage-blocked-unhandled-rejection.txt`. Pre-existing,
   does not blank the app and the storage toast still appears, but it is outside AC2's coverage.
3. **Layering nit.** `src/lib/bootFailure.ts` imports `@/store/useUiStore`, while REPO_PROFILE
   calls `lib` a leaf. No runtime cycle today; could live in `domain`/`hooks`.

No scope creep beyond adjacent boot handling, no new dependencies, no direct Dexie outside
`src/db/`, no comments added. Normal boot is unchanged.

**Suggested health delta:** UX/Interaction **+1** (blank crash → recoverable message) and
Bugs **+1** (boot/storage failures now surfaced). The toast stack and residual ReminderRuntime
rejection keep this from a full +2.
