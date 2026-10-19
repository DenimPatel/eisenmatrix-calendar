# Dimensions

| Dimension | Health (1–5) | Open | Done | Blocked/Human | Last touched (date, IMP, SHA) | Biggest known gap | Recommended next |
|---|---|---|---|---|---|---|---|
| Bugs/Correctness | 4 | 21 | 70 | 1 blocked | 2026-10-18 IMP-144 1553d8b | mixed reminder import, series done | IMP-184, IMP-161, IMP-185/186 |
| Content | 4 | 0 | 0 | 1 human | — | no content work needed for an app | IMP-034 (human) |
| Visual | 3 | 9 | 6 | 0 | 2026-10-18 IMP-145 ae2052c | mobile voids, empty states, contrast | IMP-106/108/109, IMP-157/158 |
| UX/Interaction | 5 | 3 | 13 | 3 human | 2026-10-18 IMP-142 8d975f4 | first-occurrence preview, shopping add box | IMP-156, IMP-171 |
| Format/Structure | 4 | 0 | 0 | 0 | 2026-10-17 IMP-064 | none known | — |
| Delivery | 5 | 2 | 4 | 2 human | 2026-10-18 IMP-136 b26f352 | social metadata, non-hash 404 | IMP-149, IMP-178 |
| Performance | 4 | 2 | 5 | 0 | 2026-10-18 discovery | Today CLS 0.55, unbounded DOM on large DBs | IMP-151, IMP-180 |
| Accessibility | 4 | 10 | 12 | 0 | 2026-10-18 IMP-136 b26f352 | modal background in AX tree, calendar grid | IMP-146, IMP-150, IMP-152/153/173, IMP-188 |
| Docs/Onboarding | 4 | 0 | 3 | 0 | 2026-10-17 IMP-065 | none known | — |
| Tests/Tooling | 5 | 0 | 17 | 2 human | 2026-10-17 IMP-083 | Dependabot major PRs fail CI (pre-existing) | human |

**Bugs/Correctness (4):** Session 4 closed seven S2 defects on normal paths: split occurrence state
(IMP-139), reminders for done/cancelled occurrences (IMP-140), action-scoped toast Undo (IMP-141),
honest reminder rows across All-day toggles plus absolute snoozes (IMP-143/148), and malformed
occurrence overrides (IMP-144). Discovery also surfaced and itemized the adjacent maps still
unvalidated (IMP-184/185/186). Series-level `done` remains inconsistent (IMP-161); health stays 4.

**Content (4):** Not applicable beyond docs; only the license question is open for humans.

**Visual (3):** IMP-137 fixed the editor's clipped AM/PM and IMP-145 made the 28px ring label fit.
The remaining measured defects are mobile-only or below-AA: Lists' 111px void, calendar/Lists empty
states, dark-mode checkbox fill, and muted-on-accent-soft at 4.26:1. This is still the least-healthy
dimension, but the two highest-score visual items are now done.

**UX/Interaction (5):** Core flows (DnD, occurrence scope actions, editor tabs, overlays, mobile
nav) remain healthy. IMP-138 made the quick-add preview follow the user's overrides and IMP-142
closed the occurrence-scope subtask leak. The first-occurrence preview anchor and the Shopping add
box remain.

**Format/Structure (4):** Prettier is enforced in CI and drift is cleared; no open items.

**Delivery (5):** Deep-link refresh, offline reload, stale-SW prompt and mixed content all pass.
IMP-136 added per-route titles and announcements. Remaining items are S3 metadata/host polish (OG
cards, non-hash 404); the two human items are branch protection and dependency majors.

**Performance (4):** Route transitions and the year view remain fast. Discovery measured CLS 0.554
on Today with data and 9,011 DOM nodes in Lists at 580 items; both are future-headroom items.

**Accessibility (4):** IMP-136 gave every route a title, a one-shot focus target and one view
announcement. Remaining: modal backgrounds are still exposed in the AX tree, the month grid lacks
grid semantics/arrow movement, two segmented controls still lack selected state, and the lazy-route
fallback may double-announce (IMP-188).

**Docs/Onboarding (4):** Help dialog, AGENTS.md rename and the preview-SW reset procedure are done;
no open docs items.

**Tests/Tooling (5):** 77 files / 793 tests, five gates green, two consecutive full-suite runs and a
clean 40-capture regression sweep. Only the pre-existing Dependabot major PRs need a human.
