# Recon: Classifier

**Repo:** `eisenmatrix-calendar` · **Root:** `/Users/denimpatel/Desktop/git/eisenmatrix-calendar`
**Date:** 2026-10-04

## Classification

- **Type:** Single-page **web application** (installable offline PWA), not a library/CLI/docs site. No backend, no sync server.
- **Domain:** Personal productivity — a "personal operating system" bundling an Eisenhower Matrix, calendar, tasks/events, goals, habits, bills, shopping lists, notes and reminders behind one unified `Item` model.
- **Audience:** End users (single-person, local-first). Secondary audience is **AI coding agents** — both `AGENTS.md` and `agents.md` exist specifically as agent onboarding docs.
- **Purpose/intent:** Unify several productivity apps into one local-first, installable app. Data lives in IndexedDB; no account, no telemetry; exportable (JSON/CSV/ICS). Deployed as a static GitHub Pages site.

## Stack & build tools

- React 19 + TypeScript (strict) SPA, Vite 6, `@vitejs/plugin-react`.
- Tailwind CSS 3.4 (real build via PostCSS) + CSS-variable design tokens; `clsx`/`tailwind-merge` (`cn()`).
- Persistence: Dexie 4 (IndexedDB) + `dexie-react-hooks` `useLiveQuery`; versioned schema + migration from v1 localStorage.
- State: Zustand. Routing: `react-router-dom` v7 `HashRouter`. DnD: `@dnd-kit`. Dates: `date-fns`. Icons: `lucide-react`.
- PWA: `vite-plugin-pwa` `injectManifest` (`src/pwa/sw.ts`).
- Quality: ESLint 9 (typescript-eslint, react-hooks, react-refresh), Prettier; tests: Vitest 4 + `fake-indexeddb` + jsdom.
- CI/deploy: `.github/workflows` → GitHub Pages on push to `main`; base path `/eisenmatrix-calendar/`.

## Size & maturity

~9,260 LOC across ~80 TS/TSX files, 10 test files (domain/lib/db + one jsdom smoke test). Structure is layered and deliberate (`types`, `db/repository`, `domain/*`, `features/*`, `components/ui`, `hooks`, `lib`, `pwa`). Docs are unusually thorough (README + agent guide + architecture boundaries). This reads as a **polished, feature-complete personal project (late MVP → mature)** rather than a throwaway: migrations, undo/history, backups, recurrence overrides, accessibility notes. Caveats: `version: 0.0.0`, `private: true`, single-author, no LICENSE file despite README claiming MIT, and a prebuilt `dist/` is committed.

## Visual / runnable?

**Yes.** `npm run dev` serves port 3000 at `/eisenmatrix-calendar/`; `dist/` contains a prior production build (HTML/JS/CSS/manifest/sw). Playwright MCP is available (per `.improve/STATE.md`), so the UI can be exercised visually.

## Contradictions / doc-vs-reality notes

1. `AGENTS.md` and `agents.md` are **byte-identical duplicates** — two canonical agent docs, a drift/maintenance risk.
2. `metadata.json` describes only "task management calendar / Eisenhower Matrix," far narrower than README's full feature set; also contains `requestFramePermissions`, a Google AI Studio scaffold artifact.
3. `.env.local` contains `GEMINI_API_KEY=PLACEHOLDER_API_KEY`, yet **no Gemini/AI dependency exists** in `package.json` and no docs mention AI features — a stale secret-shaped artifact.
4. README states **MIT License**, but no `LICENSE` file is present.
5. README says "there is no server"; correct for runtime, but CI does build and deploy statically.
6. `agents.md` describes `src/db/sync/SyncAdapter.ts` as the "unimplemented sync seam"; the directory exists but is a stub by design.

## Top risks/unknowns for an improver

- Duplicated agent docs can diverge; edit only one canonical copy.
- IndexedDB schema/migration and recurrence/reminder engines are the high-blast-radius areas; they have tests but subtle date/local-time semantics (`formatISODate`, month-end clamping).
- Committed `dist/`, `.env.local`, and scaffold `metadata.json` are stale artifacts that can mislead tooling; verify before trusting.
