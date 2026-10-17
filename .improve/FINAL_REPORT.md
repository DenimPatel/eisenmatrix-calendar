# Final Report — Improver Session 2 (2026-10-17)

## Summary
Twenty-five backlog items were implemented, independently verified and committed on the local
branch `improve/auto-20261017` (starting at `ef0775c`). Twenty-five item commits plus one
formatting follow-up landed; every gate stayed green and three regression sweeps (60, 70 and
final) were **CLEAN** with zero console errors and zero failed requests.

**Nothing was pushed.** The pre-push hook still blocks pushes; `main` and the Pages deployment
are unchanged by this session.

Review with: `git log --oneline ef0775c..HEAD`

## Items completed (25/25)
| Item | Commit | Effect |
|---|---|---|
| IMP-025 | f27dff6 | itemActions write paths have direct create/edit/undo/occurrence tests |
| IMP-027 | aeea3e3 | Sheet and Dialog expose accessible names and descriptions |
| IMP-031 | 2e455ce | CSV mid-field quotes parse literally instead of corrupting the row |
| IMP-029 | 9647e37 | Node 20 declared in engines and pinned in `.nvmrc` |
| IMP-088 | e1ea1ff | Repository reads normalize missing `data`; no view blanks |
| IMP-033 | 8a164e1 | Toggles expose `aria-pressed`; List uses real table/`aria-sort` semantics |
| IMP-032 | c52c7b8 | Monthly Paid sums recorded payments, not the edited bill amount |
| IMP-026 | 3afe7fb | eisenhower mapping, scoring and partitioning covered |
| IMP-061 | ce661e3 | `deleteItems([])` is a true no-op, preserving prior undo |
| IMP-039 | f916b43 | Render and boot/storage failures show a recoverable fallback |
| IMP-063 | 765d09d | Main pushes gate once; superseded runs cancel without cancelling the caller |
| IMP-064 | 5feff5d | Prettier enforced in CI; five drifted files formatted |
| IMP-065 | 72094b6 | Preview SW reset and focus-trap event target documented |
| IMP-062 | 692dc5f | CRLF-pasted quick-add notes store no carriage returns |
| IMP-066 | d18883e | Remaining `useData` hooks covered; fallback serialization stabilized |
| IMP-077 | e9807ef | Occurrence editor seeds and saves the occurrence's own date |
| IMP-078 | 628f42c | Daily habits appear once on Today, in the Habits panel |
| IMP-081 | 0a185e4 | GitHub Actions pinned to reviewed commit SHAs |
| IMP-079 | e9fc259 | One Escape closes only the topmost overlay; focus returns inside |
| IMP-080 | b9934d5 | Failed migration reruns report an error and preserve the marker |
| IMP-035 | 8605686 | Theme and Settings merge atomically; concurrent writes both survive |
| IMP-060 | fbcd4fd | One shared items live query replaces twelve per-component subscriptions |
| IMP-087 | 3001432 | Undoing an editor-created parent removes its new subtasks |
| IMP-083 | 2b3b358 | Boot smoke test asserts migration markers; CI runs the suite twice |
| IMP-089 | be7edc1 | Concurrent occurrence status writes are atomic and lose no key |
| IMP-078 | 9d95d8d | Formatting follow-up so the new format gate stays green |

Four items needed a second attempt after independent verification found real defects:
IMP-033 (aria-sort on buttons with no columnheader role), IMP-063 (called-workflow concurrency
group cancelled its Deploy caller), IMP-077 (occurrence seeding truncated non-recurring
multi-day all-day ends), and IMP-078 (unformatted test broke the new format gate; fixed in a
follow-up commit). They were re-verified by fresh verifiers.

## New backlog items discovered (8)
- **IMP-090** (8) — deep-normalize nested `target`/`metric` payloads (follow-up to IMP-088).
- **IMP-091** (6) — mobile List hides its header row from the accessibility tree.
- **IMP-092** (6) — catch ReminderRuntime prune rejections on blocked storage.
- **IMP-093** (6) — switching scope to "future" discards pre-switch schedule edits.
- **IMP-094** (6) — body scroll unlocks behind a surviving modal after the top layer closes.
- **IMP-095** (NEEDS-HUMAN) — decide whether cancelling an editor discards draft subtasks.
- **IMP-096** (6) — habit streak derivation is still a separate non-atomic write.
- **IMP-097** (6) — remaining occurrence edit writers still read-then-write.

## Backlog state
- 93 items: **68 DONE**, 19 TODO, 5 NEEDS-HUMAN, 1 BLOCKED.
- Tests: 42 files / **455 passing** (was 33 / 375 at session start; +80).
- Typecheck, lint, test, format:check and build all pass at the final tip.
- Open TODOs (19) are below the refill threshold (20), so a discovery round is due first next
  session.

## Dimension health (start → end)
| Dimension | Start | End | Notes |
|---|---|---|---|
| Bugs/Correctness | 4 | 4 | 13 correctness items closed; remaining TODOs are narrower |
| Accessibility | 3 | 4 | names, ARIA state/sort, topmost Escape; mobile header follow-up |
| UX/Interaction | 3 | 5 | boot recovery, habit dedupe, overlay stack; 2 follow-ups |
| Tests/Tooling | 4 | 5 | +80 tests, dep-aware hooks, boot-effect smoke test |
| Visual | 3 | 3 | clean sweeps but no dedicated visual audit |
| Delivery | 4 | 5 | single gate, concurrency, SHA pinning, Node pin |
| Performance | 3 | 4 | shared items subscription |
| Docs/Onboarding | 3 | 4 | preview SW reset documented |
| Format/Structure | 3 | 4 | Prettier enforced and drift cleared |
| Content | 4 | 4 | not applicable beyond the license question |

## Verification evidence
- Every item: fresh implementer + fresh verifier, gates run by both, browser checks for UI work.
- Sweeps: `.improve/reports/regression-60.md`, `regression-70.md`, `regression-final.md`
  (40/40 route/viewport/theme checks each, critical interactions, 0 console errors/requests).
- Screenshots and exports: `.improve/artifacts/regression-*/` (git-excluded).
- Concurrency and format gates were mutation-checked (tests fail on the prior code).

## BLOCKED / NEEDS-HUMAN
- **IMP-017 (BLOCKED)** — quick-add trailing-particle trimming needs a product decision on
  which trailing words are safe to remove; 3 attempts were exhausted in an earlier session.
- **IMP-034 (NEEDS-HUMAN)** — choose the license copyright holder/year for the MIT LICENSE.
- **IMP-047 (NEEDS-HUMAN)** — supply PNG PWA icons for installers that ignore SVG.
- **IMP-048 (NEEDS-HUMAN)** — approve planning the Tailwind v4 major migration.
- **IMP-067 (NEEDS-HUMAN)** — make the CI gate a required status check on `main`.
- **IMP-095 (NEEDS-HUMAN)** — "When a user adds subtasks in the editor and cancels without
  saving the parent, should those subtasks be discarded, kept, or should the app warn?"

## Known risks / warnings
- IMP-094 (scroll lock behind stacked modals) is reachable and reproduced in sweeps.
- IMP-096/097 are structural concurrency follow-ups; no current UI repro.
- Dependabot major PRs for TypeScript 7 and @vitest/coverage-v8 5 still fail CI (pre-existing).
- Visual quality is the least-evidenced dimension; schedule an audit next session.
- `.improve/FEATURES.md` remains the canonical backlog (legacy layout, no `BACKLOG.md`).

## Recommended next session
1. Run a discovery round (open TODOs below the refill threshold), then re-score and balance.
2. IMP-038, IMP-036, IMP-037 and IMP-090 (all score 8) — import validation, reminder dedupe,
   future-scope editing, nested payloads.
3. IMP-043 (`no-explicit-any`) then IMP-046 (guide rename) and IMP-091 (mobile headers).
4. Schedule a visual audit; it has had no dedicated work in two sessions.
