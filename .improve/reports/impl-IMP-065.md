# IMP-065 — Document the preview-build service-worker reset

- **Status:** DONE
- **Branch:** `improve/auto-20261017`
- **Date:** 2026-10-17

## Change

Added `### Browser verification against a preview build` under **Commands** in the canonical
agent doc (tracked as `agents.md`; `AGENTS.md` resolves to the same file on this
case-insensitive filesystem). The section records:

1. Why it matters: after a rebuild, the existing origin keeps executing the previous
   `workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/` bundle and may show the
   "A new version is available" toast, while `page.goto` to the same `#/…` URL only changes
   the hash and does not reload the document.
2. The copy-pasteable reset (unregister all service workers, delete all Cache Storage keys)
   and the `about:blank` → preview-URL step that forces a real document load.
3. That vite-plugin-pwa's `devOptions` shortcut applies only to `npm run dev`, never to
   `preview`, which always uses the generated `dist/sw.js` precache.
4. That focus-trap Tab checks must dispatch a synthetic `keydown` on
   `document.activeElement`, not `document`, because the trap listens on its container.

No guidance was duplicated into `README.md` or `.improve/REPO_PROFILE.md`, and no source file
was changed.

## Acceptance criteria

1. Copy-pasteable reset snippet plus `about:blank`/back step, stated as a prerequisite for a
   rebuilt preview bundle — done.
2. `devOptions` noted as dev-only — done.
3. Focus-trap `keydown` target documented — done.
4. No duplicate verification section and no source change — done; single section in
   `agents.md`.

## Verification

- Ran the documented snippet verbatim against a live `npm run preview` at
  `http://localhost:4173/eisenmatrix-calendar/`: before reset there was 1 registration and the
  workbox cache; after reset, 0 registrations and 0 cache keys. Navigating to `about:blank`
  and back loaded the app normally; the new worker registered and its precache (14 entries)
  referenced `assets/index-BXHYn6op.js`, matching the current `dist/index.html`.
- `npm run format:check` — pass ("All matched files use Prettier code style!").
- `npm run lint` — pass.
- `git diff` touches only `agents.md`; the `.improve/CHANGELOG.md`, `FEATURES.md` and
  `PROGRESS.log` edits were pre-existing and left untouched.
