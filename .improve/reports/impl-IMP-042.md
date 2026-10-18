# IMP-042 — Surface swallowed errors instead of failing silently

Nothing committed or pushed. All four gates pass (707 tests / 72 files).

## Intent

Empty `catch` blocks silently discarded failures, so the hardest bugs (notification delivery,
legacy-migration parse, CSV decode) left no diagnostic. The fix adds a dev-visible trace, and —
per the task — surfaces the genuinely user-impacting losses through the existing toast.

## What was swallowed (grep of `src`)

Empty catches existed in `notifications.ts`, `csv.ts` (`safeJSON`), `legacyTasks.ts`
(`parseLegacyTasks`), `lazyRoute.ts` (4, benign `sessionStorage` guards), and `ReminderRuntime.tsx`
(4, intentionally quiet per IMP-092/117). `lazyRoute`'s guards are capability checks with no
user-facing loss and were left untouched.

## Changes

### New: `src/lib/failureTrace.ts` (pure, no store)

- `describeFailure(error)` → `"Name: message"` for an `Error`, the string itself for a string,
  `"Unknown error"` for other values, `undefined` for none. The raw object and its enumerable
  payload are never logged, so a stack/path/snippet cannot leak.
- `traceFailure(message, error?, level = 'warn')` → `console[level](message, describeFailure(error))`.
  Imports nothing from the store, so `db` can depend on it safely.
- `FailureReporter` type — the injection seam.

### New: `src/lib/reportFailure.ts` (store-aware)

- `reportFailure(message, error?, { level, toast = true, tone })` = `traceFailure` + one deduped
  toast through `useUiStore.getState().pushToast`; `resetReportedFailures()` clears the dedupe
  memory for tests. No longer logs the raw error.

### Trace + toast (user-impacting, silent data loss)

- `src/lib/csv.ts` `safeJSON` — a malformed JSON column (recurrence, tags, reminders, …) was
  silently reset to the fallback. Now `traceFailure` + toast
  “Some imported fields could not be read and were reset.”, then returns the fallback.
- `src/db/migrations/legacyTasks.ts` `parseLegacyTasks` — a corrupt `eisenmatrix-tasks` payload
  was dropped and the migration still marked complete. It now takes an optional
  `onFailure: FailureReporter` (default `traceFailure`) and calls it for the invalid-JSON throw
  (“Legacy task data could not be read; nothing was imported.”) and for a non-list payload
  (“Legacy task data was not a list; nothing was imported.”). Still returns `[]`.
  `runLegacyMigration` forwards `deps.onFailure`, and **`src/App.tsx`'s mount effect wires
  `reportFailure`** — so the toast lives in the UI layer and `db` no longer imports the store.

### Trace only (fallback already reaches the user)

- `src/pwa/notifications.ts` `showAppNotification` — a failed `showNotification`/constructor
  returns `false`; the caller falls through to an in-app toast and records an undelivered
  failure. Now `traceFailure` with `toast: false`, so it cannot double up with the existing
  undelivered-reminder toast.

### Quiet but traceable (IMP-092 / IMP-117 preserved)

`src/pwa/ReminderRuntime.tsx` — the four blocked-storage swallows (`ignorePruneFailure`, the
undelivered-count catch, the delivery-tick catch, the `notificationclick` lookup) trace at
`console.debug` with `toast: false`. No toast.

### Also covered

`src/features/settings/SettingsView.tsx:178` — the marker-restore `.catch(() => undefined)` now
traces at `console.debug` (“Legacy migration marker could not be restored.”); it still cannot mask
the original error already toasted on the next line.

## Tests

- `src/lib/failureTrace.test.ts` (new, 4) — `describeFailure` name/message only (stack stripped),
  string/unknown/undefined handling; `traceFailure` logs the sanitized value, never the raw
  object, and honors the level.
- `src/lib/reportFailure.test.ts` (3) — sanitized trace + one deduped toast, no error text in the
  toast JSON; `level: 'debug', toast: false` traces without a toast.
- `src/test/layering.test.ts` (new, 2) — asserts `src/db/migrations/legacyTasks.ts` imports
  neither `@/store` nor `@/lib/reportFailure`, and `failureTrace.ts` has no store import.
- `src/db/migrations/legacyTasks.test.ts` (+4) — `parseLegacyTasks` traces (sanitized) but does
  **not** toast on its own; `runLegacyMigration` forwards an injected reporter; the injected
  `reportFailure` produces the toast.
- `src/lib/csv.test.ts` (+1) — unreadable JSON field traces (sanitized `SyntaxError`), toasts,
  and falls back.
- `src/pwa/notifications.test.ts` (+2) — rejecting service worker and throwing constructor assert
  the sanitized `console.warn`.

## Follow-up fixes from `verify-IMP-042.md`

1. **Layering inversion (real) — fixed.** `db/migrations/legacyTasks.ts` now imports only the
   pure `@/lib/failureTrace`; the toast is injected from `App.tsx` via `onFailure`, so `db` no
   longer transitively depends on `useUiStore`. Guarded by `layering.test.ts`.
2. **“PII-free” not enforced — fixed.** `describeFailure` logs `Name: message` only; the raw
   error object, stack and enumerable payload never reach the console.
3. **Description drift / SettingsView:178 — addressed.** The `SettingsView` swallow now traces at
   debug. (The `lazyRoute` catches remain; two are `setItem`/`removeItem` of the reload flag, all
   genuinely benign — the impl report’s earlier “probes” wording was loose.)
4. **Duplication vs `reportBootFailure` — left as-is.** They share a pattern but differ in copy,
   action button and level; unifying them is out of scope.

## Deviation from the spec

Acceptance criterion 2 (“user-facing behavior is unchanged”) is intentionally relaxed for the
data-loss cases (`safeJSON`, the injected legacy parse reporter): the task asked for
genuinely user-impacting failures to be surfaced through the toast. Messages are deduped, so this
is at most one toast per distinct failure per session — no spam. `showAppNotification` keeps the
spec’s behavior exactly.

## Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run test` 707 passed (72 files) ·
`npm run format:check` clean.

## Note

The pre-existing test “falls back to task for an unknown kind and coerces non-array shape fields”
feeds an unquoted `[1,2]` in a CSV field, which the comma splitter breaks into `[1`; it now
exercises the new trace path incidentally (still green).
