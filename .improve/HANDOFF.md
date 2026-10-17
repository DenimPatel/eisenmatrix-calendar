# Handoff — eisenmatrix-calendar

## State
Session 2 on `improve/auto-20261017` completed 25 improvement items (commits `cc609a4..be7edc1`,
plus state/format checkpoints). All four gates are green at the tip: typecheck, lint, 42 files /
455 tests, format:check and build. Three regression sweeps were CLEAN (60, 70 and final): 40/40
route/viewport/theme checks, all critical interactions, zero console errors and zero failed
requests (`reports/regression-60.md`, `regression-70.md`, `regression-final.md`).

Backlog: 93 items — **68 DONE**, 19 TODO, 5 NEEDS-HUMAN, 1 BLOCKED (`FEATURES.md`). Open TODOs
fell below the refill threshold (20), so the next session should start with a discovery round
before selecting more implementation work.

## In flight
None. Nothing pushed; the pre-push hook still blocks pushes.

## Recommended next (top by score / user impact)
1. IMP-038 (8) — validate imported JSON/CSV item shape before persisting (data integrity).
2. IMP-036 (8) — make reminder dedupe race-safe (duplicate/none delivery under races).
3. IMP-037 (8) — "This and future" editing of past occurrences + undo.
4. IMP-090 (8) — deep-normalize nested `target`/`metric` payloads (follow-up to IMP-088).
5. IMP-043 (8) — re-enable `no-explicit-any` (then IMP-046 docs rename, IMP-091 mobile headers).
Also schedule a discovery round (19 open TODOs < REFILL_THRESHOLD=20) and a visual audit.

## Most neglected dimension
Visual (health 3): no dedicated visual audit or visual item was completed; the sweeps show no
regressions but only cover existing layouts. UX and A11y are healthy after this session.

## Warnings
- IMP-094 is a known reachable gap: closing the top overlay unlocks body scroll behind the
  remaining modal (reproduced in every sweep; not a regression).
- IMP-096/097 are structural concurrency follow-ups from IMP-089 (habit streak derivation and
  the remaining read-then-write occurrence paths); no current UI repro.
- IMP-017 remains BLOCKED (quick-add particle trimming) pending a product decision.
- Dependabot major PRs for TypeScript 7 and @vitest/coverage-v8 5 still fail CI; pre-existing.
- `npm run test` runs twice in CI by design (IMP-083); locally once is enough.
- Preview browser checks must reset the service worker/caches first (documented in `agents.md`).
- `.improve/FEATURES.md` is the canonical backlog (legacy layout); there is no `BACKLOG.md`.

## Commands
```bash
npm install
npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build
npm run preview   # http://localhost:4173/eisenmatrix-calendar/
```
