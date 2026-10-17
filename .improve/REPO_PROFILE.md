# REPO PROFILE — eisenmatrix-calendar

## 1. Purpose & audience
A single-page **web application / installable offline PWA**: a local-first "personal
operating system" combining an Eisenhower Matrix, calendar, tasks/events, goals, habits,
bills, shopping lists, notes and reminders. All state lives in IndexedDB (Dexie); there is
no backend, account or telemetry; data is exportable (JSON/CSV/ICS) and the app deploys as
a static GitHub Pages site. Audience: end users (single-person, local-first) and, secondarily,
AI coding agents (AGENTS.md is an onboarding doc).

## 2. Repo type & primary verification strategy
**Type: single-page web application (PWA).** Primary strategy = static gates, then browser
smoke. Run gates in order, all must exit 0:
`npm run typecheck && npm run lint && npm run test && npm run build`.
Then: `npm run preview` and use Playwright MCP against
`http://localhost:4173/eisenmatrix-calendar/` (port 4173; `/` 302-redirects to the base path).
Check: no console errors/warnings, all 10 nav routes render, dark/light toggle, quick-add +
command palette + item editor open, mobile 390px. Dev alternative: `npm run dev` →
`http://localhost:3000/eisenmatrix-calendar/`.

## 3. Verified commands (baseline)
| Command | Status | Notes |
|---|---|---|
| `npm install` | n/a | `node_modules` may be absent in a fresh checkout; run it first (benign allowScripts warning for esbuild/fsevents). |
| `npm run dev` | PASS | Vite, ready ~1s, port 3000, base `/eisenmatrix-calendar/`. |
| `npm run build` | PASS | `tsc --noEmit && vite build`; PWA injectManifest → `dist/sw.js`, precache 18 entries (~601.93 KiB). |
| `npm run test` | PASS | Vitest 4; 33 files / 375 tests (2026-10-17). Emits benign warning `--localstorage-file was provided without a valid path`. |
| `npm run lint` | PASS | `eslint .` — no output. |
| `npm run typecheck` | PASS | `tsc --noEmit` — no diagnostics. |
| `npm run preview` | PASS | `vite preview`; port 4173; serves base path HTTP 200. |

## 4. How to verify a change
- **Data / domain logic** (`src/domain/*`, `src/lib/*`, `src/db/*`): add/run Vitest unit
  tests (`npm run test`); these modules are pure and covered by fake-indexeddb. No browser
  needed unless behavior surfaces in UI.
- **UI feature** (`src/features/*`, hooks, store): run all four gates, then dev/preview +
  Playwright: exercise the route, confirm no console errors, check empty and populated states
  and the relevant interaction.
- **Styling / a11y**: build + preview; verify light **and** dark themes via the Settings
  toggle; keyboard-tab through new controls; check reduced-motion; confirm semantic tokens
  (no hardcoded slate/white) render correctly in both themes.
- **PWA** (reminders, SW, notifications): `npm run build` must generate `dist/sw.js`;
  preview and confirm registration + `ReminderRuntime` ticks without console errors.
  Background/SW delivery is best-effort and OS-dependent.
- **Docs**: no command needed; just keep accurate, and do not duplicate `AGENTS.md`.

## 5. Conventions to follow (from AGENTS.md)
- Persistence only via `src/db/repository.ts`; **no direct Dexie outside `src/db/`**.
- Mutations only via `src/domain/itemActions.ts` (history + undo + toast).
- **No direct `localStorage`/`sessionStorage`** in features (only the legacy migration).
- Dates via `src/lib/date.ts`; never `Date.toISOString()` for date keys (use `formatISODate`,
  local). Week starts Monday by default; month-end is clamped, never skipped.
- IDs via `newId()`. Enums are stable lowercase slugs; display copy lives in `src/lib/labels.ts`.
- Styling via semantic tokens (`bg-bg`, `bg-surface`, `text-fg`, `text-muted`, `border-border`,
  `bg-accent`, `text-q1`…) and `cn()`; UI primitives in `src/components/ui/`.
- **No comments unless non-obvious intent.** Respect the layered dependency direction
  (features → domain/hooks → db → types; `lib` is a leaf).

## 6. Areas to avoid / high-risk
- Recurrence/reminder **date & local-time semantics** (`expandOccurrences`, `splitSeries`,
  `reminders.ts`); month-end clamp, `count`/`until`/exceptions/overrides are subtle.
- **Dexie schema/migrations** (`src/db/schema.ts`, `migrations/legacyTasks.ts`): versioned,
  idempotent, backs up to `backups` + `eisenmatrix-tasks.v1.bak`; a bad change is high-blast-radius.
- **Lockfiles** (`package-lock.json`), committed `dist/` and `dist/dev-dist/`, generated SW
  output, and `node_modules` — do not hand-edit.
- `.env*` / secrets: `.env.local` contains a stale `GEMINI_API_KEY` placeholder (gitignored);
  never print, rotate or commit it.
- Also avoid touching `metadata.json` (AI Studio scaffold artifact) and the duplicated
  `agents.md` (keep a single canonical copy).

## 7. Known pre-existing failures (do NOT blame new changes)
- **No command failures.** `typecheck`, `lint`, `test` (375/375) and `build` all pass cleanly at
  the 2026-10-17 baseline; any resulting failure is a regression.
- Benign Node warning on test: `--localstorage-file was provided without a valid path`.
- `npm audit`: 12 advisories (9 high, 1 moderate, 2 low, 0 critical), all in the dev/build
  toolchain (vite, rollup, tailwind→chokidar/fast-glob/picomatch). Tailwind fix is a **major**
  bump. Pre-existing, not introduced.
- Pre-existing product defects verifiers may encounter (known as of 2026-10-17, not regressions):
  `updateRecurring` "this and future" undo is incomplete; `skipOccurrence` and `SyncAdapter` have
  no UI/consumer (known seams); concurrent unawaited `setStatus` calls can still lose a key
  (IMP-089); view-level reads of a no-`data` row can still crash (IMP-088); an editor-created
  parent undone via IMP-069 can leave pre-saved subtasks orphaned (IMP-087). Previously listed
  defects (occurrence edits leaking, habit best-streak, note truncation, descendant deletion,
  week start, mobile nav, overlay focus, quick-add trailing words) are fixed.

## 8. Environment notes
- macOS (darwin); node **v24.21.0**, npm **11.19.0** (2026-10-17).
- Base path `/eisenmatrix-calendar/`; `HashRouter` (deep links work on the Pages subpath).
- Dev port **3000** (host 0.0.0.0); preview port **4173** (`npm run preview`).
- Playwright MCP available for browser verification.
- **Push is disabled in this run:** `.git/hooks/pre-push` prints `Pushing disabled by improver`
  and exits 1. Do not attempt to push; commits stay local on `improve/auto-20261017`.
- CI (`.github/workflows/ci.yml`) runs the quality gate; `deploy.yml` gates Pages on it. The
  latest `main` CI and Pages runs are green (2026-10-13).
