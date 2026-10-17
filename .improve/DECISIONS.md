# Decisions

- **2026-10-17 — Resume on `improve/auto-20261017`.** The previous run's commits are already on
  `main` and `origin/main` (deployed green). A new work branch was created from `main` per the
  improver's branch rule. Push policy remains `never`; `.git/hooks/pre-push` blocks pushes.
- **2026-10-17 — Legacy state layout kept.** The prior run used `.improve/FEATURES.md` as the
  canonical backlog and left no `BACKLOG.md`, `DIMENSIONS.md`, `CHANGELOG.md` or `HANDOFF.md`.
  `FEATURES.md` is preserved in place instead of duplicating 82 items; the missing state files
  were created from `STATE.md`, `PROGRESS.log` and the repo profile.
- **2026-10-17 — Baseline refreshed.** `npm install` was required (no `node_modules`). Gates:
  typecheck/lint clean, 32 files / 329 tests pass (profile previously recorded 31/302). Node is
  v24.21.0 in this shell, not v25.6.1.
- **2026-10-17 — Known CI failures are Dependabot majors.** Typescript 7 and coverage-v8 5 PRs
  fail; this predates the session and is recorded as pre-existing, not a regression.
