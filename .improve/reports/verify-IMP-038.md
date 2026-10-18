# Verify IMP-038 — Validate imported JSON/CSV item shape before persisting

**Verdict:** PASS
**Reviewer:** independent (did not author the change)
**Date:** 2026-10-18
**Branch:** improve/auto-20261017 (uncommitted working tree)

## Scope reviewed
`git diff` + untracked `src/lib/itemValidation.ts`:
- `src/lib/itemValidation.ts` (new, pure, imports only `@/types`)
- `src/domain/itemFactory.ts` (`normalizeItem` shape coercion)
- `src/lib/csv.ts` (`csvToItems` → validator, `invalid`, id generation)
- `src/lib/backup.ts` (`parseBackup` → validator, `invalid`)
- `src/features/settings/SettingsView.tsx` (`importSummary`)
- tests: `itemFactory.test.ts`, `backup.test.ts`, `csv.test.ts`

No `package.json`/lockfile change, no new deps, no direct Dexie outside `src/db`, no
styling/hardcoded colors, no debug leftovers. Comments are doc comments on exported
functions only.

## Acceptance criteria
1. **Coerce/validate kind, status, reminders/tags/checklist/occurrences — MET.**
   `coerceItemShape` validates `kind`/`status` against `ITEM_KINDS`/`ITEM_STATUSES` and
   enforces array/object containers (`asStringArray`, `asObjectArray`, `asOccurrences`).
2. **Unknown kind → `task`, no `KIND_META[undefined]` — MET.** Verified by test and by
   hostile scratch run (`kind: 'nope'` → `task`).
3. **csvToItems / parseBackup route through the validator; failures reported, never
   thrown — MET.** Both expose `invalid`; `SettingsView.importSummary` appends
   `· invalid N` only when `N > 0`.
4. **Existing backup/csv/normalize tests pass — MET.** Full suite 461/461.

## Gates
`npm run typecheck` ✅ · `npm run lint` ✅ · `npm run test` ✅ (42 files, 461 tests) ·
`npm run format:check` ✅ · `npm run build` ✅ (dist + PWA `sw.js` generated).

## Hostile probes (throwaway `src/lib/zz-scratch-imp038.test.ts`, deleted after)
All 8 passed:
- `kind:5`, `status:{}`, `urgency:'medium'`, `importance:1` → `task`/`todo`/`low`/`low`.
- `reminders:'x'`, `tags:{a:1}`, `checklist:[1,'a',{...}]` → `[]`, `[]`, `[{...}]`.
- `occurrences:[]` (array) → `{}`; null-prototype object with `id` accepted.
- `parseBackup` drops non-string/blank ids (`1`, `'   '`) → `invalid:2`; keeps `'ok'`.
- `__proto__` in a backup item does **not** pollute `Object.prototype`.
- `recurrence:'daily'`, `history:'nope'`, `data:'nope'` → `null`/`[]`/kind defaults.
- CSV row with blank `id` → generated id, `invalid:0`.

## Minor findings (non-blocking, no criterion failure)
1. **`ParsedCSV.invalid` is unreachable.** `csvToItems` always supplies a non-empty id
   (`get('id').trim() || newId()`) and skips blank titles *before* validation, so
   `validateItem` can never fail for a CSV row → `invalid` is always `0`. The CSV arm of
   AC3 is therefore dead code and the `· invalid N` suffix can only ever appear for JSON
   imports. Consider removing the counter or validating something that can actually fail.
2. **Reminder/ChecklistEntry inner fields unvalidated.** `asObjectArray` keeps any plain
   object (`reminders:[{x:1}]` survives). Container type only, which is what AC1 asks;
   consistent with the documented `occurrences` gap (`discovered-IMP-038.md` §3).
3. **`urgency`/`importance` are lossy for non-`'high'` values** (`'medium'`/`5` → `low`),
   matching the pre-existing CSV default and the two-value `Priority` type.
4. **Stricter than before:** a backup item whose `id` is a number or blank used to be kept
   (the old filter only checked `'id' in i`); it is now counted `invalid` and dropped.
   Safer and consistent with AC2/AC3.

No crashes, throws, prototype pollution, or convention violations found.
