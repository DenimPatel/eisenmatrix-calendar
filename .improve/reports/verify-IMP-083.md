# Verify — IMP-083: Boot smoke test observes boot effects; CI runs the suite twice

Reviewer: independent (did not author the change)
Branch: `improve/auto-20261017` (IMP-083 uncommitted working tree)
Date: 2026-10-17

**VERDICT: PASS** — all four acceptance criteria hold, the seam is inert in production,
and the assertions fail if either migration rejects or silently skips its marker.

## Scope reviewed

| File | Change |
|---|---|
| `src/App.tsx` | +28/−6: exports `BootEffects`, optional `onBootEffects` prop, effect holds both migration promises and invokes the callback; no other boot change |
| `src/test/app.smoke.test.tsx` | +49/−3: captures the handle, awaits both promises, asserts both migration markers plus the seeded notification setting |
| `.github/workflows/ci.yml` | 1 line: `Test` step runs `npm run test && npm run test` |

The other `.improve/` deltas in `git status` (CHANGELOG/PROGRESS IMP-087 lines, IMP-095 item)
pre-date this item and are not part of the IMP-083 change. `git diff --check` clean; no
console/debugger/TODO leftovers.

## Criteria

1. **PASS — observable handle + `migration.legacy` outcome.** The smoke test renders
   `<App onBootEffects={...} />`, asserts the handle was delivered after mount, awaits
   `legacy`, then reads `settings['migration.legacy']` and requires
   `{ version: 1, count: 0 }`. The legacy migration only writes that marker when it reaches
   the end of the no-payload path (`legacyTasks.ts:233-238`), so the former IMP-068
   early-return (no `Storage` methods) would leave it absent and fail the test.
2. **PASS — `runNotificationGateMigration` covered.** `Notification.permission` is stubbed to
   `'granted'`; the test awaits `notificationGate` and asserts
   `settings['migration.notificationGate'] = { version: 1 }` and
   `settings['app'].notificationsEnabled === true`. Both writes occur only in the `seeded`
   branch (`notificationGate.ts:76-78`), so this is the real gate path, not an exclusion.
3. **PASS — CI runs the suite twice.** `ci.yml:44-45` is still one step named `Test` running
   `npm run test && npm run test` (`npm run test` is exactly `vitest run`). No step or job
   was added/renamed; job `gate` / check name `Typecheck, lint, test, build` unchanged.
   `ruby -e "require 'yaml'; ..."` parses the workflow; the extracted step is
   `{"name"=>"Test", "run"=>"npm run test && npm run test"}`.
4. **PASS — local suite green, only CI runtime grows.** 454/454 tests across 42 files.

## Seam isolation

Production `<App />` (`src/main.tsx:13`) passes no prop. With no callback the added line is
an optional-chain no-op evaluated between the two catch attachments and `setupPWA()`, so
effect ordering, error handling and side effects are unchanged. `useRef(onBootEffects)` is
only read by the one-shot effect, so a re-render cannot re-run boot. The prop is not placed
on `window`, storage, or any other global; the test stubs (`localStorage`, `Notification`) are
file-local to the `@vitest-environment jsdom` file and no production module imports the test.

## Non-vacuity

- A rejecting migration makes `await bootEffects!.legacy` (or `.notificationGate`) reject
  inside `act`, failing the test; the App's `.catch` does not consume the original promise.
- A silent no-op migration fails the marker assertions directly (undefined value).
- The impl report's mutations A and B (replace each call with `Promise.reject`) both failed
  the test before revert; this review confirmed the same paths by code inspection without
  modifying files.

## Gates

- `npm run typecheck` PASS; `npm run lint` PASS (no output).
- `npm run test` PASS — 454/454, baseline 454 (test extended, not added).
- `npm run build` PASS — `tsc --noEmit`, Vite build, `dist/sw.js` precache 18 entries.
- `npm run format:check` PASS.
- 5 consecutive `npm run test` runs: exit 0, 454/454 each, `grep -ci unhandled` = 0 in every
  log (`/var/folders/.../T/kilo/imp083-verify/run-1..5.log`).

## Advisories (non-blocking)

- The test reads `getDb().settings` directly (`app.smoke.test.tsx:76-82`), a mild deviation
  from "no direct Dexie outside `src/db/`"; using `settingsRepo.get` would match the seam.
- `FEATURES.md` still shows IMP-083 as IN-PROGRESS and has no verification note; left
  untouched because this review was instructed not to modify files beyond this report.

## Suggested Tests/Tooling health delta

**+1** — boot migrations are now observable end-to-end (marker-level, both migrations), and
the doubled CI run turns the timing-dependent unhandled-rejection class into a deterministic
gate. Cost is one extra local suite run (~12 s) per CI job; no delivery behavior change.
