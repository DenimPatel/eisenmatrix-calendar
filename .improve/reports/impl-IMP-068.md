# impl-IMP-068 — Boot migration can no longer reject unhandled

## Files
- `src/db/migrations/legacyTasks.ts` (new `ambientLegacyStorage()` helper; `runLegacyMigration`)
- `src/App.tsx` (boot call site now catches)
- `src/db/migrations/legacyTasks.test.ts` (2 new cases + a `withAmbientLocalStorage` helper)

## Root cause (measured, not assumed)

The failure is **not** a teardown race. In this environment (node v25.6.1, Vitest 4.1.11,
`jsdom` env) the global `localStorage` is **Node's own webstorage stub**, not jsdom's
`Storage`:

```
$ node -e "console.log(Object.prototype.toString.call(localStorage),
                  typeof localStorage.getItem)"
[object Object]
undefined
(node) Warning: `--localstorage-file` was provided without a valid path
```

Inside a `// @vitest-environment jsdom` test the same holds — `globalThis.window === globalThis`,
`window.Storage` exists, but `window.localStorage` is that stub. Vitest does not replace it.

`runLegacyMigration` guarded the ambient global with `typeof localStorage !== 'undefined'`, which
the truthy stub passes, then called `storage.getItem(...)` at `legacyTasks.ts:219` →
`TypeError: storage.getItem is not a function`. `App.tsx` fired it as `void runLegacyMigration()`,
so the rejection had no handler: an unhandled rejection.

Instrumented proof (temporary test, deleted afterwards), mounting `<App />` exactly as the smoke
test does and listening on `process.on('unhandledRejection')`:

- before: `rejections seen: 1` → `TypeError storage.getItem is not a function`
- after:  `rejections seen: 0`

The rejection fires on **every** mount. What is intermittent is only whether Vitest's unhandled-error
collector still has the file open when it settles — hence "all 118 tests passed / `Errors 1 error`",
and hence the reports' inability to reproduce it on demand (`.improve/reports/regression-10.md:45`,
`.improve/reports/verify-IMP-015.md:201`). This matches both prior observations exactly.

## What changed

1. `legacyTasks.ts` — the ambient global is resolved by capability, not by existence:

   ```ts
   function ambientLegacyStorage(): MigrationDeps['storage'] | undefined {
     if (typeof localStorage === 'undefined') return undefined;
     if (typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') {
       return undefined;
     }
     return localStorage;
   }
   ```

   A global without the `Storage` API is treated exactly like an absent one — the same
   `{ migrated: false, count: 0, backupCreated: false }` early return that already covered SSR and
   non-browser hosts. Explicitly injected `deps.storage` is untouched, so the unit tests and the
   Settings re-run path keep their current semantics. This removes the throw at its source; no
   console filter, no `try`/`catch` wrapper around the migration body.

2. `App.tsx` — the boot call site owns the promise, so a fire-and-forget boot task can never leave
   an unhandled rejection even if IndexedDB is unavailable (e.g. blocked storage):

   ```tsx
   void runLegacyMigration().catch((error: unknown) => {
     console.warn('Legacy v1 migration failed', error);
   });
   ```

   The failure is reported, not swallowed. `App.tsx` is the only boot call site; the Settings
   "Re-run migration" button owns its promise in a click handler.

## Acceptance criteria

1. **Zero unhandled errors over ≥10 runs** — 10 consecutive `npm run test`: exit 0 every time,
   `grep -ci "unhandled\|Errors "` → 0 lines, 175/175 tests each run (logs in
   `/var/folders/.../kilo/imp068/run-1..10.log`).
2. **Boot promise cannot reject unhandled** — AC2's first option, handled at the call site
   (`App.tsx`), plus the capability guard that removes the only observed rejection source. The
   instrumented teardown check reports `rejections seen: 0`.
3. **Runs exactly once, result still observable** — all four pre-existing migration cases still
   pass (import + all four `completionHistory` formats + backups + marker; idempotent re-run; marker
   when nothing to migrate). Two new cases pin the ambient path: *"falls back to the ambient
   localStorage and still records the marker"* (migration via the global, marker `version: 1`
   written) and *"ignores a localStorage global that lacks the Storage API instead of throwing"*.
   Mutation check: restoring the old `return localStorage` body fails the second case
   (1 failed / 5 passed).
4. **No user-facing behavior change** — in a browser `localStorage` implements `Storage`, so the
   guard is a no-op there: the migration still runs on boot, still backs up the raw payload, and
   still writes `migration.legacy`. The only changed outcome is on hosts that have no working
   web storage, where it now degrades to "nothing to migrate" instead of throwing.

## Commands + results

| Command | Result |
|---|---|
| `npm run typecheck` | PASS (no diagnostics) |
| `npm run lint` | PASS (no output) |
| `npm run test` | PASS ×10 consecutive — 175/175, exit 0, zero `Unhandled`/`Errors` lines |
| `npm run test -- --sequence.shuffle` | PASS ×4 — 175/175, exit 0, zero `Unhandled`/`Errors` lines |
| `npm run build` | PASS (`dist/sw.js`, 18 precache entries) |
| `npx prettier --check` on the 3 touched files | PASS |

Test count moved 173 → 175 (the two new migration cases); no existing test was edited.

## Out of scope
Findings noticed while working are recorded in `.improve/reports/discovered-IMP-068.md`.

## Uncertainties
- `console.warn` is the only console write in non-test source (there was none before). It was
  chosen over the toast store used by `setupPWA` because a boot-time warning must not create a
  visible toast in the app shell, and over a silent `.catch()` because a swallowed boot failure is
  how this class of bug stays invisible. Easy to swap for either.