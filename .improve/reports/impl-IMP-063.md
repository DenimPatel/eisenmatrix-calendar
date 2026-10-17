# IMP-063 — Implementation report

**Status:** implemented — retry 2 (independent verification FAIL fixed; all checks pass; `.improve/` state files untouched by this change)

## Files changed

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | Removed the `push: branches: [main]` trigger; kept `pull_request`, `workflow_dispatch`, `workflow_call`. Added workflow-level `concurrency` keyed on `${{ github.workflow }}-ci-${{ github.ref }}` with `cancel-in-progress: true`. |
| `.github/workflows/deploy.yml` | Added the workflow-level `concurrency` block keyed on `${{ github.workflow }}-${{ github.ref }}`. The `gate` job still calls `./.github/workflows/ci.yml`, and `deploy` still declares `needs: [build, gate]`. |

Option (a) from the acceptance criteria was chosen: the `main` push trigger was removed
from `ci.yml`, so the `workflow_call` gate inside `deploy.yml` is the sole gate run for a
`main` push. This is the least invasive option and leaves Pages deploy gating intact.

## Trigger logic

Before:

- `ci.yml`: `pull_request`, `push` on `main`, `workflow_dispatch`, `workflow_call`.
- `deploy.yml`: `push` on `main`, `workflow_dispatch`; its `gate` job calls `ci.yml`.
- One push to `main` started a standalone CI run **and** a Deploy run whose reusable
  workflow call ran the gate again — two gate executions per push.

After:

- `ci.yml`: `pull_request`, `workflow_dispatch`, `workflow_call`.
- `deploy.yml`: `push` on `main`, `workflow_dispatch`; `gate` calls `ci.yml`.
- One push to `main` starts only the Deploy workflow; its `gate` job is the single gate
  execution. `deploy` requires both `build` and `gate`, so a failed gate still blocks
  Pages deployment.
- `pull_request` gating is unchanged (CI runs directly on the PR ref).
- Manual `ci.yml` dispatch runs the gate standalone; manual `deploy.yml` dispatch runs it
  through the `gate` job.

Concurrency groups are deliberately distinct. Inside a called reusable workflow the
`github` context is caller-scoped, so in the `gate` call `github.workflow` resolves to
`Deploy to GitHub Pages`. The suffix `-ci-` makes the called gate's group
`Deploy to GitHub Pages-ci-refs/heads/main`, which differs from Deploy's own
`Deploy to GitHub Pages-refs/heads/main`; the caller therefore cannot cancel or deadlock
the called workflow, and `cancel-in-progress: true` is retained. Standalone runs on a PR
resolve to `CI-ci-refs/pull/N/merge` and cancel superseded runs per PR. `deploy.yml`'s
group is unchanged.

Chosen option is recorded here because this change was not committed (per task rules the
future commit message should say: "ci: drop redundant main push trigger, add concurrency").

### Retry 2 (2026-10-17)

Independent verification (`.improve/reports/verify-IMP-063.md`) found that the original
CI group `${{ github.workflow }}-${{ github.ref }}` collided with Deploy's group when
`ci.yml` runs via `workflow_call`, cancelling the caller on every `main` push. The CI
group was changed to `${{ github.workflow }}-ci-${{ github.ref }}`; nothing else changed.
Re-validated YAML, Prettier, and the main-push structure below.

## Validation

- `python3 -c 'yaml.safe_load(...)'` — both workflows parse OK.
- `ruby -e 'YAML.load_file(...)'` — both workflows parse OK.
- `npx prettier --check .github/workflows/ci.yml .github/workflows/deploy.yml` — PASS.
- `actionlint` is not installed and was not added (no new dependencies); the two parser
  checks above were used instead.
- Grep confirms distinct `concurrency:` groups in both files, no `push` trigger in
  `ci.yml`, exactly one gate invocation on `main` (`deploy.yml:19` →
  `uses: ./.github/workflows/ci.yml`), and `deploy` still gated by `needs: [build, gate]`
  (`deploy.yml:45`); `pull_request` remains in `ci.yml:4`.
- Called-gate group on `main`: `Deploy to GitHub Pages-ci-refs/heads/main`; Deploy group:
  `Deploy to GitHub Pages-refs/heads/main` — distinct, so no cancellation/deadlock.

## Gates (retry 2 re-run)

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run test` — PASS, 41 files / 425 tests (baseline 425).
- `npm run build` — PASS in retry 1 (precache 18 entries, 620.63 KiB, `dist/sw.js`
  generated); no source files changed in retry 2, so it was not re-run.

## Notes

- No other workflows or secrets were touched.
- See `discovered-IMP-063.md` for one unrelated documentation drift observation.
