# Session 4 final report — eisenmatrix-calendar

**Dates:** 2026-10-18/19 · **Branch:** `improve/auto-20261018` (from `main` @ `260551c`) ·
**Session scope:** discovery + 10 improvement rounds · **Push:** none (pre-push hook blocks).

## Commits
- Discovery: `2ff6b3d` `chore(improve): discovery round 4 (+48 items)`
- Rounds: `b26f352` IMP-136 · `058136f` IMP-137 · `fc84462` IMP-138 · `2378f61` IMP-139 ·
  `383a839` IMP-140 · `25db21c` IMP-141 · `8d975f4` IMP-142 · `a622caf` IMP-143 ·
  `1553d8b` IMP-144 · `ae2052c` IMP-145
- Final state checkpoint follows this file.
- Review: `git log --oneline 260551c..HEAD`

## Items
10 rounds DONE: IMP-136..145. IMP-148 was closed by IMP-143's implementation (absolute reminders
render read-only; no offset select) and is recorded as DONE with a cross-reference.
Discovery added 53 backlog items (IMP-136..188). Final backlog: **184 items — 130 DONE, 46 TODO,
1 BLOCKED, 7 NEEDS-HUMAN.**

| Dimension | Health start → end | Done this session | Remaining |
|---|---|---|---|
| Bugs/Correctness | 4 → 4 | 139, 140, 141, 143, 144, 148 | 21 open (incl. IMP-017 blocked) |
| UX/Interaction | 5 → 5 | 138, 142 | 3 open + 3 human |
| Visual | 3 → 3 | 137, 145 | 9 open (least healthy) |
| Accessibility | 4 → 4 | 136 | 10 open |
| Delivery | 5 → 5 | (136 cross-cut) | 2 open + 2 human |
| Performance | 4 → 4 | — | 2 open |
| Tests/Tooling | 5 → 5 | +86 tests (707 → 793) | 2 human (Dependabot) |
| Format/Docs/Content | 4/4/4 | — | 0 open |

No dimension moved a full health point: the fixes were real S2/S3 defects, but every dimension
still has substantive open work, and the score is deliberately conservative.

## Highlights
- **Correctness/data integrity:** series splits now partition per-occurrence done/cancelled state
  (IMP-139); reminders no longer fire for done/cancelled occurrences (IMP-140); toast Undo is
  scoped to its own action instead of the newest entry (IMP-141); reminder rows never show two
  times across the All-day toggle and absolute snoozes are readable (IMP-143/148); malformed
  imported overrides are dropped whole instead of crashing every occurrence view (IMP-144).
- **Accessibility:** every route sets a distinct title, moves focus once and announces the view,
  with initial loads silent (IMP-136).
- **UX/visual:** quick-add preview chips follow Kind/Date/Time overrides (IMP-138); Subtasks are
  locked under "This occurrence" (IMP-142); editor time input shows full AM/PM (IMP-137); the 28px
  progress ring label fits (IMP-145).
- **Discovery:** five audits produced 50 candidates; four residual discoveries were absorbed as
  IMP-185..188 (state-map/checklist validation, override-map partitioning, double announcements).

## Verification
All five gates green at `ae2052c`: typecheck, lint, **77 files / 793 tests** (run twice), Prettier
check, production build. Final regression sweep `reports/regression-s4.md` **CLEAN**: 10 routes ×
2 viewports × 2 themes (40 captures), 20 deep-link load+reloads, key flows, zero console errors,
zero failed requests, zero overflow. Session fixes were re-observed live.

## BLOCKED / NEEDS-HUMAN (exact questions)
- **IMP-017 (BLOCKED):** Should quick-add strip a trailing preposition when the word can be a
  phrasal particle? Evidence: every previous attempt deleted real words ("Log in" → "Log",
  "Stand by" → "Stand"). Prefer leaving a harmless dangling preposition over eating a real word
  unless a product decision says otherwise.
- **IMP-034:** Who is the copyright holder and year for the MIT LICENSE?
- **IMP-047:** Supply/approve PNG PWA icon artwork (installers that ignore SVG).
- **IMP-048:** Approve the Tailwind v4 major migration (breaking; clears audit advisories).
- **IMP-067:** Apply branch protection on `main` requiring the CI gate (repo settings, not versioned).
- **IMP-095:** When an editor with draft subtasks is cancelled, discard, keep, or warn?
- **IMP-127:** How should notes attach to an item (product decision)?
- **IMP-128:** How should absolute one-off reminders be created (product decision)?

## Risks / warnings
- Preview origin 4173 is service-worker cached; reset registrations/caches before judging a
  rebuilt bundle (AGENTS.md). Discovery subagents also seeded its IndexedDB.
- Mixed imported reminder shapes (IMP-184) and unvalidated `occurrences`/checklist maps
  (IMP-185/187) remain import-only edge hazards; no app path produces them.
- Series-level `done` still resolves to `todo` for occurrences (IMP-161) — pre-existing,
  documented, out of scope for IMP-140.
- Dependabot TypeScript 7 and coverage-v8 5 PRs fail CI; pre-existing, needs a human decision.
- Nothing was pushed. Merging this branch to `main` deploys GitHub Pages.
