# Discovered while implementing IMP-033

## 1. Pre-existing Prettier drift in five source files
- **Category:** repo hygiene / tooling
- **Evidence:** `npx prettier --check 'src/**/*.{ts,tsx}'` reports 5 files:
  `src/db/repository.test.ts`, `src/features/item/ItemEditorSheet.tsx`,
  `src/features/settings/SettingsView.tsx`, `src/pwa/delivery.ts`,
  `src/pwa/delivery.test.ts`. The same warning for `SettingsView.tsx` is
  reproducible against `HEAD` (`git show HEAD:... | npx prettier
  --stdin-filepath ... --check` exits 1).
- **Impact:** `npm run format` would produce unrelated diffs. Not part of the
  quality gates (typecheck/lint/test/build), so no action taken here.
- **Suggested fix:** run `npm run format` in a dedicated formatting-only change,
  or add a `prettier --check` gate if formatting is meant to be enforced.
