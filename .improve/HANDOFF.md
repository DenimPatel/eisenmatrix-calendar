# Handoff — eisenmatrix-calendar

## State
Session 4 on `improve/auto-20261018` (from `main` @ `260551c`). Discovery round 4 added 48 items
(IMP-136..183). Rounds 1-5 DONE: IMP-136 (route titles, `b26f352`), IMP-137 (time input,
`058136f`), IMP-138 (quick-add preview, `fc84462`), IMP-139 (split occurrence state, `2378f61`),
IMP-140 (status-aware reminders). Gates at IMP-140: typecheck, lint, 74 files / 751 tests,
format:check, build all green. Nothing pushed.

## Recommended next
1. IMP-141 (toast Undo reverts the newest entry, not its action, S2, 72)
2. IMP-142 (Subtasks stay enabled under occurrence scope, S2, 67.5)
3. IMP-143 (All-day toggle leaves a contradictory reminder row, S2, 67.5)
4. IMP-144 (non-string override fields crash occurrence views on import, S2, 60)
5. IMP-145 (28px ProgressRing label overflows, S3, 60)

## Warnings
- Preview 4173 is shared and holds seeded IndexedDB data; reset SW/caches and use a clean DB or an
  isolated port before judging screenshots.
- Keep independent verification and mutation-check tests; IMP-138 needed a follow-up test.
- IMP-017 BLOCKED on a product decision. Dependabot TS7 / coverage-v8 5 PRs fail CI (pre-existing).
- Series-level `done` still resolves to todo (IMP-161), out of scope for IMP-140.
- Discovery reports: `reports/discover4-{visual,ux,quality,delivery,followups}.md`.

## Commands
npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build
