# Verify IMP-086 — independent review

**Reviewer:** independent (did not author the change)
**Baseline:** working tree on `improve/auto-20261017` (uncommitted), diff vs `HEAD`
**Spec:** `.improve/FEATURES.md` IMP-086 · **Impl report:** `.improve/reports/impl-IMP-086.md`

## VERDICT: PASS

All five gates pass. Schema, upgrade, backup/reset/legacy paths, toast-once, digest cache
invalidation and bounded failure growth all behave as specified. Only minor, disclosed
issues (none blocking).

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build`
→ all green. 44 files / 497 tests. `dist/sw.js` built, precache 18 entries.

## Schema / upgrade (throwaway probes, deleted after)

- `version(4).stores({ reminderFailures: '++id, &[itemId+dedupeKey], attemptedAt' })` only
  *adds* a table; Dexie merges deltas, so v1–v3 are preserved.
- Probe: a v3 DB (`&[itemId+occKey]` unique) with rows, opened by `EisenMatrixDB` → `verno 4`,
  rows intact, **duplicate `[itemId+occKey]` still rejected with `ConstraintError`**, and the
  new `&[itemId+dedupeKey]` index enforced. **PASS.**
- Probe: v1 (duplicate keys) → v4 dedupes to 1 row, unique enforced. **PASS.**
- Existing `repository.test.ts` legacy-upgrade test now runs against v4 and still passes.

## Backup / export / reset / legacy import

- `src/lib/backup.ts` `buildBackup` exports only `items` + `lists`; `reminderFailures` (like
  `reminderLog`) is **intentionally not exported** — a transient operational table. OK.
- Settings → "Clear all data" now also clears `reminderFailures` (`SettingsView.tsx:188`).
  Confirm copy still says "item, list and reminder log" — cosmetic gap only.
- `legacyTasks.ts` imports items only and never touches reminder tables; unaffected.

## No direct Dexie outside `src/db`

`grep` over `src` shows production callers use repos (`delivery.ts`, `ReminderRuntime.tsx`);
raw `db.*` appears only in tests. **PASS.**

## Behavioural criteria

1. **Distinct failure row** — written only in `deliver`'s undeliverable branch
   (`delivery.ts:100-105`), never the fired key; cleared on any success (`:93`, `:109`). PASS.
2. **One-time toast** — `reportUndelivered` toasts only when `pending !== failuresReported`
   and resets to 0 when pending empties (`ReminderRuntime.tsx:61-80`); `reporting` ref
   serialises concurrent ticks. Verified by `ReminderRuntime.failures.test.tsx` (5 extra ticks
   → 1 toast) and `delivery.test.ts` (500 undeliverable ticks → 1 row). PASS.
3. **Digest does not re-sweep** — module cache keyed by `items` reference + `dayKey`; probe
   with an `expandOccurrences` spy: same reference → 0 new sweeps, **changed reference → rebuild
   (invalidation works, no stale digest)**, new day → rebuild. PASS.
4. **Dedupe invariants** — `record` upserts inside a transaction on the unique compound key;
   eventual delivery → exactly one toast / one `reminderLog` row. PASS.
5. **Bounded growth** — 30-day `pruneBefore` on boot + clear-on-delivery + clear-all. PASS
   (see issue 3).

## Issues (non-blocking)

1. **Minor scope creep.** `ReminderRuntime.tsx:97` now uses `scheduled.occurrence.title`
   (resolved occurrence title) instead of `scheduled.item.title`. Beyond IMP-086's ACs, but a
   strict improvement (accurate surfaced title, overlaps IMP-085) and covered by the new test.
2. **D3 (disclosed).** Failure rows are not reaped on item delete/archive, so the toast count
   can include deleted reminders for up to 30 days. Bounded; documented.
3. **Prune runs on mount only.** A long-lived PWA session with repeatedly-failing reminders can
   accumulate one row per `(reminder, day)` until the next reload. Small rows, and no new row
   once a reminder ages out of the 24h retry window; not a spec violation.
4. **Digest-only failures are deliberately not recorded** (`recordFailure: false`), so the
   count is "undelivered reminders", matching AC wording. Intentional.
