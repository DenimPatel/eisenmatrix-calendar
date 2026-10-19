# Dimensions

| Dimension | Health (1–5) | Open | Done | Blocked/Human | Last touched (date, IMP, SHA) | Biggest known gap | Recommended next |
|---|---|---|---|---|---|---|---|
| Bugs/Correctness | 4 | 23 | 63 | 1 blocked | 2026-10-18 discovery | split occurrence state, reminders for done/cancelled, toast-undo target | IMP-139, IMP-140, IMP-141 |
| Content | 4 | 0 | 0 | 1 human | — | no content work needed for an app | IMP-034 (human) |
| Visual | 3 | 10 | 5 | 0 | 2026-10-18 IMP-137 pending | ring label, mobile voids, empty states | IMP-145, IMP-106/108/109 |
| UX/Interaction | 5 | 3 | 13 | 3 human | 2026-10-18 IMP-138 pending | subtask scope, first-occurrence preview | IMP-142, IMP-156 |
| Format/Structure | 4 | 0 | 0 | 0 | 2026-10-17 IMP-064 | none known | — |
| Delivery | 5 | 2 | 4 | 2 human | 2026-10-18 IMP-136 | social metadata, non-hash 404 | IMP-149, IMP-178 |
| Performance | 4 | 2 | 5 | 0 | 2026-10-18 discovery | Today CLS 0.55, unbounded DOM on large DBs | IMP-151, IMP-180 |
| Accessibility | 4 | 9 | 12 | 0 | 2026-10-18 IMP-136 | modal background in AX tree, calendar grid | IMP-146, IMP-150, IMP-152/153/173 |
| Docs/Onboarding | 4 | 0 | 3 | 0 | 2026-10-17 IMP-065 | none known | — |
| Tests/Tooling | 5 | 0 | 17 | 2 human | 2026-10-17 IMP-083 | Dependabot major PRs fail CI (pre-existing) | human |

**Bugs/Correctness (4):** Session 3 closed the crash/data-loss classes (import shape, concurrency,
undo integrity). Discovery 4 found a new tier of S2 correctness bugs on normal paths: series splits
drop per-occurrence done state, reminders fire for cancelled/completed occurrences, malformed
import overrides crash occurrence views, and toast Undo can revert a newer action. Open count rose
because the discovery round added 19 well-evidenced items; health stays 4 until the top three land.

**Content (4):** Not applicable beyond docs; only the license question is open for humans.

**Visual (3):** Three regression sweeps found no visual regressions, but discovery 4 measured real
defects. IMP-137 fixed the editor time control's clipped AM/PM and added a width guard; the 28px
progress ring's label still overflows, mobile Lists reserves a 111px void, and dark-mode checkboxes
read as filled. Health stays 3 (lowest) until IMP-145 and the empty-state/spacing items land.

**UX/Interaction (5):** Core flows (DnD, occurrence scope actions, editor tabs, overlays, mobile
nav) verified healthy. IMP-138 made the quick-add preview follow the user's Kind/Date/Time
overrides and stopped a Note override from committing a promised recurrence. The remaining gaps are
the first-occurrence preview anchor and a scope promise broken by the enabled Subtasks block.

**Format/Structure (4):** Prettier is enforced in CI and drift is cleared; no open items.

**Delivery (5):** Deep-link refresh, offline reload, stale-SW prompt and mixed content all pass.
IMP-136 added per-route titles and route announcements. Remaining items are S3 metadata/host polish
(OG cards, non-hash 404); the two human items are branch protection and dependency majors.

**Performance (4):** Route transitions and the year view remain fast (IMP-131/133 hold). Discovery
measured a deterministic CLS 0.554 on the landing route with data and 9,011 DOM nodes in Lists at
580 items — headroom items, not present-day stalls.

**Accessibility (4):** Named dialogs, ARIA state/sort semantics, topmost Escape and route
announcements are in place. Discovery found the modal background still exposed in the AX tree, the
month grid lacking grid semantics/keyboard movement, and two bespoke segmented controls without
selected state.

**Docs/Onboarding (4):** Help dialog, AGENTS.md rename and the preview-SW reset procedure are done;
no open docs items.

**Tests/Tooling (5):** 74 files / 722 tests, Prettier/typecheck/lint/build gates in CI, route
splitting and a boot smoke test. Only the pre-existing Dependabot major PRs need a human.
