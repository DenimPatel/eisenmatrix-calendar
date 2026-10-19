# Handoff — eisenmatrix-calendar

## State
Session 4 on `improve/auto-20261018` (from `main` @ `260551c`) is complete: discovery round 4 plus
10 improvement rounds (IMP-136..145; IMP-148 closed by IMP-143). Backlog: 184 items — 130 DONE,
46 TODO, 1 BLOCKED, 7 NEEDS-HUMAN. Gates: typecheck, lint, 77 files / 793 tests, format:check,
build all green; regression sweep CLEAN (`reports/regression-s4.md`). Full report:
`.improve/FINAL_REPORT.md`. Nothing pushed; merging to `main` deploys GitHub Pages.

## Recommended next
1. IMP-146 (modal background remains in the accessibility tree, S2, 54)
2. IMP-147 (count-limited split tails export a dishonest RRULE, S2, 54)
3. IMP-149 (Open Graph/Twitter metadata, S3, 45)
4. IMP-150 (occurrence-scope ARIA state, S3, 45)
5. IMP-151 (Today CLS 0.554 with data, S2, 45)

## Warnings
- Preview origins are service-worker cached; reset registrations/caches and use a clean DB or an
  isolated port before judging a rebuilt bundle (AGENTS.md). Discovery seeded 4173's IndexedDB.
- Import-only residuals: mixed reminder shapes (IMP-184), unvalidated `occurrences` map (IMP-185),
  checklist entries (IMP-187). No app path produces them.
- Series-level `done` still resolves to `todo` for occurrences (IMP-161); pre-existing, documented.
- IMP-017 BLOCKED on a product decision. Dependabot TS7 / coverage-v8 5 PRs fail CI (pre-existing).
- Keep independent verification and mutation-check tests; verifiers caught a coverage gap in
  IMP-138 and a residual shape in IMP-143 this session.

## Commands
npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build
