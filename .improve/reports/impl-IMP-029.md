# impl-IMP-029 — pin the Node version (engines + .nvmrc)

## Files changed
- `package.json` — added `"engines": { "node": ">=20" }`
- `.nvmrc` — new file containing `20`

## Approach
- Matched `engines.node` to the README requirement ("Node.js 20+", `README.md:56`).
- Pinned `.nvmrc` to major `20`, the exact `node-version` used by both
  `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` (`actions/setup-node@v4`).
- No lockfiles, dependencies, scripts or formatting touched.

## Verification
- `node -e "const p=require('./package.json'); if(!p.engines||!p.engines.node) process.exit(1)"` — PASS (`>=20`)
- `.nvmrc` reads `20`

## Commands / results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (34 files, 386 tests; baseline 386)
- `npm run build` — PASS (`dist/sw.js` generated)
