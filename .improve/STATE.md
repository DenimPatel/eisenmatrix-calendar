# Improver State

- **Phase:** 4 — Improvement loop (active)
- **Work branch:** improve/auto-20261003
- **Start SHA:** b9d23246b948187c0239e8c95373e3e1f27cc43f
- **Last commit:** ff5cb5b (discovery round 1)
- **Current item:** (none — between items)
- **Counters:** commits=34 | done=28 | blocked=1 | needs-human=4 | attempts_current=0
- **Playwright MCP:** available and working in sub-agents (all visual verifications ran live)
- **Regression cadence:** every 10 commits — sweeps at 10, 20, 30 all CLEAN; next at 40
- **Stop file:** .improve/STOP (absent)

## Backlog summary (82 items)
- DONE 28, BLOCKED 1 (IMP-017), NEEDS-HUMAN 4 (IMP-034 license, IMP-047 PNG icons, IMP-048 Tailwind v4, IMP-067 required status check), TODO 49.
- Highest-priority remaining TODO (score order): IMP-052 (ICS folding, 12), IMP-053 (calendar +N more, 12), IMP-054 (quick-add data on kind change, 12), IMP-055 (occurrence delete should skip, 12), IMP-056 (prune snoozes, 12), IMP-024 (mobile nav reachability, 10), IMP-025 (itemActions write-path tests, 10), IMP-026 (eisenhower tests, 10), IMP-027 (Sheet/Dialog accessible name, 10), IMP-029 (pin Node, 10), IMP-031 (CSV quote, 10), IMP-032 (bill payments total, 10), IMP-033 (ARIA toggles, 10), IMP-035 (settings RMW race, 8), IMP-036 (reminder dedupe race, 8), IMP-037 (this-and-future + undo, 8), IMP-038 (validate imported shape, 8), IMP-039 (error boundary, 8), IMP-040 (updateOccurrence fields, 8), IMP-041 (null-guard parseLocalDate, 8), IMP-042 (swallowed errors, 8), IMP-043 (no-explicit-any, 8), then IMP-059..066 (low) and IMP-069..086 (new, 15->6).
- NOTE: IMP-011 (score 15) is DONE; the "next TODO" listing in the file order can mislead because DONE items remain in place — always select by Status, not file position.

## Baseline
Green from the start: typecheck clean, lint clean, tests 10 files/49, build OK. Now 29 files/279 tests. Only quirks: benign Node `--localstorage-file` warning; 12 npm advisories (9 high, 0 critical, dev toolchain) covered by IMP-022's critical-only audit gate.

## Orchestrator lessons (do not repeat)
1. **Never issue two edits to `.improve/FEATURES.md` in the same tool batch** — a concurrent edit clobbered IMP-011's status flip and it silently stayed TODO for 20 commits. Always edit one region per message and re-verify the status right after.
2. Keep the file invariant `count('^### IMP-') == count('^- **Status:**')`; check it after every backlog edit (a sub-agent once dropped an adjacent item heading).
3. An implementer may prematurely mark an item DONE; revert it and tell the verifier the status is not evidence.
4. A sub-agent can be interrupted mid-work with its code edits already on disk. Judge the working tree, not the (stale) report, and re-verify from scratch.
5. A verifier may return an empty result — simply re-launch it.
6. Always stage explicit paths; `git add -A` would sweep the untracked `.kilo/` directory.
7. `.improve/PROGRESS.log` is force-added (`*.log` is gitignored) and always trails by one commit by design.
8. Test-suite determinism must be proven, not assumed: two items (IMP-015, IMP-021) shipped flaky tests and IMP-021 also had a silent back-compat regression.