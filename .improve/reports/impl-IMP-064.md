# IMP-064 — Enforce Prettier in CI and format drifted source files

- **Status:** DONE
- **Branch:** `improve/auto-20261017`
- **Date:** 2026-10-17

## Reformatted tracked source/test files

Actual drift at HEAD differed from the spec's file list: `src/pwa/ReminderRuntime.tsx`
and `src/domain/itemActions.test.ts` were already clean. The tracked files Prettier
rewrote were:

- `src/db/repository.test.ts`
- `src/features/item/ItemEditorSheet.tsx`
- `src/features/settings/SettingsView.tsx`
- `src/pwa/delivery.test.ts`
- `src/pwa/delivery.ts`

All changes are formatting-only (line wrapping/import collapsing, plus the missing final
newline in `delivery.ts`); no behavior changed.

## CI and configuration

- `package.json`: added `"format:check": "prettier --check ."`.
- `.prettierignore`: added `.kilo`, `.improve` (state files, generated reports and
  artifacts), and `.playwright-mcp` (generated browser snapshots) so the check covers
  source/docs only and never rewrites workflow state.
- `.github/workflows/ci.yml`: added a required `Format check` step
  (`npm run format:check`) between Lint and Test.

## Verification

- `npx prettier --check .` → exit 0 ("All matched files use Prettier code style!").
- `npm run typecheck` → pass.
- `npm run lint` → pass.
- `npm run test` → 41 files, 425/425 tests pass (baseline unchanged).
- `npm run build` → pass (`dist/sw.js` generated, 18 precache entries).
- `git diff --stat` scoped to: the 5 source/test files above, `package.json`,
  `.prettierignore`, and `ci.yml` (`.improve` state edits are pre-existing and untouched).
