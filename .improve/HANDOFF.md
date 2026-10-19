# Handoff — eisenmatrix-calendar

## State
Session 4 on `improve/auto-20261018` (from `main` @ `260551c`). Discovery round 4 added 49 items
(IMP-136..184). Rounds 1-8 DONE: IMP-136 (route titles), IMP-137 (time input), IMP-138 (quick-add
preview), IMP-139 (split occurrence state), IMP-140 (status-aware reminders), IMP-141 (scoped toast
Undo), IMP-142 (occurrence-scope subtasks), IMP-143 (All-day reminder reconciliation, also closing
IMP-148). Gates at IMP-143: typecheck, lint, 76 files / 775 tests, format:check, build all green.
Nothing pushed.

## Recommended next
1. IMP-144 (non-string override fields crash occurrence views on import, S2, 60)
2. IMP-145 (28px ProgressRing label overflows, S3, 60)
3. IMP-146 (modal background remains in the accessibility tree, S2, 54)
4. IMP-147 (count-limited split tails export a dishonest RRULE, S2, 54)
5. IMP-184 (mixed imported reminder shapes render two times, S2, 24)

## Warnings
- Preview 4173 is shared and holds seeded IndexedDB data; reset SW/caches and use a clean DB or an
  isolated port before judging screenshots.
- Keep independent verification and mutation-check tests; IMP-138 needed a follow-up test.
- IMP-017 BLOCKED on a product decision. Dependabot TS7 / coverage-v8 5 PRs fail CI (pre-existing).
- A hand-crafted import-only reminder with both timeOfDay and offsetMinutes still renders two times
  (IMP-184); no app path produces it.
- Discovery reports: `reports/discover4-{visual,ux,quality,delivery,followups}.md`.

## Commands
npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build
