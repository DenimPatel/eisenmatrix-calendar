# Recon: Runbook / Build & Test Commands

Repo: `/Users/denimpatel/Desktop/git/eisenmatrix-calendar`
Date: 2026-10-04
Runner env: macOS (darwin), node v25.6.1, npm 11.9.0
Timeout per command: 180s

## Config summary

- `package.json` scripts:
  - `dev` = `vite` (port 3000, host 0.0.0.0)
  - `build` = `tsc --noEmit && vite build`
  - `preview` = `vite preview`
  - `typecheck` = `tsc --noEmit`
  - `lint` = `eslint .`
  - `format` = `prettier --write .`
  - `test` = `vitest run`
  - `test:watch` = `vitest`
- `vite.config.ts`: `base: '/eisenmatrix-calendar/'`, server port 3000 host 0.0.0.0,
  alias `@ -> src`, VitePWA `injectManifest` (`src/pwa/sw.ts`), manualChunks.
- `vitest.config.ts`: environment `node`, globals true, include
  `src/**/*.test.{ts,tsx}`, setup `src/test/setup.ts`, alias
  `virtual:pwa-register -> src/test/pwaRegisterStub.ts`.
- `eslint.config.js`: flat config, TS/TSX only, ignores `dist/dev-dist/node_modules/coverage/public`.
- `tsconfig.json`: strict, `noEmit`, target ES2022, `@/*` paths; excludes `src/pwa/sw.ts`.
- `.github/workflows/deploy.yml`: on push to `main` / manual, node 20, `npm install` then
  `npm run build`, uploads `./dist`, deploys GitHub Pages. CI does NOT run lint/test/typecheck.

## Dependency install

`node_modules/` present. `node_modules` mtime (1789191506) is newer than both
`package.json` and `package-lock.json` (1789177954), so the install is current with
the lockfile. `npm install` was NOT re-run (per mission: only if absent or deps changed).

## Command results

### 1. `npm run typecheck` — PASS (exit 0)

```
> tsc --noEmit
EXIT:0
```

No diagnostics.

### 2. `npm run lint` — PASS (exit 0)

```
> eslint .
EXIT:0
```

No errors or warnings emitted.

### 3. `npm run test` — PASS (exit 0)

```
 RUN  v4.1.11
 Test Files  10 passed (10)
      Tests  49 passed (49)
   Duration  14.99s
EXIT:0
```

Benign Node warning (not a failure):
`Warning: --localstorage-file was provided without a valid path`.

### 4. `npm run build` — PASS (exit 0)

`tsc --noEmit` passed, then `vite build`:

```
vite v6.4.1 building for production...
✓ 2103 modules transformed.
dist/index.html   1.38 kB │ gzip: 0.56 kB
dist/assets/index-13tzoSer.css  32.55 kB │ gzip: 6.16 kB
dist/assets/index-sT4XhqAF.js  358.88 kB │ gzip: 106.69 kB
✓ built in 3.61s
PWA v1.3.0 injectManifest ... precache 18 entries (601.93 KiB) ... dist/sw.js
EXIT:0
```

Output written to `dist/` (index.html, assets/, manifest.webmanifest, sw.js, icons).

## Preview / serving

Command: `npm run preview` (or `npx vite preview`). Default preview port is 4173
(config sets dev port only). Verified live with `--port 4173 --strictPort`:

- `http://localhost:4173/` -> HTTP 302 redirect to `/eisenmatrix-calendar/`
- `http://localhost:4173/eisenmatrix-calendar/` -> HTTP 200, `<title>EisenMatrix Calendar</title>`

Base path: `/eisenmatrix-calendar/` (from `vite.config.ts`). Deep links use `HashRouter`.

For dev: `npm run dev` -> `http://localhost:3000/eisenmatrix-calendar/`.

## Pre-existing failures / baseline

NONE. All four verification commands pass cleanly on the current tree. Any failure
introduced by the improver is a regression, not a baseline issue.

## Recommended verification command set

Run in order (all must exit 0):

```
npm run typecheck && npm run lint && npm run test && npm run build
```

For browser checks: `npm run build && npm run preview` then open
`http://localhost:4173/eisenmatrix-calendar/`.
