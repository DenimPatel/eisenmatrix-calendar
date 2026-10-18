# IMP-036 — Make reminder dedupe race-safe

**Status:** done
**Date:** 2026-10-18

## Summary
Reminder delivery dedupe is now race-safe. The `reminderLog` compound index
`[itemId+occKey]` became **unique** (Dexie schema v3), and `reminderLogRepo.record`
performs an atomic insert-then-catch: it returns `true` for the winning insert and
`false` when a duplicate is rejected with `Dexie.ConstraintError`. A `ticking` in-flight
guard in `ReminderRuntime` stops a second tick (StrictMode double-invoke or a live-query
effect rebuild) from passing `deliver`'s check-then-record window before the first tick
has recorded, so a reminder cannot be notified twice.

## Files changed
- `src/db/schema.ts` — added `version(2)` (dedupes legacy `reminderLog` rows) and
  `version(3)` (`reminderLog: '++id, &[itemId+occKey], firedAt'`, unique compound index).
  The dedupe must precede the unique index: Dexie applies index changes before a
  version's `upgrade`, and building a unique index over existing duplicates aborts the
  upgrade, so dedupe gets its own version.
- `src/db/repository.ts` — `reminderLogRepo.record` now returns `Promise<boolean>` and
  catches `Dexie.ConstraintError` (new `import Dexie from 'dexie'`).
- `src/pwa/ReminderRuntime.tsx` — added `ticking` ref guard around the tick body.
- `src/db/repository.test.ts` — two concurrent `record` calls for the same key assert
  exactly one insert wins and one row exists; a migration test builds a legacy v1 DB with
  duplicate log rows and asserts the upgrade dedupes to one row and then rejects a
  duplicate `add` with `Dexie.ConstraintError`.

## Acceptance criteria
1. Compound index is unique (`&[itemId+occKey]`); `record` uses atomic insert-then-catch
   on `Dexie.ConstraintError`. ✅
2. Two concurrent `record` calls for the same key yield exactly one successful insert
   (asserted in `repository.test.ts`; verified stable over repeated runs). ✅
3. A `ticking` in-flight guard prevents overlapping ticks. ✅
4. Existing reminder dedupe tests still pass (full suite green). ✅

## Approach notes
- `deliver` keeps its check-then-record order (record only after an actual delivery) so an
  undelivered reminder still retries within the lookback window; the unique index is the
  backstop and the tick guard removes the overlapping-tick window.
- No direct Dexie outside `src/db/`; the migration lives in `schema.ts`, following the
  existing versioned-schema pattern.

## Commands run
- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — pass (42 files, 463 tests)
- `npm run format:check` — pass
