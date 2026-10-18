# Verification — IMP-043 (re-enable `no-explicit-any`)

**Reviewer:** independent reviewer (did not write the change)
**Date:** 2026-10-18
**Item:** `.improve/FEATURES.md` → `### IMP-043` — "Re-enable the `no-explicit-any` lint rule"
**Implementation report:** `.improve/reports/impl-IMP-043.md`
**Conventions:** `AGENTS.md`

# VERDICT: PASS

The change is a one-token config flip plus one focused regression test. Every acceptance
criterion is met, all five gates pass, the test genuinely pins the rule (it is not vacuous), and
there is no scope creep or leftover. Details below.

---

## 1. Diff scope review

`git status` / `git diff`:

| Artifact | Change |
| --- | --- |
| `eslint.config.js:31` | `'@typescript-eslint/no-explicit-any': 'off'` → `'error'` (1 line) |
| `src/test/eslintConfig.test.ts` (new, 29 lines) | 3-test guard driving the real flat config via the ESLint API |
| `.improve/reports/impl-IMP-043.md`, `.improve/reports/discovered-IMP-043.md` (new, untracked) | workflow artifacts |

- No production code touched; no new dependency; no lockfile change.
- No debug leftovers, no `console.*`, no unrelated files.
- The new test is in the item's declared scope (type safety / tooling) and is justified: the
  spec's verification was a manual `lint` + grep, and a guard prevents silent re-disable.
- `discovered-IMP-043.md` is a correct, honest observation (`.js` config files are outside both
  tsconfig and the flat-config `files` glob). Not a defect of this change.

---

## 2. Acceptance criteria

| AC | Requirement | Result |
| --- | --- | --- |
| 1 | Rule enabled (error, or warn if none) | **PASS** — set to `error`. The codebase has no `any`, so strict is correct. |
| 2 | `npm run lint` passes with rule on | **PASS** — `eslint .` exits 0, no output. |
| 3 | Legitimate `any` carries a justified disable | **PASS (vacuous by fact)** — no legitimate `any` exists, so no disable is needed. |

Independent grep for `\bany\b` in `src/` returns 18 matches, **all** prose/comment/string/test-name
text (`MobileBottomNav.tsx:40`, `TodayView.tsx:272`, test titles, etc.). The only `: any` token is
inside the string literal at `eslintConfig.test.ts:20` (a fixture, not an annotation). AC2's recon
claim holds.

---

## 3. Regression-test robustness / speed / flakiness

`src/test/eslintConfig.test.ts`:

1. `calculateConfigForFile('src/fixture.ts').rules[RULE][0] > 0` — reads the project's **real**
   `eslint.config.js` (no fixture config, no mock), so it cannot pass vacuously.
2. `lintText('export const value: any = 1;')` → exactly one message with `ruleId === RULE`.
3. `lintText('export const value: number = 1;')` → zero messages with `ruleId === RULE`
   (no false positive).

Non-vacuity: if the config were `'off'`, assertion 1 reads severity `0` (fails) and assertion 2
sees zero messages (fails `toHaveLength(1)`). This matches the implementer's reported mutation
check (2/3 fail when reverted to `'off'`). The guard is sound.

Robustness:
- Deterministic: no timers, network, filesystem races, or shared mutable state; ESLint caching is
  off. No cross-test interference (each `lint()` builds its own `ESLint` instance).
- Messages are filtered by `ruleId`, so a future unrelated rule firing on the fixture cannot make
  it flaky.
- `severity > 0` (not `=== 2`) is intentional and spec-permitted ("error, or warn if the codebase
  has none"); it will not spuriously fail a deliberate downgrade to `warn`.

Speed: file alone runs in ~1.2 s (first `ESLint` construction ~733 ms for config load, then 35 ms
and 10 ms). Full suite unaffected: 43 files / 474 tests in 16.2 s. Well within budget.

Minor, non-blocking:
- The test depends on `process.cwd()` being the repo root; true for `npm run test` and vitest's
  default. Slightly fragile if ever invoked from another cwd, but not a flake in normal use.
- It exercises `.ts` only, not `.tsx`; the flat config applies both, so the criterion ("TypeScript
  sources") is covered.
- `config.rules[RULE]` being a normalized array is an ESLint 9 flat-config behavior; a future
  ESLint major bump could require revisiting the test. Acceptable.

---

## 4. Gates (all run in this repo, this revision)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS (`tsc --noEmit`, no output) |
| `npm run lint` | PASS (exit 0, rule on) |
| `npm run test` | PASS — 43 files / 474 tests |
| `npm run format:check` | PASS — "All matched files use Prettier code style!" |
| `npm run build` | PASS — vite build + PWA sw, `built in 2.73s` |

The new test file itself passes Prettier and lint.

---

## 5. Findings

No blockers. No minor issues requiring a change. Two informational notes (cwd dependence,
ESLint-major sensitivity) recorded above; neither affects the verdict.
