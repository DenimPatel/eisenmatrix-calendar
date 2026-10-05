# discovered-IMP-068 — findings noticed while fixing IMP-068 (not fixed)

Scope note: IMP-068 is the boot-time unhandled rejection from `runLegacyMigration`. The items below
were seen while working on it and are **deliberately left unfixed**.

## 1. `SettingsView.rerunMigration` can still reject unhandled (same class, user-triggered)

`src/features/settings/SettingsView.tsx:144`:

```ts
const rerunMigration = async () => {
  await settingsRepo.remove(LEGACY_MIGRATION_KEY);
  const result = await runLegacyMigration();
  pushToast({ ... });
};
```

An `async` click handler with no `try`/`catch`: if IndexedDB is unavailable or a write fails, the
rejection escapes as an unhandled rejection and the user gets **no** error toast. This is exactly
the gap IMP-015 closed for `importCSV` / `importBackup` (same file, `SettingsView.tsx:118,138`) —
the re-run button was missed. Fix is a `try`/`catch` + the existing `describeError` helper, so it
should ride with whichever item next touches Settings data actions.

## 2. The smoke test never awaits the boot migration, so boot side effects are unasserted

`src/test/app.smoke.test.tsx` mounts `<App />` and asserts on rendered text only. The migration
promise it starts is fire-and-forget and unobserved, which is why the defect could sit in the suite
for ~10 commits unnoticed. Even after IMP-068 the smoke test would not notice if the migration
stopped running entirely. A cheap follow-up: export the boot promise (or expose a test-only
handle) and have the smoke test `await` it, or assert the `migration.legacy` marker after mount.

## 3. Vitest 4's unhandled-error reporting is timing-dependent, so a single CI run is a weak gate

IMP-005's gate runs `npm run test` once. The rejection here fires on **every** mount but was only
*reported* when it settled while Vitest still had the file open (regression-10 observed
`Errors 1 error` on 1 of ~11 runs; 0 on the others). Single-run gates therefore cannot detect this
class of leak. A repeat-the-suite step (e.g. `vitest run && vitest run`) is cheap insurance and
would have surfaced it deterministically.

## 4. Node's `localStorage` stub shadows jsdom's in the `jsdom` vitest environment

With node ≥22.4, `globalThis.localStorage` exists as a plain object with **no `getItem`/`setItem`**
when `--localstorage-file` has no valid path — which is why the suite prints the benign
`--localstorage-file was provided without a valid path` warning. In Vitest's `jsdom` environment
Vitest does **not** overwrite it, even though `window.Storage` is jsdom's real class. So in tests
`localStorage` is a truthy non-`Storage` object and any code that checks only
`typeof localStorage !== 'undefined'` will throw. IMP-068 guards the one call site that existed;
any future bare-global read needs the same capability check. Recorded because the failure mode
(`storage.getItem is not a function`) gives no hint that the cause is the environment.

## 5. `--localstorage-file` warning is expected, but the stub it produces is not obviously connected

Worth a one-line note in `AGENTS.md` (or `.improve/REPO_PROFILE.md` §7 next to the existing
"benign warning" entry) so the next agent does not re-derive this from scratch.