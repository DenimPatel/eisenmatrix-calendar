# Handoff — eisenmatrix-calendar

## State
Session resumed 2026-10-17 on `improve/auto-20261017` from `main` @ `cc609a4`. Baseline and
every item commit must pass typecheck, lint, tests (currently 33 files / 370 tests) and build.
IMP-069/070/054/059/071/072/073/074 are committed; 41 backlog items are DONE and 38 TODO
(plus 4 NEEDS-HUMAN, 1 BLOCKED).

## In flight
None.

## Recommended next (top TODO by score)
1. IMP-075 (12) — exclusive DTEND for multi-day all-day export.
2. IMP-076 (12) — merge setStatus into the persisted occurrence map.
3. IMP-025 (10) — tests for the itemActions write path.
4. IMP-026 (10) — unit tests for eisenhower.ts.
5. IMP-027 (10) — accessible names for Sheet and Dialog.

## New discoveries
IMP-087 (undo leaves pre-saved subtasks orphaned) and IMP-088 (view-level no-data crashes)
were added from verifier findings.

## Most neglected dimension
Visual and UX/Interaction: the session has been correctness-heavy. After the current batch,
schedule IMP-078 (duplicate daily habit on Today), IMP-079 (Escape closes topmost only) and
IMP-033 (ARIA state).

## Warnings
- `node_modules` is absent in a fresh checkout; run `npm install` first (benign allowScripts
  warning for esbuild/fsevents).
- Dependabot PRs for typescript 7 and @vitest/coverage-v8 5 fail CI; pre-existing major bumps.
- `.improve/FEATURES.md` is the canonical backlog (legacy layout); there is no `BACKLOG.md`.
- Push is disabled by `.git/hooks/pre-push`; all work stays local on the work branch.
- Date/recurrence/reminder semantics and Dexie migrations are high-risk; keep changes small.

## Commands
```bash
npm install
npm run typecheck && npm run lint && npm run test && npm run build
npm run preview   # http://localhost:4173/eisenmatrix-calendar/
```
