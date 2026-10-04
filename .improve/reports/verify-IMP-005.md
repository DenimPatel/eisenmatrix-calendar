# verify-IMP-005 — CI quality gate (typecheck + lint + test) and `npm ci`

**Reviewer:** independent verification (did not author the change)
**Branch:** `improve/auto-20261003` · **Base:** `cf894fd` (IMP-004)
**Verdict:** **PASS** — all 4 acceptance criteria met; 4 non-blocking observations.
**Not committed.** No source files touched. Only this report was added.

---

## 1. Change surface

```
 M .github/workflows/deploy.yml     (3 hunks)
?? .github/workflows/ci.yml         (new, 40 lines)
 M .improve/PROGRESS.log            (+1 line, IMP-004 entry)
?? .improve/reports/discovered-IMP-005.md
?? .improve/reports/impl-IMP-005.md
?? .kilo/                           (harness config, not part of IMP-005)
```

`git diff -- .github/workflows/deploy.yml` is exactly three hunks:

| Hunk     | Change                                             | AC       |
| -------- | -------------------------------------------------- | -------- |
| `:14-15` | `+ gate:` / `+   uses: ./.github/workflows/ci.yml` | AC3      |
| `:30`    | `- run: npm install` → `+ run: npm ci`             | AC3, AC4 |
| `:41`    | `- needs: build` → `+ needs: [build, gate]`        | AC3      |

**Scope creep: none.** No `src/**`, `package.json`, `package-lock.json`, `vite.config.ts`, or
`tsconfig*` change. No source, build-config, or dependency drift.

**`PROGRESS.log` (+IMP-004 line) is orchestrator-owned, not author scope creep** — `STATE.md:20`
states "PROGRESS.log is appended immediately after each commit with the resulting SHA," and the
added line carries the real SHA `cf894fd` for IMP-004. Correct bookkeeping.

**`FEATURES.md` left at `- **Status:** TODO`** while IMP-001..004 are `DONE`. `impl-IMP-005.md:14`
declares this intentional ("the orchestrator owns item status"), which is a defensible process
choice, but it means the backlog is inconsistent until the orchestrator flips it. **Process note,
not an AC failure** — no AC mentions `FEATURES.md`.

**Debug leftovers / secrets: none.** `git diff | rg '^\+' | rg -i 'secret|token|key|password|console\.log|debugger|TODO|FIXME'`
→ exit 1 (no matches). The only `token` hit in the raw diff is the _pre-existing unchanged_
`id-token: write` context line at `deploy.yml:11`.

**Style / conventions:** no comments added (AGENTS.md: "Do not add comments unless they explain
non-obvious intent"). `ci.yml` mirrors `deploy.yml` exactly — 2-space indent, `- name:` steps,
unquoted `node-version: 20`, single-quoted `cache: 'npm'`, `branches: [main]` flow style.

---

## 2. YAML validity and semantic correctness

Both files parsed with `js-yaml` (repo's own `node_modules/js-yaml`). Full assertion suite:
**21 PASS / 0 FAIL** (`node /var/folders/ng/_4tf8hq1557b_4p06cbyrjhw0000gn/T/kilo/ac-check.js`).

Parsed `ci.yml`:

```
on keys: pull_request, push, workflow_dispatch, workflow_call
permissions: {"contents":"read"}
job gate | name: Typecheck, lint, test, build | runs-on: ubuntu-latest
  run order: npm ci -> npm run typecheck -> npm run lint -> npm run test -> npm run build
  uses: actions/checkout@v4
  uses: actions/setup-node@v4 {"node-version":20,"cache":"npm"}
  (no step carries `if:` or `continue-on-error`)
```

Parsed `deploy.yml`:

```
on keys: push, workflow_dispatch
permissions: {"contents":"read","pages":"write","id-token":"write"}
job gate   | uses: ./.github/workflows/ci.yml   (no runs-on, no steps, no secrets)
job build  | run order: npm ci -> npm run build
             uses: actions/upload-pages-artifact@v3 {"path":"./dist"}
job deploy | needs: ["build","gate"] | environment: github-pages
             uses: actions/deploy-pages@v4
```

### Acceptance criteria

**AC1 — triggers on `pull_request` and push to `main`: MET.**
`ci.yml:4-6` bare `pull_request:`, `push: {branches: [main]}`. Deploy keeps `push: [main]`.
Asserted programmatically, not just grepped.

**AC2 — ordered `npm ci` → `typecheck` → `lint` → `test` → `build`, all required, Node 20 + npm cache: MET.**
Steps at `ci.yml:28,31,34,37,40`. Exact-order assertion against the parsed `run` array passes.
No step has `continue-on-error` or `if:`, so a non-zero exit from any one fails the job.
`setup-node@v4` with `node-version: 20` (parses to int 20; setup-node coerces — matches existing
`deploy.yml`) and `cache: 'npm'`.

**AC3 — `deploy.yml` installs with `npm ci`; deploy cannot run when the gate fails: MET.**
`deploy.yml:30` is `npm ci`. `deploy.yml:41` is `needs: [build, gate]`. This is the exact
"gate job with `deploy needs: [build, gate]`" form AC3 names first, not the weaker
"equivalent required check" alternative.

**AC4 — no workflow uses `npm install`: MET.**
`rg -n "npm install" .github/workflows/` → exit 1 (no matches), across both files.

### Reusable-workflow (`workflow_call`) wiring — valid

This is the part I stress-tested hardest, because a malformed call silently breaks the gate.

- **Declaration valid:** `ci.yml:8` declares `workflow_call`; the caller references a **local**
  path `./.github/workflows/ci.yml` — same-repo reusable calls require no `@ref`.
- **Schema-valid caller job:** a job with `uses:` must **not** declare `runs-on` or `steps`.
  Asserted — `deploy.yml:14-15` has neither. (It may additionally declare `name`, `needs`,
  `if`, `permissions`, `secrets`, `with`; none are abused here.)
- **Nothing required of the caller:** `workflow_call:` is bare, so `inputs`/`secrets` are `null`
  and the caller has nothing to supply. Asserted.
- **Required checks surface correctly.** On `pull_request`, `ci.yml` runs **standalone** (the
  `workflow_call` event does not self-trigger), so the gate produces a top-level check run named
  from `name: Typecheck, lint, test, build` in the PR's check suite — exactly the string branch
  protection must require. The nested reporting on push-to-`main` (where `deploy.yml` calls it,
  yielding a compound `Deploy to GitHub Pages / gate / Typecheck, lint, test, build` name) occurs
  on the `push` event and is irrelevant to PR merge gating. **The design is sound for its purpose.**
- **Permissions handled sanely:** `ci.yml` declares `permissions: {contents: read}` only. A called
  workflow may only _narrow_ the caller's token, so this is valid and — importantly — it means the
  gate's jobs do **not** receive `deploy.yml`'s `pages: write` / `id-token: write`. Least privilege
  is preserved across the call boundary. Asserted.
- **`secrets: inherit` correctly NOT used:** the gate needs no secrets, and the caller job passes
  no `secrets:` block at all. Using `secrets: inherit` here would have over-shared the deploy
  context's token for zero benefit. Correct omission.

### Gate cannot be bypassed (for the `deploy.yml` path)

- `deploy` declares `needs: [build, gate]`; a job whose dependency failed, was cancelled, or was
  skipped is itself skipped. No `if: always()` or equivalent override exists on `deploy`.
- `workflow_dispatch` on `deploy.yml` does **not** bypass: the `gate` job is part of that run, so a
  manual dispatch still has to pass typecheck + lint + test + build.
- The gate runs the full suite itself; `build` and `gate` execute in parallel, so there is no
  ordering hole where `build` could produce an artifact against an un-gated tree.
- Residual (disclosed): the only ways to deploy ungated are editing/reverting the workflow file
  itself — an ordinary reviewable code change.

---

## 3. Deploy still deploys correctly

Everything outside the 3 hunks is byte-identical to the previously-working workflow:

| Item                                                                                          | State                                                                                        |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `actions/checkout@v4`                                                                         | unchanged                                                                                    |
| `actions/setup-node@v4` (`node-version: 20`, `cache: 'npm'`)                                  | unchanged                                                                                    |
| `actions/upload-pages-artifact@v3`                                                            | unchanged                                                                                    |
| artifact path                                                                                 | `'./dist'` — asserted unchanged                                                              |
| `actions/deploy-pages@v4` + `environment: github-pages` + `steps.deployment.outputs.page_url` | unchanged                                                                                    |
| base path                                                                                     | `vite.config.ts:7` `base: '/eisenmatrix-calendar/'` — untouched                              |
| PWA                                                                                           | `injectManifest`, `srcDir: src/pwa`, `filename: sw.ts` — untouched                           |
| build result                                                                                  | `✓ 53 modules transformed`, `precache 18 entries (602.62 KiB)`, `files generated dist/sw.js` |

`npm ci` is a strictly stronger install than the previous `npm install` (it requires
`package-lock.json` to be in sync with `package.json` instead of resolving fresh), so the deploy
path cannot get _worse_. `package-lock.json` is `lockfileVersion 3`, which npm 10 (bundled with
Node 20) reads natively — no Node 20 vs local Node 25 lockfile incompatibility.

---

## 4. Command gates — all green

`REPO_PROFILE.md:13-14` prescribes the order; baseline green.

| Gate                | Exit  | Evidence                                                   |
| ------------------- | ----- | ---------------------------------------------------------- |
| `npm run typecheck` | **0** | `tsc --noEmit`, no diagnostics                             |
| `npm run lint`      | **0** | `eslint .`, no output                                      |
| `npm run test`      | **0** | `Test Files 12 passed (12)`, `Tests 62 passed (62)`, 7.89s |
| `npm run build`     | **0** | `dist/sw.js` generated, 18 precache entries                |

Baseline in `REPO_PROFILE.md:27` was 10 files / 49 tests; the delta to 12 / 62 is the 13 tests
added by IMP-001..IMP-004, which are already committed at `cf894fd`. **No regression** — no
failures, no new skips.

Backlog verification method, all reproduced:

- `npm ci --dry-run` → `up to date in 692ms`, exit 0.
- `npx prettier --check .github/workflows/ci.yml .github/workflows/deploy.yml` →
  `All matched files use Prettier code style!`, exit 0.
- `rg -n "npm install" .github/workflows/` → exit 1.
- `rg -n "npm ci" .github/workflows/` → `ci.yml:28`, `deploy.yml:30`.

**Report accuracy:** every checkable claim in `impl-IMP-005.md` was independently reproduced —
40-line `ci.yml`, step lines `:28,31,34,37,40`, `node-version`/cache at `:24-25`,
`deploy.yml:30`/`:41`/`:14-15`, prettier clean, `npm ci --dry-run` 0, "12 files, 62 tests",
"18 precache entries". No overstatement found.

---

## 5. Observations (non-blocking — none are AC violations)

1. **The gate runs twice per push to `main`.** `ci.yml`'s own `push: [main]` trigger (AC1) plus
   `deploy.yml`'s `gate` call (AC3) both execute typecheck + lint + 62 tests + build. Both triggers
   are mandated by the spec, so this is unavoidable given the ACs. Cost: one extra runner-minute
   spend per merge. Correctly disclosed in `discovered-IMP-005.md:5-10`.
2. **`main` is not branch-protected — the gate is advisory for merges today.**
   `gh api repos/:owner/:repo/branches/main/protection` → `404 "Branch not protected"`. The
   **deploy** half of the stated intent ("lint/test failures can merge **and deploy**") is fixed by
   `needs: [build, gate]`. The **merge** half is not enforced until someone adds
   `Typecheck, lint, test, build` as a required status check in repo settings. That is a
   repo-settings change, not versioned content, and AC1 only asks for a `pull_request` trigger —
   so this is **not** an AC failure, but it is the single most important follow-up, because without
   it the backlog's motivating sentence is only half-true. Disclosed honestly at
   `discovered-IMP-005.md:24-26`.
3. **No `concurrency` group** in either workflow: rapid PR pushes each re-run the full gate with no
   cancellation. Out of scope, disclosed (`discovered-IMP-005.md:11-14`).
4. **Cosmetic redundancies:** `npm run build` is `tsc --noEmit && vite build`, so typecheck runs
   twice per gate invocation; and in `deploy.yml` `build` and `gate` both run `npm ci` +
   `npm run build`, which is unavoidable since job workspaces are isolated. Actions remain pinned to
   moving major tags (IMP-008 territory). `package.json` has no `engines`/`packageManager`, so local
   Node 25 vs CI Node 20 drift is unguarded. All disclosed, all out of scope.
