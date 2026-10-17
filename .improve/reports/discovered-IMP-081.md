# discovered-IMP-081

## 1. Dependabot comment now describes the old pinning scheme

`.github/dependabot.yml` still says the four actions "are pinned to moving major tags".
After IMP-081 they are pinned to commit SHAs, so that comment is stale. The ecosystem and
schedule are still correct for producing SHA-bump PRs (Dependabot understands
`uses: owner/repo@<sha> # vX.Y.Z`), so this is documentation only and was left untouched
because IMP-081 is scoped to the workflow `uses:` entries.

## 2. No local enforcement against tag pins

There is no lint/CI check that rejects a future `uses: ...@vN` or short SHA. A small
`grep`-based gate (or `zizmor`/`actionlint`) would keep IMP-081 AC4 from regressing, but
adding a tool or workflow step would change CI behavior, so it is recorded here instead.

## 3. Unpinned container/toolchain versions remain

`runs-on: ubuntu-latest` and `node-version: 20` are intentionally floating and outside the
GitHub Action SHA scope; note them if full CI reproducibility is ever pursued.
