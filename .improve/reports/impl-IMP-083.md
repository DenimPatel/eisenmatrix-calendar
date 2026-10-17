# impl-IMP-083 — Boot smoke test observes boot effects; CI runs the suite twice

**Status: DONE.** Branch `improve/auto-20261017`, working tree only (no commit/push).

## Files

- `src/App.tsx` — exports `BootEffects` and accepts an optional `onBootEffects` callback prop.
  The boot effect keeps both migration promises, attaches the existing failure handlers exactly
  as before, then hands the same promises to the callback. `<App />` semantics are unchanged
  (no callback in production; `onBootEffects` is held in a ref so the effect still runs once).
- `src/test/app.smoke.test.tsx` — captures the handle, awaits both promises, and asserts the
  persisted boot state.
- `.github/workflows/ci.yml` — the single `Test` step now runs `npm run test && npm run test`.

## Acceptance criteria

1. **Observable handle + `migration.legacy` marker.** The smoke test renders
   `<App onBootEffects={...} />`, asserts the handle exists after mount, awaits `legacy`, then
   reads `settings['migration.legacy']` from IndexedDB and asserts
   `{ version: 1, count: 0 }`. It also asserts the render still contains `EisenMatrix`.
2. **`runNotificationGateMigration` covered.** The test stubs `Notification.permission` to
   `'granted'` before mount, awaits the `notificationGate` handle, and asserts both
   `settings['migration.notificationGate'] = { version: 1 }` and
   `settings['app'].notificationsEnabled === true`. So the gate is directly observed rather than
   excluded.
3. **Doubled CI run.** `.github/workflows/ci.yml:44-45` is still one step named `Test`, running
   `npm run test && npm run test`; the job name (`gate`) and all other steps are untouched, so
   branch-protection required checks are unaffected.
4. **Local suite green, only CI runtime grows.** `npm run test` stays at 454/454; the extra run
   exists only in the workflow.

## Why the test installs `localStorage` / `Notification` stubs

In this Node/jsdom setup the ambient `localStorage` is Node's non-`Storage` stub (the
`--localstorage-file` warning), so `runLegacyMigration` deliberately early-returns without writing
the marker (IMP-068). A minimal `Storage`-compatible in-memory global is installed in `beforeAll`
so the test exercises the real marker-writing path instead of making a vacuous assertion.
`Notification` is absent in jsdom, so it is stubbed with `permission: 'granted'` to drive the gate
to its seeding branch. Both stubs are file-local (`@vitest-environment jsdom`); no production
code or other suites are affected.

## Verification

- `npm run typecheck` — PASS.
- `npm run lint` — PASS, no output.
- `npm run test` — 42 files / 454 tests passed.
- `npm run build` — PASS (`tsc --noEmit`, Vite, `dist/sw.js` precache 18 entries).
- `npm run format:check` — PASS ("All matched files use Prettier code style!").
- `npx prettier --check src/App.tsx src/test/app.smoke.test.tsx .github/workflows/ci.yml` — PASS.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml')"` — parses ("YAML OK").
- 10 consecutive `npm run test` runs: all exit 0, 454/454 each, `grep -ci unhandled` = 0 in every
  log (`/var/folders/.../T/kilo/imp083/run-1..10.log`).
- **Mutation A:** temporarily replaced the legacy call with `Promise.reject(...)` — the smoke test
  fails (awaited handle rejects). Reverted and re-ran: pass. This is the spec's "break the
  migration" check.
- **Mutation B:** temporarily replaced the notification-gate call with `Promise.reject(...)` — the
  smoke test also fails. Reverted and re-ran: pass.

## Notes

- Test count remains 454 because the existing smoke test was extended rather than adding a new
  case; no baseline assertion was removed.
- The optional prop is a test seam only; production behavior (`<App />`) is byte-equivalent in
  effect ordering, error handling, and boot side effects.
