# IMP-081 — Verification report

**Verdict: PASS**

Reviewed the working tree on `improve/auto-20261017` (HEAD `628f42c`) plus the
uncommitted IMP-081 change. No files were modified by this review except this report;
nothing was committed.

## Action → SHA checks (independently resolved)

All four refs are lightweight tags (no peeled `^{}` ref); the pinned SHA is the tag's
commit object.

| Action | Major tag now | Version comment | Pinned SHA | Independent check |
| --- | --- | --- | --- | --- |
| `actions/checkout` | `v4` → `11d5960a…` | `v4.4.0` | `11d5960a326750d5838078e36cf38b85af677262` | `refs/tags/v4.4.0` = same; API `object.type: commit` |
| `actions/setup-node` | `v4` → `49933ea5…` | `v4.4.0` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | `refs/tags/v4.4.0` = same; API `object.type: commit` |
| `actions/upload-pages-artifact` | `v3` → `56afc609…` | `v3.0.1` | `56afc609e74202658d3ffba0e8f6dda462b719fa` | `refs/tags/v3.0.1` = same; API `object.type: commit` |
| `actions/deploy-pages` | `v4` → `d6db9016…` | `v4.0.5` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | `refs/tags/v4.0.5` = same; API `object.type: commit` |

The major tags currently point at these exact commits, so pinning changes no action
behavior today. Commands used: `git ls-remote <repo> refs/tags/vX`, explicit
`refs/tags/vX.Y.Z` / `refs/tags/vX.Y.Z^{}`, and
`GET https://api.github.com/repos/<repo>/git/ref/tags/vX.Y.Z`.

## Acceptance criteria

| # | Result | Evidence |
| --- | --- | --- |
| 1. 40-hex SHA + trailing `# vX.Y.Z` on every third-party `uses:` | **PASS** | Six third-party uses (checkout ×2, setup-node ×2, upload-pages-artifact, deploy-pages) all match `@<40 hex> # vX.Y.Z`; `grep -rhoE '[0-9a-f]{40}'` yields only four distinct 40-char SHAs. Four distinct actions used. |
| 2. Local reusable workflow stays local | **PASS** | `deploy.yml:19` is still `uses: ./.github/workflows/ci.yml`; untouched by the diff. |
| 3. Dependabot still covers actions with SHA updates enabled | **PASS** | `.github/dependabot.yml` still declares `package-ecosystem: 'github-actions'`, `directory: '/'`, weekly, with no `ignore`/disable rules. The version comments let Dependabot update the SHA pins. |
| 4. Deploy still needs the gate; gate name unchanged | **PASS** | `deploy.yml` keeps `gate: uses: ./.github/workflows/ci.yml` and `deploy: needs: [build, gate]`; `ci.yml` job name remains `Typecheck, lint, test, build`. |
| 5. No permissions/secrets change | **PASS** | Diff touches only `uses:` lines: `permissions:` blocks (`contents: read`; Pages `pages: write`, `id-token: write`) and all `with:` inputs are identical to HEAD. No `secrets` anywhere. |
| 6. No moving third-party tags | **PASS** | `grep -n "uses:" .github/workflows/*.yml` shows only the six SHA pins and the local workflow; `grep -rn "@v[0-9]" .github` is empty. |
| 7. Workflow formatting | **PASS** | `npx prettier --check .github/workflows/*.yml` → all matched files pass, exit 0. `git diff --check` clean. |

## Gates

- `npx prettier --check .github/workflows/*.yml` — clean.
- `npm run lint` — clean.
- `npm run format:check` — **FAILS at HEAD, unrelated to IMP-081**:
  `src/features/today/TodayView.test.tsx` (unmodified working-tree file, introduced by
  HEAD `628f42c`) does not satisfy Prettier. Because `ci.yml` runs this command, the PR
  gate will be red until that pre-existing drift is fixed. This is not caused by the
  workflow pinning and does not violate IMP-081's criteria.
- `npm run typecheck` / `npm run test` were not rerun: the diff touches no source, and
  `npm run lint` plus the workflow-focused checks cover this change.

## Scope, style, minor issues (non-blocking)

- Workflow diff is limited to `ci.yml` (2 lines) and `deploy.yml` (4 lines); no source,
  dependency, permission, secret or behavior change. `FEATURES.md` correctly records
  IMP-081 as `IN-PROGRESS`; the uncommitted `CHANGELOG.md`/`PROGRESS.log` additions are
  IMP-078 bookkeeping that pre-dates this change.
- The implementation report says "all five third-party `uses:` lines"; there are six
  (checkout and setup-node appear in both workflows). The counts elsewhere are correct.
- `.github/dependabot.yml`'s comment still says the actions "are pinned to moving major
  tags", which is now stale. Cosmetic only; Dependabot behavior and AC3 are unaffected.

## Suggested Delivery health delta

**+1** — supply-chain exposure is removed for every third-party action with no behavior
change and no config/permission drift. Caveat: the branch CI gate remains red from the
pre-existing `TodayView.test.tsx` Prettier failure, which should be fixed separately
before relying on a green PR run.
