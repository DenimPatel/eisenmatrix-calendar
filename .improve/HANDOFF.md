# Handoff — eisenmatrix-calendar

## State
Session 4 on `improve/auto-20261018` (from `main` @ `260551c`). Discovery round 4 added 49 items
(IMP-136..184). All 10 planned rounds are DONE: IMP-136..145, plus IMP-148 closed by IMP-143.
Gates at IMP-145: typecheck, lint, 77 files / 793 tests, format:check, build all green. Final
regression sweep and session checkpoint are in progress. Nothing pushed.

## Recommended next
1. IMP-146 (modal background remains in the accessibility tree, S2, 54)
2. IMP-147 (count-limited split tails export a dishonest RRULE, S2, 54)
3. IMP-149 (Open Graph/Twitter metadata, S3, 45)
4. IMP-150 (occurrence-scope ARIA state, S3, 45)
5. IMP-184 (mixed imported reminder shapes render two times, S2, 24)

## Warnings
- Preview 4173 is shared and holds seeded IndexedDB data; reset SW/caches and use a clean DB or an
  isolated port before judging screenshots.
- Keep independent verification and mutation-check tests.
- IMP-017 BLOCKED on a product decision. Dependabot TS7 / coverage-v8 5 PRs fail CI (pre-existing).
- A hand-crafted import-only reminder with both timeOfDay and offsetMinutes still renders two times
  (IMP-184); no app path produces it.
- Discovery reports: `reports/discover4-{visual,ux,quality,delivery,followups}.md`.

## Commands
npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build
