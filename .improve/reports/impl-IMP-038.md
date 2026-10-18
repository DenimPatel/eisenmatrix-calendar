# IMP-038 — Validate imported JSON/CSV item shape before persisting

**Status:** done
**Date:** 2026-10-18

## Summary
Imported items are now shape-validated and coerced through a single pure validator
before they reach `normalizeItem`/persistence. Unknown kinds fall back to `task`,
invalid `status` falls back to `todo`, and `reminders`/`tags`/`checklist`/`occurrences`
(plus `urgency`/`importance`) are coerced to their expected runtime types. Values that
cannot become an item at all (non-objects, missing/blank `id`) are counted as `invalid`
and excluded instead of throwing.

## Files changed
- `src/lib/itemValidation.ts` (new) — pure, types-only leaf module:
  `isItemKind`, `isItemStatus`, `isPlainObject`, `coerceItemShape`, `validateItem`.
  `validateItem` rejects non-objects and items without a usable `id`; otherwise returns
  the coerced `ItemShape`.
- `src/domain/itemFactory.ts` — `normalizeItem` now sources `kind`/`status`/`urgency`/
  `importance`/`tags`/`reminders`/`checklist`/`occurrences` from `coerceItemShape`, and
  guards `recurrence` (object-or-null), `history` (array), and `data` (plain-object merge).
  Invalid `kind` → `task`, invalid `status` → `todo`.
- `src/lib/csv.ts` — `csvToItems` routes each row through `validateItem`, exposes
  `ParsedCSV.invalid`, and generates an id for rows that omit one (preserving prior
  "generated id" behavior).
- `src/lib/backup.ts` — `parseBackup` routes each array entry through `validateItem`,
  exposes `ParsedBackup.invalid`, and drops counted invalid entries.
- `src/features/settings/SettingsView.tsx` — new `importSummary()` helper appends
  `· invalid N` to the JSON and CSV import summaries when any entry was rejected.
- Tests: `src/lib/csv.test.ts`, `src/lib/backup.test.ts`, `src/domain/itemFactory.test.ts`
  extended with invalid-kind fallback, non-array shape-field coercion, counted
  rejections, and generated-id coverage.

## Acceptance criteria
1. Validator coerces/validates `kind` (vs `ITEM_KINDS`), `status` (vs `ITEM_STATUSES`)
   and enforces array/object types for `reminders`/`tags`/`checklist`/`occurrences`. ✅
2. Unknown/invalid `kind` falls back to `task` (no `KIND_META[undefined]`). ✅
3. `csvToItems` and `parseBackup` route through the validator; rejected items are
   reported via `invalid` in the import summary rather than throwing. ✅
4. Existing backup/csv/normalize tests still pass (full suite 461/461). ✅

## Approach notes
- Layering respected: the validator lives in `src/lib/` (leaf, imports only `@/types`),
  so `src/lib/csv.ts` and `src/lib/backup.ts` do not import from `domain`. `normalizeItem`
  (domain) consumes the same validator, keeping one source of truth.
- Coercion is non-destructive: unknown extra fields are still preserved via the existing
  `...partial` spread; only the known untrusted fields are re-applied after it.

## Commands run
- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — pass (42 files, 461 tests)
- `npm run format:check` — pass (after `npx prettier --write src/lib/itemValidation.ts`)
