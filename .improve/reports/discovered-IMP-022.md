# discovered-IMP-022 — out-of-scope findings

Findings noticed while implementing IMP-022; not fixed here to stay within the acceptance
criteria (and because `package.json` / `package-lock.json` edits were excluded from this
item).

- **Actions are still pinned to moving major tags, so Dependabot bumps them but cannot fix
  a compromised tag.** `actions/checkout@v4`, `actions/setup-node@v4`,
  `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`. The new
  `github-actions` Dependabot entry will open PRs for these, but a mutable major tag means
  the tag can be repointed to new code without review. Full-SHA pinning (with Dependabot
  updating the SHA + the `# vX.Y.Z` comment) closes that; it is a separate change to
  `ci.yml` and `deploy.yml`. `discovered-IMP-005.md` already flagged this and noted it
  "rides with IMP-022/IMP-048" — it remains unpinned because IMP-022's criteria scope the
  `ci.yml` edit to the audit step only.
- **Dependabot will not propose the fix for the tailwind advisory.** `npm audit` reports
  `braces` reachable through `chokidar` → `tailwindcss@<=3.4.19`, whose fix is
  `npm audit fix --force` (a **major** bump to `tailwindcss@4`). Dependabot's default
  grouping does not propose a major bump, so that high advisory will stay open in CI's
  report indefinitely and be fixed by hand (IMP-048). A `groups` entry with
  `update-types: ['minor', 'patch']` per dependency would make the policy explicit instead
  of implicit in Dependabot's defaults; left out as beyond the two-entry minimum.
- **No `open-pull-requests-limit` and no `ignore` list.** With two ecosystems and default
  grouping Dependabot can open up to 5 open PRs per ecosystem, which is noisy for a repo
  this size. A lower limit, or `ignore` for the dev-toolchain majors, is a judgment call
  about review capacity, not an acceptance criterion.
- **The audit step depends on the npm registry and will fail the gate if the registry is
  unreachable.** `npm audit` is a network call with no offline fallback, so a registry
  incident turns a non-blocking advisory report into a red `gate` (and a skipped
  `deploy`). `continue-on-error` plus a separate required signal would fix that, but it
  would also make the step never fail and so break AC2. Left as is: today the risk is that
  a transient registry failure blocks the Pages deploy, which is a known trade-off of
  putting the check inside the gate rather than a parallel job.
- **The advisory set is 100% dev/build, but the step audits everything.** No
  `--omit=dev` was added, which is intentional (the item's intent is contributor/CI
  exposure), with the consequence that a critical advisory in a *transitive dev* package
  would block deploys even though the shipped bundle is unaffected. If that becomes noisy,
  the fix is `--omit=dev` plus a separate scheduled (not gate-blocking) full audit.
- **`npm audit` output is not captured as an artifact.** The report is only visible in the
  step log; there is no SARIF upload (`npm audit --json | …`) for code-scanning triage.
  That is a larger CI addition than AC2 asks for.
- **Dependabot needs `pull-requests: write` permission to work, which no workflow or config
  in this repo grants.** Dependabot uses the repo's default token configured in GitHub
  settings for that, so nothing versioned needs changing — but the same is true of branch
  protection making the `gate` job required (`discovered-IMP-005.md` §5): the enforcement
  half of this item lives in repo settings, not in committed files, and cannot be verified
  from the working tree.