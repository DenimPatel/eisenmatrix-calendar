# verify-IMP-022 — Dependabot + `npm audit` CI step

**Verdict: PASS.** Independent re-verification; nothing committed by this reviewer. Only this
report file was added.

Reviewed branch `improve/auto-20261003` (HEAD `bda9e65`), change under review = `.github/workflows/ci.yml`
(+3), new `.github/dependabot.yml`, plus one pre-existing `.improve/PROGRESS.log` line from IMP-021.

---

## 1. Acceptance criteria

### AC1 — `.github/dependabot.yml` enables weekly npm **and** GitHub Actions updates — MET

`.github/dependabot.yml` (16 lines), parsed with `js-yaml`:

| check | result |
|---|---|
| `version` | `2` |
| `updates` entries | `2` |
| ecosystems | `npm`, `github-actions` |
| `directory` | `/` for both |
| `schedule.interval` | `weekly` for both |
| `versioning-strategy` key | absent on both entries |

`directory: '/'` is correct: `package.json` and `package-lock.json` are both at the repo root
(`ls` confirms), and there is no workspace/monorepo layout, so root-relative is right for both the
npm (manifest-relative) and actions (repo-root-relative) semantics.

### AC2 — Non-blocking audit step, fails only on `critical` — MET

`.github/workflows/ci.yml:30-31`:

```yaml
      - name: Audit dependencies
        run: npm audit --audit-level=critical
```

**Level is exactly `critical`.** Not `high`, not `moderate`, not the default (`low`).

**Non-blocking today / blocking only on critical — verified empirically.** Live registry data
(12 advisories present, so the audit output is real, not an empty/no-network result):

```
audit-level=critical -> exit=0 | 12 vulnerabilities (2 low, 1 moderate, 9 high)
audit-level=high     -> exit=1 | 12 vulnerabilities (2 low, 1 moderate, 9 high)
audit-level=moderate -> exit=1 | 12 vulnerabilities (2 low, 1 moderate, 9 high)
audit-level=low      -> exit=1 | 12 vulnerabilities (2 low, 1 moderate, 9 high)
default (no flag)    -> exit=1
```

This is the intended policy exactly: the **current** advisory set is 9 high / 1 moderate / 2 low /
**0 critical**, so `--audit-level=critical` **exits 0 today** while `--audit-level=high` (and every
lower threshold, incl. the npm default) **exits 1**. The three-way comparison confirms the exit code is
driven by the severity threshold, not by advisory count.

Independently corroborated by `.improve/REPO_PROFILE.md` §7 baseline: *"12 advisories (9 high,
1 moderate, 2 low, 0 critical)"* — matches my measured run exactly.

**Advisories are still reported at `critical`.** npm prints the full report to stdout regardless of
threshold; the confirmed `--audit-level=critical` run still emitted every advisory (`fast-uri`,
`picomatch`, `rollup`, `serialize-javascript`, `vite`, …) plus the `12 vulnerabilities` summary. So the
step reports advisories without gating on them. No `--omit=dev`: correct, since the item's intent is
that dev/build advisories "still affect contributors and CI", and `--omit=dev` would hide exactly the
set that motivated the item.

**`continue-on-error` is absent — verified by key inspection, not by reading prose.** The step has no
`continue-on-error` and no `if:` guard, and a scan of **all** steps in the `gate` job found zero
`continue-on-error` keys anywhere. Therefore a critical advisory **will** fail the job; nothing would
swallow a critical failure. The "non-blocking" property comes from the threshold alone, which is the
correct mechanism — `continue-on-error` would have made the step never fail and violated AC2.

### AC3 — Committed config validates as YAML — MET

Both `.yml` files parse via `yaml.load` with no error, and structural assertions all pass:

- `dependabot.yml` → `version: 2`, exactly the two entries asserted in AC1.
- `ci.yml` → resolves to a single job `gate`; step names resolve to
  `['Audit dependencies', 'Typecheck', 'Lint', 'Test', 'Build', 'Build' …]` → actual order:
  `Checkout -> Set up Node -> Install dependencies -> Audit dependencies -> Typecheck -> Lint -> Test -> Build`.
- audit `run === 'npm audit --audit-level=critical'`.
- `deploy.yml` (untouched) still parses and has jobs.
- `npx prettier --check .github/dependabot.yml .github/workflows/ci.yml` → **exit 0**
  ("All matched files use Prettier code style!").

---

## 2. CI placement and gate ordering

Step order verified from the parsed document, not inferred:

```
Checkout -> Set up Node -> Install dependencies -> Audit dependencies -> Typecheck -> Lint -> Test -> Build
```

- **Right job:** `gate` — the only job in `ci.yml` (so it gates whatever consumes it, including `deploy`).
- **After `npm ci`:** correct; `npm audit` needs the lockfile and installed tree.
- **Before `typecheck`:** sensible — cheap check first, advisory text at the top of the log, and a
  genuine critical is found before the expensive gates.
- **Existing gate order intact:** `npm ci -> typecheck -> lint -> test -> build` is preserved in
  relative order; the audit is inserted between install and typecheck without reordering any gate.
  Matches the `REPO_PROFILE` §2 gate order.
- Indentation and the `- name:` / `run:` pair match the surrounding `ci.yml` style.

---

## 3. No dependency / lockfile changes — CONFIRMED

- `git diff --stat` → exactly `.github/workflows/ci.yml | 3 +++` and `.improve/PROGRESS.log | 1 +`.
- `git diff --name-only -- package.json package-lock.json` → **0 lines**; same for `--cached` and
  `git status --porcelain` → empty.
- Robust check: even `git add -A --dry-run` stages **no** `package.json` / `package-lock.json` /
  any lockfile (grep count `0`).

### Dependabot does not auto-merge major bumps — CONFIRMED

- Parsed keys across the whole `dependabot.yml` are only
  `version, updates, 0, package-ecosystem, directory, schedule, interval, 1` — **no**
  `auto-merge`, no `versioning-strategy`, no `allow`, no `ignore`.
- No `groups` entry declares `update-types` including `major`.
- Structurally, `dependabot.yml` has **no** auto-merge capability at all: auto-merge is a repo/PR-side
  setting opt-in from the GitHub UI, so nothing in this file can enable it. Major bumps are left
  un-proposed/un-merged, which also matches the item's note that the tailwind fix is a major bump
  (IMP-048).

---

## 4. Gates — exit 0

```
npm run typecheck   -> exit 0   (tsc --noEmit, no diagnostics)
npm run lint        -> exit 0   (eslint ., no output)
npm run test        -> exit 0   Test Files 29 passed (29) | Tests 258 passed (258)
npm run build       -> exit 0   (extra: CI also runs it) precache 18 entries, dist/sw.js generated
```

Baseline met: **258 tests**, 29 files. Combined gate run exited **0**. The
`--localstorage-file was provided without a valid path` warning during tests is the documented benign
pre-existing warning (`REPO_PROFILE` §7).

---

## 5. Scope creep / hygiene

| check | result |
|---|---|
| Files touched | `ci.yml` (+3), new `dependabot.yml`, 2 new reports, 1 pre-existing `PROGRESS.log` line |
| Scope | Exactly AC1/AC2 files. `.improve/FEATURES.md` correctly **not** edited (orchestrator owns status) |
| Unrelated source changes | None — no `src/**`, no config, no docs beyond the reports |
| Debug leftovers | None — no `console.log`, `debugger`, `TODO`, `FIXME`, `XXX` in either YAML |
| Secrets | None — no `ghp_`/`gho_`/`ghs_`/`github_pat_`/`AKIA…`/private-key blocks |
| Comments | Both `.github` files carry comments, but each explains non-obvious intent only (no auto-merge; tailwind is a major bump; actions pinned to moving tags) — permitted by `REPO_PROFILE` §5 |
| `PROGRESS.log` line | Correctly attributed by the impl report to IMP-021, not IMP-022 |

**Advisory (not a defect in this change):** `.kilo/` is untracked agent tooling, and `git add -A`
would sweep `.kilo/kilo.jsonc` into the commit. It brings in no dependency or lockfile file, and
`.kilo/worktrees/chatter-ringer` is a real git worktree (`.git` → `.git/worktrees/chatter-ringer`) so
git correctly refuses to stage its contents. Stage explicitly to keep the commit clean:

```
git add .github/dependabot.yml .github/workflows/ci.yml \
        .improve/reports/impl-IMP-022.md .improve/reports/discovered-IMP-022.md \
        .improve/PROGRESS.log
```

---

## 6. Note on `REPO_PROFILE.md` staleness (pre-existing, out of scope)

`REPO_PROFILE.md` §3 and §7 state a test baseline of **10 files / 49 tests**, but the actual measured
baseline is **29 files / 258 tests** (which is what this task and the impl report use). The profile is
stale relative to the current tree. Not introduced by IMP-022 and not a regression — but a future
verifier trusting §3's "49/49" would misread the baseline.

---

## 7. Residual risk / honest limits

- **Not executed on GitHub.** Workflow behavior was verified statically (YAML parse + step order +
  local exit codes); the impl report notes push is disabled in this run by `.git/hooks/pre-push`, and I
  did not attempt to push. The step's *runtime* behavior on a real runner is inferred from npm's
  documented `--audit-level` semantics, which the local exit-code table demonstrates directly.
- **Advisory counts drift with the registry.** Today's `exit 0` is a snapshot. A new *critical*
  advisory will correctly turn the gate red by design.
- **Registry-outage coupling:** `npm audit` is a network call with no offline fallback, so a registry
  incident can redden `gate` (and skip `deploy`). This is honestly disclosed in
  `.improve/reports/discovered-IMP-022.md` and is the correct trade-off here — `continue-on-error`
  would have broken AC2.
- **Enforcement is repo-side.** Dependabot auto-merge (off) and making `gate` required live in GitHub
  settings, not in committed files, so they cannot be verified from the working tree. Correctly
  disclosed in the discovered report.

---

## Commands run

```
git status && git log --oneline -10
git diff && git diff --stat && git diff --cached --stat
git diff --name-only -- package.json package-lock.json      # 0 lines
git add -A --dry-run | grep -cE "package(-lock)?\.json|lock"  # 0
npm audit --audit-level={critical,high,moderate,low}; npm audit
node <structural js-yaml validation over dependabot.yml, ci.yml, deploy.yml>   # ALL CHECKS PASSED, exit 0
npx prettier --check .github/dependabot.yml .github/workflows/ci.yml            # exit 0
npm run typecheck && npm run lint && npm run test                              # exit 0, 258 tests
npm run build                                                                 # exit 0
```

## Verdict

**PASS.** All three acceptance criteria met with independent, reproducible evidence. The audit policy
is genuinely non-blocking today (`exit 0`) while genuinely failing on critical (`--audit-level=high`
exits 1), `continue-on-error` is absent so a critical cannot be swallowed, both YAML files parse and are
structurally correct with both Dependabot ecosystems at `weekly`/`/`, the existing gate ordering is
intact, there are zero dependency/lockfile changes, no auto-merge of majors, and all four gates exit 0
at the 258-test baseline. No blockers. Only the advisory notes in §5 (stage explicitly, avoid
`.kilo/kilo.jsonc`) and the pre-existing profile staleness in §6.