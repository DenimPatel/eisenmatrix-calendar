# impl-IMP-005 — CI quality gate (typecheck + lint + test) and `npm ci`

## Files
- `.github/workflows/ci.yml` (new, 40 lines): `name: CI`; triggers `pull_request`,
  `push: [main]`, `workflow_dispatch`, `workflow_call`; `permissions: contents: read`. Single
  `gate` job (`name: Typecheck, lint, test, build`) on `ubuntu-latest`:
  `actions/checkout@v4` → `actions/setup-node@v4` (`node-version: 20`, `cache: 'npm'`) →
  `npm ci` → `npm run typecheck` → `npm run lint` → `npm run test` → `npm run build`. No
  `continue-on-error` / `if: always()`, so any step failing fails the job.
- `.github/workflows/deploy.yml` (3 edits): added a `gate` job that calls the shared workflow
  (`gate: { uses: ./.github/workflows/ci.yml }`, `:14-15`); `build`'s install step is now
  `npm ci` instead of `npm install` (`:30`); `deploy` is now `needs: [build, gate]`
  (`:41`).
- `.improve/FEATURES.md`: **not** modified — the orchestrator owns item status.
- No `package.json` / `package-lock.json` changes (`git status` shows only the two workflow
  files).

## Approach
The gate lives in one place. Rather than copy the four commands into `deploy.yml`, `ci.yml`
also declares `workflow_call` and `deploy.yml` gets a one-line `gate` job that calls
`./.github/workflows/ci.yml`; a job that `uses:` a workflow has no steps of its own, so
there is nothing to duplicate and the command order exists in exactly one file that cannot
drift. This is the "equivalent required check" branch of AC3, and `deploy needs: [build,
gate]` means `deploy` is skipped whenever the gate job is skipped or fails. Because jobs have
isolated workspaces the gate's `dist/` is not visible to `build`, so `build` keeps its own
`npm ci` + `npm run build` + artifact upload (noted in `discovered-IMP-005.md`). Style
matches the existing file: same runner, same action versions, same step names, single-quoted
`'npm'` cache value, `node-version: 20`.

## Acceptance criteria
1. **Triggers on `pull_request` and push to `main`** — yes; `ci.yml:4-6`
   (`pull_request:` bare, `push: branches: [main]`), plus `workflow_dispatch` to match
   `deploy.yml`'s manual entry point.
2. **Ordered `npm ci` → `typecheck` → `lint` → `test` → `build`, all required, Node 20 +
   npm cache** — yes; steps at `ci.yml:28,31,34,37,40` in that order, no
   `continue-on-error`/`if` on any of them, `node-version: 20` and `cache: 'npm'` at
   `ci.yml:24-25`.
3. **`deploy.yml` installs with `npm ci`; deploy cannot run when the gate fails** — yes;
   `deploy.yml:30` is `npm ci`, and `deploy.yml:41` is `needs: [build, gate]`, so a failed
   `gate` (re-running the same `ci.yml` gate) skips the deploy job.
4. **No workflow uses `npm install`** — yes; `rg -n "npm install" .github/workflows/` exits 1
   (no matches) across both files.

## Verification
- `npx prettier --check .github/workflows/ci.yml .github/workflows/deploy.yml` — exit 0
  (both files clean; `ci.yml` needed the missing trailing newline).
- `npm ci --dry-run` — exit 0 ("up to date in 815ms"), so the committed lockfile satisfies a
  strict clean install.
- Both workflows parsed with `js-yaml`: `ci.yml` `on` = `pull_request,push,workflow_dispatch,
  workflow_call`, one `gate` job with the five `npm` steps in order; `deploy.yml` jobs =
  `gate,build,deploy`, `gate.uses = ./.github/workflows/ci.yml`, `deploy.needs = [build,
  gate]`.
- Grep assertions: `rg -n "^\s*pull_request:" .github/workflows/ci.yml` → `:4`; the five
  `run: npm …` lines → `:28,31,34,37,40`; `node-version: 20` + `cache: 'npm'` → `:24-25`;
  `rg -n "npm install" .github/workflows/` → exit 1; `needs: [build, gate]` → `deploy.yml:41`.
- `npm run typecheck` — exit 0
- `npm run lint` — exit 0
- `npm run test` — exit 0 (12 files, 62 tests)
- `npm run build` — exit 0 (injectManifest → `dist/sw.js`, 18 precache entries)

## Notes / uncertainties
- **The gate runs twice per push to `main`** (standalone `ci.yml` + the `deploy.yml` `gate`
  call). AC1 requires the push trigger and AC3 requires the deploy dependency, so both exist;
  the trade-off and the cheaper alternative are recorded in
  `.improve/reports/discovered-IMP-005.md`, along with the missing `concurrency` group, the
  Node 25-local vs Node 20-CI gap (`package.json` has no `engines`), SHA pinning of actions,
  and the fact that merging is only blocked if branch protection lists the gate as required
  (a repo-settings change, not versioned here).
- Could not execute the workflow on GitHub (push is disabled in this run by
  `.git/hooks/pre-push`); verification is static YAML parse + the local gates.
- Not committed (per run instructions).