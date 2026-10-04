# discovered-IMP-005 — out-of-scope findings

Findings noticed while implementing IMP-005; not fixed here to stay in scope.

- **The full gate now runs twice on a push to `main`.** `ci.yml` triggers on
  `push: [main]` (AC1) *and* `deploy.yml` calls it via the `gate` job
  (`uses: ./.github/workflows/ci.yml`, `deploy.yml:14-15`). Both are required by the spec, so
  the suite (typecheck + lint + 62 tests + build) executes twice per main push. Dropping
  `push` from `ci.yml` and keeping only `pull_request` + the `deploy.yml` gate call would
  halve it, but AC1 explicitly requires the push trigger, so both were kept.
- **Neither workflow has a `concurrency` group.** Every new push to a PR re-runs the whole
  gate with no cancellation, and concurrent runs never queue. A
  `concurrency: {group: ci-${{ github.ref }}, cancel-in-progress: true }` would fix it; left
  out to keep the diff to the acceptance criteria.
- **Actions are pinned to moving major tags** (`actions/checkout@v4`,
  `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`),
  matching the existing `deploy.yml`. Full-SHA pinning plus `dependabot` for
  `package-ecosystem: github-actions` (which IMP-008 already covers) is the follow-up.
- **Local Node is v25.6.1 while CI pins Node 20.** `package.json` declares no `engines` /
  `packageManager`, so a contributor on Node 22/23/25 can produce a lockfile or build that
  CI (Node 20) rejects — `npm ci` is strict about `package-lock.json` and would fail the gate
  rather than the local run. An `engines.node: ">=20"` field plus a Volta/`packageManager`
  pin would surface this locally; out of scope here (and `package.json` edits were excluded).
- **Nothing in the repo makes the gate a *required* status check.** `deploy needs: [build,
  gate]` prevents deploying from a failed gate (AC3), but blocking merges depends on branch
  protection rules in repo settings, which are not versioned and were not touched.
- **The gate's `dist/` is not shared with the `build` job.** GitHub jobs get isolated
  workspaces, so `deploy.yml` must still re-run `npm ci` + `npm run build` and re-upload its
  own artifact; that duplication is unavoidable without uploading the gate's artifact as a
  workflow artifact and downloading it (which would also make the `pages`-scoped
  `permissions` cross workflows). Left as is.