# verify-IMP-029 — pin the Node version (engines + .nvmrc)

**Reviewer:** independent verifier (did not write the change)
**Date:** 2026-10-17
**Item:** `.improve/FEATURES.md` → `### IMP-029` (`:780-794`)
**Impl report:** `.improve/reports/impl-IMP-029.md`
**Conventions:** `.improve/REPO_PROFILE.md`, `AGENTS.md`
**Branch:** `improve/auto-20261017` (change uncommitted; HEAD `2e455ce`)

## VERDICT: PASS

All three acceptance criteria are met. The change is a minimal, correct pin:
`engines.node: ">=20"`, `.nvmrc` = `20`, and the CI/deploy workflows already use
Node 20. JSON validity, README consistency, lockfile cleanliness, and all four gates
were confirmed. Remaining findings are non-blocking bookkeeping items.

---

## 1. Scope of the diff

`git diff` (tracked) plus untracked files:

```
 .improve/CHANGELOG.md | 1 +
 .improve/FEATURES.md  | 4 ++--   (two hunks)
 .improve/PROGRESS.log | 1 +
 package.json          | 3 +++
?? .nvmrc
?? .improve/reports/impl-IMP-029.md
```

| File | Verdict |
|---|---|
| `package.json` | In scope: only adds an `engines` block after `type` (`:6-8`). No scripts, dependencies, or metadata otherwise changed. |
| `.nvmrc` | In scope: new, one line, exact bytes `32 30 0a` (`20\n`). |
| `.improve/FEATURES.md` hunk 1 | Bookkeeping: IMP-029 `TODO → IN-PROGRESS`. Appropriate in-progress state. |
| `.improve/FEATURES.md` hunk 2, `CHANGELOG.md`, `PROGRESS.log` | **Pre-existing leftovers from IMP-031** (commit `2e455ce`), not attributable to IMP-029. The IMP-031 notes/CHANGELOG/PROGRESS lines were already present before this item's work and remain uncommitted. Harmless here; they should be committed with IMP-031 bookkeeping rather than an IMP-029 commit. |
| `.improve/reports/impl-IMP-029.md` | New untracked implementation report. |

No source, test, workflow, README, or lockfile change. `git diff --check` clean;
`npx prettier --check package.json` passes. No `console.*`, `debugger`, `TODO`,
`FIXME`, or new comments in the changed files.

Observation (non-blocking): `.nvmrc` is untracked and `package.json` is uncommitted,
consistent with the review-stage state of prior items. A future commit must include
`.nvmrc`; committing only tracked-file diffs would silently drop AC2.

---

## 2. Acceptance criteria

### AC1 — `package.json` declares `engines.node` consistent with README — **MET**

`package.json:6-8`:

```json
"engines": {
  "node": ">=20"
},
```

`README.md:56` states `Node.js 20+ (latest LTS recommended)`. `>=20` matches.
The required probe passes: `engines.node=>=20`.

### AC2 — `.nvmrc` (or `.node-version`) pins the same major used in CI (20) — **MET**

`.nvmrc` contains `20` (newline-terminated). Both workflows use Node 20:

- `.github/workflows/ci.yml:24` — `node-version: 20`
- `.github/workflows/deploy.yml:26` — `node-version: 20`

No conflicting `.node-version` / `.tool-versions` exists. `nvm use` with `20`
resolves a 20.x release, the same major `actions/setup-node` resolves.

### AC3 — `npm run build` still passes — **MET**

`npm run build` exits 0: `tsc --noEmit` passes, Vite builds the SPA, the
`injectManifest` worker builds, and `dist/sw.js` is generated with 18 precache
entries. `dist/` remains gitignored (not in `git status`).

---

## 3. Workflow and README inspection

- **`ci.yml`**: gate runs `npm ci` → typecheck → lint → test → build on
  `ubuntu-latest` with `actions/setup-node@v4`, `node-version: 20`, npm cache.
  The new `engines: >=20` is satisfied by Node 20, so `npm ci` at the CI Node
  version remains valid (npm does not enforce `engines` by default, but the
  declared floor is consistent with the runner).
- **`deploy.yml`**: `gate` reuses `ci.yml`; `build` also uses Node 20 and `npm ci`,
  then uploads `dist`; `deploy` needs `[build, gate]`. No inconsistency introduced.
- **`README.md`**: only Node prerequisite is line 56 (`Node.js 20+`), matching
  `engines`. No stale Node version claim elsewhere. (Node 20 is nearing/at EOL
  in late 2026, but the item explicitly requires alignment with CI's Node 20;
  upgrading the CI major would be a separate item.)
- **Lockfile**: `package-lock.json` is unmodified (`git diff` empty, not in
  `git status`). `npm install --package-lock-only --dry-run` reports
  `up to date`, so the lockfile remains in sync with the new `engines` field
  and `npm ci` will not be invalidated by this change.
- **JSON validity**: both `JSON.parse` and `node -e "require('./package.json')"`
  succeed.

---

## 4. Verification commands

Run from the repo root on the working tree (local Node v24.21.0, npm 11.19.0):

```
node -e "const p=require('./package.json'); if(!p.engines||!p.engines.node) process.exit(1)"
  -> PASS, engines.node=>=20
cat .nvmrc                              -> 20
npm run typecheck                       -> PASS (tsc --noEmit, no diagnostics)
npm run lint                            -> PASS (eslint ., no output)
npm run test                            -> PASS, 34 files / 386 tests
npm run build                           -> PASS (dist/sw.js generated, 18 precache entries)
npm install --package-lock-only --dry-run -> "up to date", no lockfile change
```

386 = 385 baseline after IMP-025/027 + 1 added by IMP-031 (`2e455ce`). IMP-029 adds
no tests, which is appropriate for a configuration-only change and matches the
implementation report's stated baseline.

---

## 5. Findings / residual caveats

1. **Bookkeeping incomplete (non-blocking).** `FEATURES.md` still shows IMP-029 as
   `IN-PROGRESS` with empty `Notes`; there is no IMP-029 line in `CHANGELOG.md` or
   `PROGRESS.log`. These are coordinator/acceptance-state updates, not acceptance
   criteria. On acceptance, set `Status: DONE` and fill the notes with the commit
   SHA and verification summary.
2. **Unrelated IMP-031 bookkeeping in the working tree (non-blocking).** The
   CHANGELOG/PROGRESS lines and the second `FEATURES.md` hunk describe IMP-031.
   They should not be attributed to IMP-029; ideally they are committed with the
   IMP-031 bookkeeping.
3. **`.nvmrc` must be added when committing.** It is untracked; the implementation
   report correctly counts it as a changed file, but a commit built only from
   `git diff` would omit it and fail AC2 in the repository.
4. No scope creep in source/configuration: no dependency, script, workflow, README,
   or lockfile edits. No debug leftovers.

No follow-up backlog item is required. Optional cleanup: separate the leftover
IMP-031 bookkeeping and mark IMP-029 `DONE` once accepted.

---

## 6. Health deltas (suggested)

| Dimension | Delta | Why |
|---|---|---|
| Tooling/Reproducibility | **+1** | Declares the Node floor and pins a contributor version that matches CI (20), closing a silent drift source; lockfile verified in sync. |
| Bugs/Correctness | 0 | No runtime behavior change. |
| Tests | 0 | Configuration-only; no test warranted. |
| Maintainability | 0 | Three-line, conventional manifest addition plus a one-line pin. |
| Risk | low | `engines` is advisory unless consumers set `engine-strict`; `.nvmrc` is opt-in for nvm users. No build or lockfile impact. |
