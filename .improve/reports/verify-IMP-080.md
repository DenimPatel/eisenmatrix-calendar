# Verify IMP-080 — Catch a rejected `rerunMigration` in Settings

**Verdict: PASS**
**Branch:** `improve/auto-20261017` (HEAD `e9fc259` + working tree)
**Reviewer:** independent verification; no implementation files modified, nothing committed.

## Diff reviewed

- `src/features/settings/SettingsView.tsx` (`rerunMigration`): reads the existing marker,
  removes it, runs `runLegacyMigration()`, and pushes the unchanged info toast on success.
  On failure it best-effort restores the prior marker, pushes
  `Migration failed: <describeError(error)>` with `tone: 'error'`, and skips the result toast.
- `src/features/settings/SettingsView.test.tsx`: module mock for `runLegacyMigration`
  (real constants via `importOriginal`), plus a rejection test and a success regression test.
- `.improve/` edits (`CHANGELOG`, `PROGRESS.log`, `FEATURES` status) are orchestration
  bookkeeping, not part of the implementation. No dependencies, comments, or styling churn.

## Acceptance criteria

| AC | Result | Evidence |
| --- | --- | --- |
| 1. Remove + migration in `try`/`catch`, error toast via `describeError` | PASS | `SettingsView.tsx:146-164`; both awaits inside one `try`; catch uses the file's existing `describeError`. |
| 2. Failure: no result toast; marker not left deleted | PASS | Only the error toast is pushed. Prior marker is read before removal and re-`set` on failure; absent marker stays absent (a not-yet-completed import *should* retry). If remove itself fails the marker is still intact and the re-`set` is idempotent. |
| 3. Success toast unchanged | PASS | Same `result.migrated` message pair and `tone: 'info'`; success test asserts the exact legacy message. |
| 4. No unhandled rejection | PASS | The handler resolves through its catch; restore is awaited with a swallowed rejection. Rejection test records `unhandledRejection` events and asserts none. |

Marker logic is correct: restoring the previous object (not synthesising a marker) cannot
resurrect a marker that was absent, and covers the only failure shape that deletes it.
Residual (accepted): if the restore write itself also fails the marker stays deleted, but
the DB is already failing, the user sees the error toast, and a later boot re-runs the
idempotent import.

## Test validity

- New rejection test is non-vacuous: run against a temp `git archive HEAD` snapshot with the
  new test file, it fails (`expected [] to deeply equal ["Migration failed: database is blocked"]`)
  and HEAD's handler escapes as an unhandled rejection. The success test is a regression guard
  (passes on both).
- Assertions cover: one migration call, exact error toast, no info toast, marker value restored
  byte-for-byte, and zero unhandled rejections; the listener is removed in `finally`.

## Gates

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test` — 42 files / **447 tests** pass (baseline 445; +2 new, as expected).
- `npm run build` — pass; `dist/sw.js`, 18 precache entries.
- `npm run format:check` — pass.

## Suggested health delta

**Bugs/Correctness +1**: the last unguarded user-triggered data-path promise in Settings now
surfaces failures, preserves the completed-migration marker, and cannot produce an unhandled
rejection.
