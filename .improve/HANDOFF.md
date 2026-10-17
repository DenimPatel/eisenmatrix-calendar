# Handoff — eisenmatrix-calendar

## State
Session resumed 2026-10-17 on `improve/auto-20261017` from `main` @ `cc609a4`. Baseline and
every item commit must pass typecheck, lint, tests (currently 32 files / 332 tests) and build.
IMP-069, IMP-070, IMP-054, IMP-059 and IMP-071 are committed; 38 backlog items are DONE and
41 TODO (plus 4 NEEDS-HUMAN, 1 BLOCKED).

## In flight
None.

## Recommended next (top TODO by score)
1. IMP-072 (12) — reject unrecognized import files.
2. IMP-073 (12) — consume every schedule token in quick add.
3. IMP-074 (12) — emit a floating UNTIL to match floating DTSTART.
4. IMP-075 (12) — exclusive DTEND for multi-day all-day export.
5. IMP-076 (12) — merge setStatus into the persisted occurrence map.

## New discoveries
IMP-087 (undo leaves pre-saved subtasks orphaned) and IMP-088 (view-level no-data crashes)
were added from verifier findings.

## Most neglected dimension
Visual and UX/Interaction: recent commits concentrated on correctness. Interleave IMP-059,
IMP-078 and IMP-079 rather than running ten correctness items in a row.

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
