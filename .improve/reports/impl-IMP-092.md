# impl-IMP-092 — ReminderRuntime prune rejections are handled

## Files

| File | Change |
| --- | --- |
| `src/pwa/ReminderRuntime.tsx` | New module-local `ignorePruneFailure(pass)` that owns the promise and swallows a rejection. The three boot maintenance passes now run through it: `reminderLogRepo.pruneBefore`, `reminderFailureRepo.pruneBefore` (the IMP-086 failure prune) and the gated `pruneItemReminders` async pass. `reportUndelivered` (the other async path IMP-086 added) gains a `catch` so a rejected `undeliveredCount()`/`reminderFailureRepo.count()` also degrades quietly. |
| `src/pwa/ReminderRuntime.blockedStorage.test.tsx` | **New.** Three jsdom cases over the real component + fake-indexeddb: rejected prune passes, a rejected pending count, and a positive control where storage is available. |

## Acceptance criteria

1. **Prune path catches rejections.** `ignorePruneFailure` is `void pass().catch(() => {})`, so a
   rejected prune is handled at its source instead of becoming an unhandled rejection. The
   `reportUndelivered` catch covers the count read IMP-086 added. Asserted by capturing
   `process.on('unhandledRejection')` while the real component mounts with the repository calls
   rejecting.
2. **No per-tick toast.** Both the prune passes and the count read already ran at most once per
   boot/tick; they now push nothing on failure. The boot's own `reportBootFailure`
   (`App`/`useTheme`, IMP-039) is still the single storage-unavailable message, so a blocked
   storage boot reports once and degrades quietly afterwards. Asserted: `toasts` is empty.
3. **Delivery unaffected when storage is available.** The positive-control case still prunes a
   stale absolute reminder; the existing delivery tests (`ReminderRuntime.test.tsx`,
   `ReminderRuntime.delivery.test.tsx`, `ReminderRuntime.failures.test.tsx`) are untouched and
   green.

## Verification

- `npm run typecheck` — PASS.
- `npm run lint` — PASS (no output).
- `npm run test` — PASS: **46 files / 504 tests** (was 46 / 501 with the transient 2-test file;
  net +3 cases in the new file).
- `npm run format:check` — PASS ("All matched files use Prettier code style!").
- `npm run build` — PASS (`tsc --noEmit`, Vite, `dist/sw.js`, 18 precache entries).
- **Non-vacuous.** Dropping the `.catch` in `ignorePruneFailure` fails the prune case
  (`expected [ Error: database is blocked ] to deeply equal []`); dropping the `reportUndelivered`
  catch fails the count case. Each mutated file was restored byte-identical.

## Browser (preview :4173, storage blocked)

Init script `Object.defineProperty(window, 'indexedDB', { value: undefined })` before navigation,
SW registrations unregistered and caches cleared, then a real document load with
`unhandledrejection` captured:

- Before the change: `["MissingAPIError IndexedDB API missing…", "DatabaseClosedError…"]`.
- After: `rejections: []`, heading `Today`, the four expected boot error toasts only.
- Healthy boot (no block): `consoleErrors: []`, `rejections: []`, heading `Today`.

## Scope

No schema, repository, migration, dependency or style changes. No direct Dexie outside `src/db/`,
no `localStorage`. The only source change is `src/pwa/ReminderRuntime.tsx`.
