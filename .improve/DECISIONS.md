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
- **2026-10-17 — Session scope: 25 items; refill deferred.** The user asked for 25 improvement
  rounds. Discoveries were absorbed continuously (IMP-090..097), leaving 19 open TODOs — one
  below the refill threshold. A full discovery round is deferred to the next session rather than
  padding the backlog with speculative items; it is the first recommended action in HANDOFF.
- **2026-10-17 — IMP-078 formatting follow-up.** `9d95d8d` is a formatting-only commit for the
  test file added by IMP-078, because the new `format:check` CI gate would otherwise fail. It is
  tied to IMP-078 rather than a new item.
- **2026-10-17 — Status-file correction.** IMP-088 and IMP-089 were verified and committed but a
  shell-quoting slip left their FEATURES statuses as IN-PROGRESS/TODO; they were corrected to
  DONE in the final checkpoint. No code change was involved.
- **2026-10-17 — Visual dimension unaudited.** Three regression sweeps covered existing layouts
  but no dedicated visual audit was run; Visual remains at health 3 and is flagged for the next
  session.
