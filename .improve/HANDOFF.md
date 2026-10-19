# Handoff — eisenmatrix-calendar

## State
Session 4 on `improve/auto-20261018` (from `main` @ `260551c`). Discovery round 4 added 48 items
(IMP-136..183) from five audits; the 10-round implementation loop is in progress.
Round 1 DONE: IMP-136 (per-route titles + view announcements). Current tip: discovery commit
`2ff6b3d` plus the IMP-136 commit. Gates at IMP-136: typecheck, lint, 74 files / 722 tests,
format:check, build all green. Nothing pushed (pre-push hook blocks; merging to main deploys Pages).

## Recommended next
1. IMP-137 (editor time input clips AM/PM, S2, score 90)
2. IMP-138 (quick-add preview ignores Kind/Date/Time overrides, S2, 90)
3. IMP-139 (series split drops per-occurrence done state, S2, 90)
4. IMP-140 (reminders fire for done/cancelled occurrences, S2, 90)
5. IMP-141 (toast Undo reverts the newest entry, not its action, S2, 72)

## Warnings
- Preview at port 4173 was shared by discovery subagents and holds seeded IndexedDB data; reset
  SW/caches and use a clean DB or an isolated port before judging screenshots.
- Verifiers repeatedly catch real defects on first attempt (sessions 3-4): keep independent
  verification, and mutation-check new tests.
- IMP-017 BLOCKED on a product decision. Dependabot TS7 / coverage-v8 5 PRs fail CI (pre-existing).
- Status files are edited one item at a time; do not use a lazy regex across items.
- Discovery reports: `reports/discover4-{visual,ux,quality,delivery,followups}.md`.

## Commands
npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build
