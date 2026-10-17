# IMP-081 — Implementation report

**Status:** implemented (workflow-only change; not marked DONE in FEATURES.md)

## Change

Pinned every third-party `uses:` in `.github/workflows/ci.yml` and
`.github/workflows/deploy.yml` to a full 40-character commit SHA, keeping the
human-readable release in a trailing comment. Action versions and workflow behavior are
unchanged; the local reusable-workflow reference `./.github/workflows/ci.yml` is not a
third-party action and was left alone.

| Action | Major tag | Resolved release | Pinned SHA |
| --- | --- | --- | --- |
| `actions/checkout` | `v4` | `v4.4.0` | `11d5960a326750d5838078e36cf38b85af677262` |
| `actions/setup-node` | `v4` | `v4.4.0` | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `actions/upload-pages-artifact` | `v3` | `v3.0.1` | `56afc609e74202658d3ffba0e8f6dda462b719fa` |
| `actions/deploy-pages` | `v4` | `v4.0.5` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` |

## How each SHA was obtained

1. `git ls-remote https://github.com/<owner>/<repo> refs/tags/v<major>` returned the commit
   for the moving major tag. None of the four majors is an annotated tag (no `^{}` peeled
   line was returned), so the reported SHA is already the commit.
2. `git ls-remote --tags https://github.com/<owner>/<repo>` matched that SHA to the exact
   patch tag used in the comment (`v4.4.0`, `v4.4.0`, `v3.0.1`, `v4.0.5`).
3. As an independent cross-check, the GitHub API
   (`GET https://api.github.com/repos/<owner>/<repo>/git/ref/tags/v<major>`) returned the
   same `object.sha` with `object.type: "commit"` for all four repositories.

Example commands for checkout:

```bash
git ls-remote https://github.com/actions/checkout refs/tags/v4
git ls-remote --tags https://github.com/actions/checkout | grep 11d5960a326750d5838078e36cf38b85af677262
```

## Acceptance criteria

1. **SHA pins with version comments** — all five third-party `uses:` lines (checkout and
   setup-node in each workflow, plus upload-pages-artifact and deploy-pages) carry a
   40-hex-character SHA and a trailing `# vX.Y.Z` comment.
2. **Dependabot unchanged** — `.github/dependabot.yml` still declares the
   `github-actions` ecosystem for `directory: '/'` with a weekly schedule and no ignore
   rules, so SHA updates remain enabled.
3. **Deploy gate intact** — `deploy.yml` still has `gate: uses: ./.github/workflows/ci.yml`
   and `deploy` still `needs: [build, gate]`; the check name
   `Typecheck, lint, test, build` in `ci.yml` is unchanged.
4. **No moving tags** — `grep -n "uses:" .github/workflows/*.yml` shows only local and
   SHA-pinned references.

## Verification

- `grep -n "uses:" .github/workflows/*.yml` — five SHA pins plus the local reusable
  workflow reference.
- SHA length check — every external ref is exactly 40 hex characters.
- `npx prettier --check .github/workflows/*.yml` — "All matched files use Prettier code
  style!" (exit 0).
- `npm run typecheck`, `npm run lint`, `npm run test` were **not** run: this change touches
  only workflow YAML, no source.

No new dependencies, no action version or behavior change, no source changes. A real
PR-triggered CI run and Pages deploy could not be executed locally.
