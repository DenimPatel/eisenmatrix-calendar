# Discovered — IMP-043

Unrelated findings noticed while implementing IMP-043:

- **`.js` config files are neither typechecked nor linted.** `tsconfig.json:25` includes only
  `src`, `vite.config.ts`, `vitest.config.ts` and `tailwind.config.ts`, and the flat config's
  `files: ['**/*.{ts,tsx}']` (`eslint.config.js:12`) scopes every rule to TS/TSX. So
  `eslint.config.js`, `postcss.config.js` and `index.html` are outside both gates; a typo in the
  lint config itself would only surface as a runtime ESLint failure. Pre-existing and low-impact
  (the tooling files are tiny and stable) — noted, not changed.
