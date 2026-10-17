# Dimensions

| Dimension | Health (1–5) | Open | Done | Blocked/Human | Last touched (date, IMP, SHA) | Biggest known gap | Recommended next |
|---|---|---|---|---|---|---|---|
| Bugs/Correctness | 4 | 14 | 44 | 1 blocked | 2026-10-17 IMP-089 be7edc1 | import shape validation, occurrence writer serialization | IMP-036, IMP-038, IMP-090 |
| Content | 4 | 0 | 0 | 1 human | — | no content work needed for an app | IMP-034 (human) |
| Visual | 3 | 0 | 0 | 0 | — | no visual audit this session | run a visual/UX sweep next |
| UX/Interaction | 5 | 2 | 3 | 1 human | 2026-10-17 IMP-079 e9fc259 | scope-switch reset, scroll-lock refcount | IMP-093, IMP-094 |
| Format/Structure | 4 | 0 | 1 | 0 | 2026-10-17 IMP-064 5feff5d | none known | — |
| Delivery | 5 | 0 | 6 | 3 human | 2026-10-17 IMP-081 0a185e4 | branch protection, icons, Tailwind major | IMP-067/047/048 (human) |
| Performance | 4 | 0 | 2 | 0 | 2026-10-17 IMP-060 fbcd4fd | none measured | — |
| Accessibility | 4 | 1 | 5 | 0 | 2026-10-17 IMP-079 e9fc259 | mobile List header semantics | IMP-091 |
| Docs/Onboarding | 4 | 1 | 1 | 0 | 2026-10-17 IMP-065 72094b6 | agent guide naming/link | IMP-046 |
| Tests/Tooling | 5 | 1 | 6 | 0 | 2026-10-17 IMP-083 2b3b358 | `no-explicit-any` re-enable | IMP-043 |

**Bugs/Correctness (4):** 13 correctness items closed this session, including the two known
crash/data-loss holes (IMP-088 no-`data` reads, IMP-089 concurrent occurrence writes) plus boot
recovery, occurrence-date seeding, atomic settings and undo integrity. Health rose from a weak 4;
the 14 remaining TODOs are narrower (import validation, split-tail guards, reminder reliability,
nested payloads, writer serialization), and IMP-017 stays BLOCKED on a product decision.
**Content (4):** not applicable beyond docs; only the license question is open for humans.
**Visual (3):** no visual regressions in three sweeps, but no dedicated visual audit has been run;
this is the least-evidenced dimension.
**UX/Interaction (5):** single-habit Today, topmost-only Escape, recoverable boot failures and
habit dedupe landed; scope-switch reset and scroll-lock refcounting remain.
**Format/Structure (4):** Prettier is enforced in CI and drift is cleared; only IMP-046's guide
rename remains (logged under Docs).
**Delivery (5):** main gates once, actions are SHA-pinned, Node is pinned, and Pages/CI stayed
green; remaining items need a human (branch protection, PNG icons, Tailwind major).
**Performance (4):** one shared items live query replaced twelve subscriptions; no measured
regression, no open performance items.
**Accessibility (4):** named dialogs, ARIA state/sort semantics and topmost Escape landed; the
mobile List header row is still hidden from the accessibility tree (IMP-091).
**Docs/Onboarding (4):** preview SW reset procedure documented and executed; the guide rename
and README link fix remain (IMP-046).
**Tests/Tooling (5):** 455 tests across 42 files (from 375/33), boot smoke observes migrations,
CI runs the suite twice; only the `no-explicit-any` rule re-enable remains (IMP-043).
