# impl-IMP-022 — Dependabot + a non-blocking `npm audit` CI step

## Files
- `.github/dependabot.yml` (new, 16 lines): `version: 2`; two `updates` entries —
  `package-ecosystem: 'npm'` and `package-ecosystem: 'github-actions'`, both
  `directory: '/'` with `schedule.interval: 'weekly'`. No `open-pull-requests-limit`,
  no grouping, no auto-merge configuration (Dependabot auto-merge is opt-in per repo/PR in
  the GitHub UI, never requested here).
- `.github/workflows/ci.yml` (3 lines added, `:30-31`): a `Audit dependencies` step
  (`run: npm audit --audit-level=critical`) between `Install dependencies` and `Typecheck`.
  It carries no `continue-on-error` and no `if:`, so a non-zero exit fails the `gate` job
  (and therefore `deploy`) — which is exactly the "fail only on critical" policy.
- No `package.json` / `package-lock.json` change (`git diff --name-only -- package.json
  package-lock.json` → 0 lines). `.improve/FEATURES.md` **not** modified — the
  orchestrator owns item status.
- Reports: this file and `.improve/reports/discovered-IMP-022.md`.

## Approach
**Dependabot.** The minimal two-entry config: one entry per ecosystem the acceptance
criteria name, both `weekly`, both rooted at `/` (the manifest and `package-lock.json` live
at the repo root; there is no workspace or monorepo layout). `directory: '/'` is
`package.json`-relative for npm and repo-root-relative for actions, so both entries point
at the same place. Comments explain only non-obvious intent: no auto-merge (the tailwind fix
is a **major** bump per IMP-048) and the reason the `github-actions` entry matters (the
four actions in `ci.yml`/`deploy.yml` are pinned to moving major tags). Prettier's YAML
printer added the leading comment at `:1`; its output is byte-identical to hand formatting.

**Audit step.** `npm audit --audit-level=critical` is the whole policy in one flag:
npm always prints the full advisory report to stdout, and the exit code is non-zero only
when an advisory at or above the given severity exists. There is no separate "report" mode,
so the flag is the mechanism rather than a wrapper — no `|| true`, no `continue-on-error`
(which would make the step *never* fail and would violate AC2's "fails only on critical").
The step runs after `npm ci` and before `typecheck` so the advisory text sits at the top of
the log and a genuinely critical advisory is found before the expensive gates. Dev/build
advisories are intentionally included (no `--omit=dev`): the item's intent is that they
"still affect contributors and CI", and the runtime bundle is unaffected, so gating on
`--omit=dev` would hide exactly the 12 advisories that motivated the item.

Style matches `ci.yml` (IMP-005): same 6-space step indentation, same
`- name:` / `run:` pair, no quoting games beyond the single-quoted scalars Prettier emits
for YAML strings.

## Acceptance criteria
1. **`.github/dependabot.yml` enables weekly npm updates and GitHub Actions updates** — yes;
   `dependabot.yml:6-9` (`npm`, `/`, `weekly`) and `:13-16` (`github-actions`, `/`,
   `weekly`), `version: 2` at `:2`.
2. **A non-blocking audit step reports advisories in CI (fails only on `critical`)** — yes;
   `ci.yml:30-31`. Report is unconditional (stdout), the exit code is threshold-driven.
   The step *is* blocking on critical by design; "non-blocking" is satisfied for the current
   12 advisories (9 high, 1 moderate, 2 low, 0 critical) — verified below.
3. **The committed config validates as YAML** — yes; both `.yml` files plus `deploy.yml`
   parse with `js-yaml` (`yaml.load`), and structural assertions pass.

## Verification
- `npx prettier --check .github/dependabot.yml .github/workflows/ci.yml` — exit 0
  ("All matched files use Prettier code style!").
- `js-yaml` parse of `dependabot.yml`, `ci.yml`, `deploy.yml` — all OK;
  `dependabot.version === 2`, `updates === [['npm','/','weekly'],
  ['github-actions','/','weekly']]`, `ci.yml` step order
  `Checkout, Set up Node, Install dependencies, Audit dependencies, Typecheck, Lint, Test,
  Build`, audit `run === 'npm audit --audit-level=critical'`, no `continue-on-error` key.
- Local audit policy check (AC2's own verification method), with the current advisories:
  `npm audit --audit-level=critical` → **exit 0** (12 vulnerabilities: 2 low, 1 moderate,
  9 high — the CI step stays green today); `npm audit --audit-level=high` → exit 1;
  `npm audit` (default `low`) → exit 1. The three-way comparison confirms the exit code is
  driven by the `--audit-level` threshold and not by advisory count, i.e. the step fails on
  critical and only on critical.
- `npm run typecheck` — exit 0
- `npm run lint` — exit 0
- `npm run test` — exit 0 (29 files, 258 tests)
- `git diff --stat` — `.github/workflows/ci.yml | 3 +++` plus one pre-existing
  `.improve/PROGRESS.log` line from IMP-021; `git status` shows `.github/dependabot.yml`
  untracked/new. Nothing else.

## Notes / uncertainties
- Could not execute the workflows on GitHub (push is disabled in this run by
  `.git/hooks/pre-push`); verification is static YAML parse + local audit exit codes.
- Dependabot behavior is repo-side and not testable locally: the two entries have not been
  observed producing a PR. The config is the canonical documented shape for
  `version: 2` + these two ecosystems.
- Advisory count drifts with the registry, so the step's exit code will change over time by
  design; today's exit 0 is a snapshot, not a guarantee. Follow-ups are in
  `.improve/reports/discovered-IMP-022.md`.
- Not committed (per run instructions); FEATURES.md status left as `TODO`.