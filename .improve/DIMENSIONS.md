# Dimensions

| Dimension | Health (1–5) | Open | Done | Blocked/Human | Last touched | Biggest known gap | Recommended next |
|---|---|---|---|---|---|---|---|
| Bugs/Correctness | 4 | 6 | 37 | 1 | 2026-10-17 IMP-077 | concurrency, nested payloads | IMP-089, IMP-090 |
| Content | 4 | 1 | 0 | 1 | — | no content work needed for an app | IMP-034 (human) |
| Visual | 3 | 1 | 0 | 0 | — | no recent visual audit | IMP-078 |
| UX/Interaction | 4 | 4 | 4 | 0 | 2026-10-17 IMP-078 | Escape stacking, scope-switch reset | IMP-079, IMP-093 |
| Format/Structure | 4 | 1 | 1 | 0 | 2026-10-17 IMP-064 | agent guide naming | IMP-046 |
| Delivery | 5 | 2 | 5 | 1 | 2026-10-17 IMP-081 | branch protection, workflow breadth | IMP-067 (human) |
| Performance | 3 | 1 | 0 | 0 | — | per-component live queries | IMP-060 |
| Accessibility | 4 | 2 | 5 | 0 | 2026-10-17 IMP-033 | mobile header semantics | IMP-091 |
| Docs/Onboarding | 4 | 2 | 1 | 1 | 2026-10-17 IMP-065 | agent guide naming | IMP-046 |
| Tests/Tooling | 4 | 1 | 11 | 0 | 2026-10-17 IMP-066 | boot smoke reliability | IMP-083 |

**Bugs/Correctness (4):** 43 items done overall; IMP-074/075 fixed ICS export and IMP-076 made
occurrence status writes merge into the persisted map. IMP-088 (view-level no-data reads) and
IMP-089 (fully concurrent occurrence writes) are queued. Remaining TODOs are narrower.
**Content (4):** the app has no editorial content dimension; the one open item is a license
question for humans, and one label-level fix remains (IMP-046).
**Visual (3):** no visual regressions in the last sweep; mobile nav was fixed, but no visual
baseline audit has been run in this session.
**UX/Interaction (3):** calendar expansion and mobile nav landed; focus timing, Escape stacking
and duplicate habits on Today remain observable.
**Format/Structure (3):** source is formatted ad hoc; Prettier is not enforced in CI and the
duplicate `agents.md`/`AGENTS.md` naming issue remains.
**Delivery (4):** Pages deploy, PWA build and Dependabot are healthy; CI runs the gate twice on
main and workflow actions use floating tags rather than SHAs.
**Performance (3):** 12 components each open their own items live query; no user-visible
regression measured yet.
**Accessibility (3):** IMP-059 removed the 20 ms focus delay, so overlays focus in the mount
commit and the first keystroke is captured; mobile nav remains fixed. Sheet/Dialog still lack
accessible names and several toggles/sort headers lack ARIA state.
**Docs/Onboarding (3):** AGENTS.md is accurate; the preview service-worker reset needed by
browser verification is undocumented.
**Tests/Tooling (4):** 375 tests across 33 files, suite green and deterministic across repeated
runs; itemActions write paths and eisenhower logic still lack direct tests.
