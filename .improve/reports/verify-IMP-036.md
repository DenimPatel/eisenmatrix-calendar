# Verification — IMP-036 (Make reminder dedupe race-safe)

**Reviewer:** independent (did not author the change)
**Date:** 2026-10-18
**Scope reviewed:** working-tree diff vs `HEAD` (`d9ab836`) in
`src/db/schema.ts`, `src/db/repository.ts`, `src/db/repository.test.ts`,
`src/pwa/ReminderRuntime.tsx`.

**VERDICT: PASS**

## 1. Acceptance criteria

| AC | Requirement | Result | Evidence |
| -- | ----------- | ------ | -------- |
| 1 | Compound index unique **or** atomic insert-then-catch | MET (both) | `schema.ts:57-59` `&[itemId+occKey]`; `repository.ts:226-234` returns `true`/`false` on `Dexie.ConstraintError` |
| 2 | Two concurrent `record` calls ⇒ exactly one insert | MET | `repository.test.ts:195-206`; independently reproduced with 8 concurrent calls (exactly one `true`, one row) |
| 3 | `ticking` in-flight guard prevents overlapping ticks | MET | `ReminderRuntime.tsx:50,56-57,93-95` |
| 4 | Existing reminder dedupe tests still pass | MET | full suite 42 files / 463 tests green |

## 2. Gates (all run on the working tree)

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (42 files, 463 tests)
- `npm run format:check` — PASS ("All matched files use Prettier code style")
- `npm run build` — PASS (`tsc --noEmit && vite build`, PWA sw generated)

## 3. Schema / upgrade review (highest-risk area)

Read against Dexie 4.4.6 source (`node_modules/dexie/dist/dexie.js`) and probed
with throwaway fake-indexeddb tests (since deleted).

- **Upgrade ordering is correct.** `updateTablesAndIndexes` processes versions
  ascending and, *per version*, applies schema/index changes before running that
  version's `contentUpgrade` (`dexie.js:3820-3894`). So v2's dedupe callback runs
  before v3 adds the unique index. The in-code comment claiming this is accurate.
- **Unique change is detected.** `getSchemaDiff` compares `idx.src`; the spec's
  `src` includes the `&` prefix (`dexie.js:3204-3207`), so the non-unique → unique
  transition is a real `change`, not a silent no-op (`dexie.js:3948`).
- **Earlier versions' declarations are preserved.** `Version.stores()` rebuilds a
  cumulative schema across *all* versions (`dexie.js:4105-4109`), so v3 declaring
  only `reminderLog` does not drop `items`/`lists`/`settings`/`backups`.
- **v1 → v3 with duplicates cannot brick boot.** Probe seeded a full legacy v1 DB
  (all five tables + duplicate `reminderLog` rows), opened the new `EisenMatrixDB`:
  upgrade succeeded, `reminderLog` deduped 5→3, `items`/`lists`/`settings`/`backups`
  preserved with values intact, and a subsequent duplicate `add` rejected with
  `Dexie.ConstraintError`. Also verified: v1 with no duplicates upgrades cleanly,
  and a brand-new DB opens directly at `verno === 3`.
- **`record()` contract is sound.** All callers (`delivery.ts:81,91`, tests) ignore
  the return value, so `Promise<void>` → `Promise<boolean>` is source-compatible;
  a mocked non-constraint error is rethrown (not swallowed).

## 4. Scope / conventions

- No scope creep: the only production changes are the migration, the atomic
  `record`, and the `ticking` guard (all required by AC1/AC3). The large
  `ReminderRuntime.tsx` diff is re-indentation from the `try/finally`, not new
  behavior.
- No direct Dexie outside `src/db/`; `import Dexie from 'dexie'` for the error class
  lives in `repository.ts` (inside `src/db/`). New comments explain non-obvious
  intent (migration ordering, guard rationale) — consistent with AGENTS.md.
- No leftover debug code or probe files remain (`git status` shows only the four
  intended files + the two report files).

## 5. Residual risks (noted, not blocking)

1. **v2 → v3 with duplicates aborts** (probe: `AbortError: ConstraintError`). The
   dedupe is version-gated, so it only protects v1 → v3. v2 never shipped (the
   released schema was v1 only), so no real install can be at v2 with duplicates.
   Safe as shipped; a future version must dedupe again before any unique-index change.
2. **Cross-tab dedupe is still check-then-record.** The `ticking` guard is
   per-instance, so two tabs/PWA windows can both notify before either records. The
   unique index only prevents the duplicate *row*, not the duplicate *notification*.
   Disclosed in `discovered-IMP-036.md`; out of scope.
3. **`deliver` ignores `record`'s boolean**, so a lost race is unobservable to the
   caller (duplicate already shown). Deliberate, to keep the "record only after
   delivery" retry semantics. Disclosed.
4. **Guard can defer a tick**: if the effect rebuilds mid-tick, the immediate `tick()`
   returns early and the new item set waits for the next 60 s / `visibilitychange`
   tick. Bounded by `LOOKBACK_MS` (24 h), so delivery is delayed, not lost. Disclosed.
5. Minor: the `\u0000` dedupe separator would collide only if an `itemId`/`occKey`
   contained a NUL byte; all real ids are UUIDs/date keys/`__digest__`. Theoretical.

## 6. Process note

`FEATURES.md` still shows IMP-036 as `Status: TODO` (line 1079). Not part of the
code change; flag for the coordinator to flip to DONE and append the notes.
