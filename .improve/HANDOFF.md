# Handoff — eisenmatrix-calendar

## State
Session 4 on `improve/auto-20261018` (from `main` @ `260551c`). Discovery round 4 added 48 items
(IMP-136..183); the 10-round loop is in progress. Rounds 1-2 DONE: IMP-136 (route titles +
announcements, `b26f352`) and IMP-137 (editor time input clip). Gates at IMP-137: typecheck, lint,
74 files / 725 tests, format:check, build all green. Nothing pushed (pre-push hook blocks;
merging to main deploys Pages).

## Recommended next
1. IMP-138 (quick-add preview ignores Kind/Date/Time overrides, S2, 90)
2. IMP-139 (series split drops per-occurrence done state, S2, 90)
3. IMP-140 (reminders fire for done/cancelled occurrences, S2, 90)
4. IMP-141 (toast Undo reverts the newest entry, not its action, S2, 72)
5. IMP-142 (Subtasks stay enabled under occurrence scope, S2, 67.5)

## Warnings
- Preview 4173 is shared and holds seeded IndexedDB data; reset SW/caches and use a clean DB or an
  isolated port before judging screenshots.
- Verifiers repeatedly catch real defects: keep independent verification and mutation-check tests.
- IMP-017 BLOCKED on a product decision. Dependabot TS7 / coverage-v8 5 PRs fail CI (pre-existing).
- Edit status files one item at a time; do not use a lazy regex across items.
- Discovery reports: `reports/discover4-{visual,ux,quality,delivery,followups}.md`.

## Commands
npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build
