# Verify — IMP-063: CI concurrency groups and one gate run on `main`

Reviewer: independent (did not author the change)
Branch: `improve/auto-20261017`, working tree uncommitted
Date: 2026-10-17

**VERDICT: FAIL** — criteria 1/2 are met only syntactically; the chosen concurrency
group makes the gate deadlock with (or cancel) the Deploy run on every push to `main`.

## Scope reviewed

`git diff` for the workflows is limited to:

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Removed `push: branches: [main]`; added top-level `concurrency: group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true` |
| `.github/workflows/deploy.yml` | Added the identical top-level `concurrency` block |

No other workflow behavior, permissions, secrets, paths, actions, or jobs changed. The
remaining `.improve/` edits in the working tree are session metadata from IMP-039, not
part of this change.

## Acceptance criteria

1. **FAIL (syntactically present, unsafe).** Both files declare a per-ref group with
   `cancel-in-progress: true` (`ci.yml:8-10`, `deploy.yml:8-10`). However, `ci.yml` is
   also the reusable workflow called by `deploy.yml:19`, and the group is not unique in
   that context (see below).
2. **FAIL in practice / PASS syntactically.** `push` on `main` now triggers only
   `deploy.yml`; its `gate` job calls `ci.yml` once, and `ci.yml` no longer has a `main`
   push trigger. Exactly one gate *invocation* is defined. But the call's concurrency
   evaluation cancels/deadlocks the caller run before any job starts, so zero gate runs
   complete per `main` push. The chosen option is recorded in the impl report, not yet in
   a commit message (the change is uncommitted).
3. **Structurally met, operationally broken.** `deploy` still has `needs: [build, gate]`
   (`deploy.yml:45`) and `pull_request` gating in `ci.yml:4` is unchanged. The dependency
   graph is intact, but the caller run is cancelled before `build`/`gate` can run, so
   deployment never succeeds.

## Concurrency semantics (decisive)

GitHub's reusable-workflow reference states:

> When a reusable workflow is triggered by a caller workflow, the `github` context is
> always associated with the caller workflow.

and, in the supported-keywords note:

> If you use `jobs.<job_id>.concurrency.cancel-in-progress: true`, don't use the same
> value for `jobs.<job_id>.concurrency.group` in the called and caller workflows as this
> will cause the workflow that's already running to be cancelled. A called workflow uses
> the name of its caller workflow in `${{ github.workflow }}` …

Therefore, inside the called `ci.yml`:

- `github.workflow` = **`Deploy to GitHub Pages`**
- `github.ref` = `refs/heads/main`
- called gate group = `Deploy to GitHub Pages-refs/heads/main`

`deploy.yml`'s own top-level group is **the same string**. A called workflow's top-level
`concurrency` is applied to the calling job; with the caller's top-level run already
holding the group, GitHub detects a deadlock (`cancel-in-progress: false` case, observed
in the wild) or cancels the running caller (`cancel-in-progress: true`). Either way,
every `main` push produces a cancelled/failed Deploy run with no jobs. The implementation
report's claim of "no collision" (`impl-IMP-063.md:36-38`) is incorrect: it compares
against standalone PR CI, not against the Deploy run that calls it.

Standalone PR runs are fine (`github.workflow` = `CI`, group
`CI-refs/pull/N/merge`), so only the `main` path is broken.

**Exact fix:** make the CI group distinct in every context, e.g. in `ci.yml`:

```yaml
concurrency:
  group: ${{ github.workflow }}-ci-${{ github.ref }}
  cancel-in-progress: true
```

or a static `ci-${{ github.ref }}`. Leave `deploy.yml` as-is. `github.workflow_ref` does
not fix this: the `github` context is caller-scoped, so it resolves to the caller's
workflow too. (The `job.workflow_ref` context identifies the called file, but the `job`
context is not allowed in `concurrency`.)

## Validation evidence

- `ruby -e 'require "yaml"; YAML.load_file(…)'` — both files parse.
- `npx prettier --check .github/workflows/ci.yml .github/workflows/deploy.yml` — PASS.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run test` — PASS, 41 files / 425 tests (expected 425).
- `actionlint` is not installed; no new dependency added.
- Gate count on `main`: one `uses: ./.github/workflows/ci.yml` (deploy.yml:19), no CI
  `push` trigger.

## Suggested health delta

**Delivery: 4 → 4 (hold).** The duplicate-gate gap is closed on paper, but the change
must not merge as-is; if it did, Delivery would drop to **3** because every `main` push
would cancel Deploy before the gate runs.

---

# Second-attempt verification — 2026-10-17 (retry 2)

Reviewer: independent (did not author the change). Branch `improve/auto-20261017`;
workflows still uncommitted.

**VERDICT: PASS** — the previous concurrency collision is fixed and all acceptance
criteria are met.

## Fix confirmation

Previous FAIL: in the `workflow_call` context, `github.workflow` is caller-scoped
(`Deploy to GitHub Pages`), so CI's group `${{ github.workflow }}-${{ github.ref }}`
equalled Deploy's group. Retry 2 changes CI's group to
`${{ github.workflow }}-ci-${{ github.ref }}` (`ci.yml:9`). The called gate now resolves
to `Deploy to GitHub Pages-ci-refs/heads/main`, distinct from Deploy's
`Deploy to GitHub Pages-refs/heads/main` (`deploy.yml:9`), so the gate cannot cancel or
deadlock its caller. Standalone PR runs resolve to `CI-ci-refs/pull/N/merge`; superseded
runs still cancel per ref. `cancel-in-progress: true` is retained in both files. (Even if
GitHub were to ignore top-level concurrency in called workflows, Deploy's own group still
provides per-ref cancellation and no collision exists.)

## Acceptance criteria

1. **PASS** — both workflows declare a per-ref concurrency group with
   `cancel-in-progress: true` (`ci.yml:8-10`, `deploy.yml:8-10`).
2. **PASS** — `ci.yml` has no `push` trigger (`ci.yml:3-6`); a `main` push enters only
   `deploy.yml` (`deploy.yml:4-5`), whose `gate` job calls `ci.yml` exactly once
   (`deploy.yml:19`; grep count = 1).
3. **PASS** — `deploy` retains `needs: [build, gate]` (`deploy.yml:45`); `pull_request:`
   is unchanged (`ci.yml:4`). Permissions, jobs, steps, actions, and secrets are
   untouched.
4. **PASS** — Ruby YAML parse OK for both files; `npx prettier --check
   .github/workflows/ci.yml .github/workflows/deploy.yml` exits 0.

## Scope and evidence

`git diff` touches only `ci.yml` (drop `push: main`, add concurrency) and `deploy.yml`
(add concurrency). No other workflow files exist. Remaining `.improve/` edits are
IMP-039/IMP-061 session metadata. No source files changed, so the prior 425-test gate
result stands and was not re-run.

Caveat (unchanged, operational): dropping the `push` trigger means standalone CI no
longer posts a check on `main` commits; branch protection (IMP-005 follow-up) should
target the Deploy/workflow_call gate accordingly. The chosen option is recorded in the
impl report; the commit message remains pending because the change is uncommitted.

## Suggested health delta

**Delivery: 4 → 4 (hold).** The duplicate gate and the collision are gone; the change is
internal CI hygiene with no user-visible effect, so no dimension moves.
