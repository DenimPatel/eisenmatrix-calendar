# IMP-080 — Implementation report

**Status:** implemented

## Change

`src/features/settings/SettingsView.tsx` — `rerunMigration` now reads the existing
migration marker, wraps the marker removal and `runLegacyMigration()` call in a
`try`/`catch`, and on failure:

- restores the previous marker (when one existed) so an already-completed import is not
  re-run after a partial failure;
- pushes `Migration failed: <describeError>` with `tone: 'error'`;
- never pushes the migrated/not-found result toast.

The success path is unchanged (same info toast and message), and the existing button
markup/behavior is untouched. A marker restore failure is swallowed so the original
failure is still surfaced.

`src/features/settings/SettingsView.test.tsx` — mocks `runLegacyMigration` via
`importOriginal` (keeping the real constants) and adds a `SettingsView legacy migration`
suite:

- rejection case: seeds a completed marker, rejects with `database is blocked`, clicks
  `Re-run legacy import`, and asserts one error toast, no result toast, the marker value
  restored, one migration call, and no `unhandledRejection` event;
- success case: asserts the existing "No legacy data found (or already imported)" info
  toast still appears.

## Acceptance criteria

1. Marker removal + `runLegacyMigration` are inside `try`/`catch`; errors go through
   `describeError` into an error toast.
2. On failure no result toast is pushed and the prior marker is restored.
3. On success the existing info toast is unchanged (covered by the new success test).
4. The handler catches the rejection, so no unhandled rejection escapes; the test records
   `unhandledRejection` events and asserts none fired.

## Verification

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — 42 files / 447 tests pass (was 445; +2 new tests)
- `npm run build` — pass (`dist/sw.js` generated, 18 precache entries)
- `npm run format:check` — pass

No new dependencies, no comments, no `.improve/` state edits.
