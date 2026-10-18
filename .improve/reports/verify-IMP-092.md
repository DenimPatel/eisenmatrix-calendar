# verify-IMP-092 — Catch ReminderRuntime prune rejections on blocked storage

**Verdict: PASS** (independent skeptical review; source not modified)

## Scope reviewed

`git status` shows exactly one modified source file, `src/pwa/ReminderRuntime.tsx`
(+18/−4), plus two new untracked files: the new test
`src/pwa/ReminderRuntime.blockedStorage.test.tsx` and the two `.improve/reports/*`
docs. No `package.json` / lockfile / schema / repository / migration changes.

## Diff review

- `ignorePruneFailure(pass)` is `void pass().catch(() => {})` (`ReminderRuntime.tsx:40`).
  It replaces the two bare `void reminderLogRepo.pruneBefore(...)` /
  `reminderFailureRepo.pruneBefore(...)` calls and the `void (async () => …)()` gated
  `pruneItemReminders` pass (`:203-221`). Semantics are unchanged except the rejection
  is now handled, so no unhandled rejection escapes.
- `reportUndelivered` gains a `catch` around `undeliveredCount()`
  (`ReminderRuntime.tsx:86-88`). This path was added by IMP-086 and is the same
  blocked-storage rejection class; it is disclosed in the impl report. Slight widening
  beyond the `:149-162` area but same file/class, no new dependency — not harmful scope
  creep.

## Acceptance criteria

1. **Rejections caught, no unhandled rejection.** Yes — `ignorePruneFailure` owns the
   promise; the new test mocks both `pruneBefore` spies and `pruneItemReminders` to
   reject while capturing `process.on('unhandledRejection')` and asserts `[]`.
2. **No per-tick toast; degrades quietly (or reports once).** Yes — the passes push
   nothing on failure; the test asserts `toasts === []`. Blocked storage still surfaces
   once via `reportBootFailure` (`src/lib/bootFailure.ts:10`, which does
   `console.error(message, error)` and one deduped toast), so there *is* a trace for the
   storage-unavailable case.
3. **Delivery still works with storage available.** Yes — positive-control case prunes a
   stale absolute reminder; existing `ReminderRuntime.{test,delivery.test,failures.test}.tsx`
   untouched and green.

## Non-vacuity

The blocked cases spy the real repositories to reject; without the `.catch` the returned
promise is unhandled and would be captured/failed. The assertions are therefore
non-vacuous (independently reasoned; I did not mutate source, per the no-modify
constraint).

## Gates (all run by me)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (no output) |
| `npm run test` | PASS — 46 files / 504 tests |
| `npm run format:check` | PASS |
| `npm run build` | PASS (Vite + `dist/sw.js`, 18 precache entries) |

## Observations (non-blocking)

- **O1 — silent swallow, no local trace for non-storage failures.** `ignorePruneFailure`
  and the `reportUndelivered` catch discard the error with no `console.debug`/`warn`.
  The item explicitly permits "degrades quietly", and blocked storage still logs once via
  `reportBootFailure`, so this is compliant. But a prune/count failure on *available*
  storage (quota, `DataError`, a corrupt index) now leaves zero trace and stale rows can
  silently accumulate. A `console.debug` would preserve a local trace without adding a
  toast; the discovered report (D2) already notes this trade-off and cites the repo's
  clean-console test expectations. Acceptable as-is; worth a follow-up if maintenance
  failures need to be diagnosable.
- **O2 — the delivery `tick` still has no `catch`.** With a reminder due *and* storage
  blocked, `deliver`'s `wasFired`/`record` await can reject unhandled. Out of this item's
  scope (prune path) and the empty-data blocked preview exercises no due reminder; already
  captured as D1 in `discovered-IMP-092.md`.
- The browser/preview check in the impl report was not independently re-run; the five
  required gates are the verification I performed.

## Conclusion

Meets all three acceptance criteria; gates green; no harmful scope creep; the silent
swallow is consistent with the item's "degrade quietly" wording and is documented. PASS.
