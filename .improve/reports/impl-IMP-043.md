# impl-IMP-043 — Re-enable the `no-explicit-any` lint rule

**Status: DONE.** Branch `improve/auto-20261017`, working tree only (no commit/push).

## Files

- `eslint.config.js:31` — `'@typescript-eslint/no-explicit-any': 'off'` → `'error'`. This
  restores the setting `typescript-eslint`'s `recommended` config already carries, which the
  flat config had been overriding.
- `src/test/eslintConfig.test.ts` (new) — 3 tests that run the project's real flat config through
  the ESLint API.

## Acceptance criteria

1. **Rule enabled.** `no-explicit-any` is set to `error` (not `warn`) because the codebase has no
   explicit `any`, so the strict setting passes unchanged.
2. **`npm run lint` passes.** `eslint .` exits 0 with no output. The recon claim holds: there is
   no `any` in `src/` — every `\bany\b` match is prose in a comment, a test name, or a string
   (`MobileBottomNav.tsx:40`, `TodayView.tsx:272`, etc.), never a type annotation.
3. **No disable comments needed.** No legitimate `any` exists, so no inline disable was added.

## The regression test

`src/test/eslintConfig.test.ts` is the guard the item's verification otherwise lacks (the spec's
method is a manual `lint` run plus a grep). It constructs `new ESLint({ cwd: process.cwd() })`,
so it lints against the repository's own `eslint.config.js`, and asserts:

1. `calculateConfigForFile('src/fixture.ts')` resolves the rule with severity `> 0` — the config
   itself is enabled for TypeScript sources.
2. `export const value: any = 1;` produces exactly one `@typescript-eslint/no-explicit-any`
   message (severity `> 0`).
3. `export const value: number = 1;` produces none, so the guard has no false positive.

`severity > 0` is asserted rather than `=== 2` so an intentional future downgrade to `warn`
(spec-permitted) does not fail the guard; "enabled" is the criterion.

## Verification

- `npm run typecheck` — PASS.
- `npm run lint` — PASS, no output (rule on).
- `npm run test` — 43 files / 474 tests passed (baseline 42/471 before this item; +1 file, +3 tests).
- `npm run format:check` — PASS ("All matched files use Prettier code style!").
- `grep '\bany\b' src` — only prose/comments/test names/strings; no un-annotated `any`.
- **Mutation check:** temporarily set the rule back to `'off'`; `eslintConfig.test.ts` fails
  2/3 (both assertions that depend on the rule firing). Reverted and re-ran: pass. This confirms
  the test actually pins AC1 rather than passing vacuously.

## Notes

- Minimal change: one token in the config plus one focused test file. No production code touched.
- The config's pre-existing comment (`eslint.config.js:26-27`) explains the two `react-hooks`
  rules it turns off and does not refer to `no-explicit-any`, so no comment needed editing.
