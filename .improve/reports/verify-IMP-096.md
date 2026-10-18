# verify-IMP-096 — habit streak derivation atomic with the occurrence toggle

**Verdict: PASS**

Reviewer: independent, did not write the change. Source not modified (probe test deleted after use).

## Scope reviewed

`git diff` vs acceptance criteria in `.improve/FEATURES.md` (IMP-096). Only `src/domain/itemActions.ts`
and `src/domain/itemActions.test.ts` are modified; `src/db/repository.ts` was not touched (the
`updateAtomic` seam already existed from IMP-089, which is the declared dependency).

- New pure `streakPatch(item)` returns `{ data: { …item.data, streak } }` for a habit only when the
  derived `habitStreak` differs from the stored streak, else `null`.
- `setStatus` occurrence branch: builds the candidate `occurrences`, computes `streakPatch` on
  `{ …stored, occurrences: occurrences ?? stored.occurrences }`, and merges the streak into the same
  `ItemPatch` inside the one `itemRepo.updateAtomic` build callback.
- `setStatus` whole-item branch: same merge on `{ …stored, status, completedAt }`.
- `toggleDone` no longer re-reads and issues a second `patchItem`; it delegates to `setStatus`.

## Criteria checks

1. **Atomic write.** `updateAtomic` runs `build` inside `db.transaction('rw', db.items, …)`, so the
   candidate occurrence map and the derived streak are one `put`. Confirmed by a write-count probe
   (Dexie `creating`/`updating` hooks): a habit occurrence toggle fires exactly **1** row write, a
   non-habit toggle 1.
2. **Concurrent toggles match final state.** Probe fired `Promise.all([toggleDone(before, -1d),
   toggleDone(before, today)])` from one stale snapshot, 10 runs: both keys persisted and
   `after.data.streak` deep-equals `habitStreak(after)` (`current === 2`) every run. Non-vacuity: a
   probe emulating the old two-step (setStatus, read snapshot, then separate `patchItem` streak)
   persisted `streak.current === 1` while the final occurrence state required `2` — the exact hazard
   IMP-096 targets, now unreachable through `toggleDone`.
3. **Non-habit kinds unaffected.** `streakPatch` returns `null` for any `kind !== 'habit'`, so the
   patch is byte-identical in effect to before (the occurrence branch now omits the no-op
   `occurrences` key instead of re-writing it; `mergeItem` spreads, so the stored row is unchanged,
   `buildHistory` skips `occurrences`). Probe: task occurrence toggle → 1 write, 1 undo, no `Data`
   history entry, `data` unchanged.
4. **History / undo entries identical.** Probe emulated the previous two-step algorithm on a second
   identical habit and compared: the `field/oldValue/newValue` history signatures are equal, the
   final streak is equal, and both paths push exactly **1** undo entry (the streak no longer adds a
   second, `trackUndo: false` write).
5. **No-op writes nothing.** Probe replayed `toggleDone` with a stale todo prop against a stored
   `done` occurrence: 0 row writes, undo stack unchanged, stored occurrence intact. Whole-item
   branch returns `null` before computing a streak when `status`/`completedAt` already match.
6. **Undo restores prior streak.** Probe: one `undo()` restored both `occurrences` and the pre-toggle
   `data.streak`.

## Gates (clean tree, probe removed)

```
npm run typecheck   PASS
npm run lint        PASS
npm run format:check PASS
npm run test        PASS (46 files, 506 tests)
npm run build       PASS (tsc --noEmit && vite build; PWA sw.js generated)
```

## Notes / non-blocking

- `setStatus` now keeps `data.streak` in sync for *any* habit status write, not just `toggleDone`.
  No other habit status writer exists today; the impl report flags this explicitly. The no-op and
  history tests still pass, so it is behavior-preserving for current callers.
- Minor intended divergence from the old code: a habit no-op toggle previously still issued a
  streak `put`; it now writes nothing. This satisfies criterion 3 rather than regressing.
- IMP-097 (remaining `patchItem` read-then-write occurrence writers) is out of scope and still open.
