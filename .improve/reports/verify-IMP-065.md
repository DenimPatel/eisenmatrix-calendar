# Verify IMP-065 — Preview-build service-worker reset docs

- **Verdict:** PASS
- **Reviewer:** independent verification (did not author the change)
- **Date:** 2026-10-17
- **Branch:** `improve/auto-20261017`

## Acceptance criteria

1. **Copy-pasteable reset + `about:blank`/back prerequisite — MET.**
   `agents.md` §"Browser verification against a preview build" contains the two-line
   `getRegistrations().map(unregister)` / `caches.keys().map(delete)` snippet (lines 58–61)
   and instructs navigating to `about:blank` and back for a real document load (lines 63–65).
   It is framed as a reset "before any browser check of a rebuilt bundle" in a section whose
   subject is `npm run preview` and which names Playwright `page.evaluate` directly.
2. **`devOptions` dev-only note — MET.** Lines 65–66 state the shortcut applies only to
   `npm run dev`, and `preview` always uses the generated `dist/sw.js` precache. This matches
   `vite.config.ts` (`strategies: 'injectManifest'`, no dev-only preview path) and
   `src/pwa/register.ts` (`virtual:pwa-register`, prompt/`onNeedRefresh` toast).
3. **`keydown` on `document.activeElement` — MET.** Lines 68–70 record the target and why an
   event dispatched on `document` does not reach the trap container.
4. **No duplication; docs only — MET.** `git diff` outside `.improve/` touches only
   `agents.md`. `README.md` (§Build & preview) and `.improve/REPO_PROFILE.md` §4 contain no
   reset/focus-trap guidance, so nothing is duplicated; no source file changed.

## Canonical file / findability

`git ls-files | grep -i agents` returns only `agents.md`; `AGENTS.md` is the same inode via the
case-insensitive filesystem, not separately tracked. The section is an `###` heading under
`## Commands` (line 49) and resolves to anchor
`#browser-verification-against-a-preview-build`.

## Behaviour check (executed)

Started `npm run preview` on a fresh server, navigated Playwright to
`http://localhost:4173/eisenmatrix-calendar/`, then ran the documented snippet verbatim:

- before: 1 registration, cache `workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/`,
  controller present;
- after: 0 registrations, 0 cache keys;
- `about:blank` → preview URL: `navigation.type === "navigate"`; worker re-registered, precache
  recreated (14 entries) with `/eisenmatrix-calendar/assets/index-BXHYn6op.js`, matching the
  current `dist/index.html`.

## Gates

- `npx prettier --check agents.md` — pass.
- `npm run lint` — pass (no output).
- `git diff --check` — clean.

## Scope / style

No scope creep: one focused section in the canonical guide, matching the repo's existing
Markdown style and Prettier output. The `.improve/CHANGELOG.md`, `FEATURES.md` and
`PROGRESS.log` modifications in the worktree predate/are workflow edits (IMP-064, status
lock), not part of this implementation.

## Suggested Docs/Onboarding health delta

3 → 4: the documented biggest gap ("preview SW reset undocumented") is closed and verified.
Remaining gap: `agents.md`/`AGENTS.md` naming (IMP-046) and deeper onboarding coverage.
