# Improver State

- **Phase:** 4 — Improvement loop
- **Work branch:** improve/auto-20261003
- **Start SHA:** b9d23246b948187c0239e8c95373e3e1f27cc43f
- **Last commit:** IMP-020 (see PROGRESS.log for SHA)
- **Current item:** (none)
- **Counters:** commits=28 | done=25 | blocked=1 | needs-human=0 | attempts_current=0
- **Playwright MCP:** available
- **Regression cadence:** every 10 commits — sweeps at 10 and 20 both CLEAN; next at 30
- **Stop file:** .improve/STOP (absent)

## Backlog summary
- Items total: 52. DONE: IMP-001. TODO: 48. NEEDS-HUMAN: 3 (IMP-034, IMP-047, IMP-048).
- Select next: highest-priority TODO with all deps DONE. Next candidates: IMP-002 (deep descendant delete), IMP-003 (undo restore descendants), IMP-004 (cascade bulk delete), IMP-005 (CI quality gate), IMP-006 (stats tests), IMP-049 (calendar weekStartsOn).

## Resume notes
Baseline green; quirks: benign Node --localstorage-file warning, npm audit dev-toolchain advisories.
Playwright baseline screenshots (21) in .improve/artifacts/baseline/ (git-excluded).
PROGRESS.log is appended immediately after each commit with the resulting SHA.
