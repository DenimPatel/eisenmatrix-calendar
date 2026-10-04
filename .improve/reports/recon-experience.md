# Recon: Experience Auditor (Visual UX + Developer/Reader Experience)

Repo: `/Users/denimpatel/Desktop/git/eisenmatrix-calendar`
Date: 2026-10-04
Runner env: macOS (darwin), node v25.6.1, npm 11.9.0
Method: live app via `npm run dev` (`http://localhost:3000/eisenmatrix-calendar/`), Playwright MCP
browser automation. No application code was changed; nothing committed.

## Visual capture — SUCCEEDED

Playwright MCP was available. The app was started with the real Vite dev server and driven
through every nav view, both themes, quick-add, command palette, the shortcut sheet, and the
item editor at desktop (1280x800) and mobile (390x844) widths.

Screenshots (exact paths, relative to repo root):

- `.improve/artifacts/baseline/desktop-01-today.png`
- `.improve/artifacts/baseline/desktop-02-calendar.png`
- `.improve/artifacts/baseline/desktop-03-matrix.png`
- `.improve/artifacts/baseline/desktop-04-lists.png`
- `.improve/artifacts/baseline/desktop-05-goals.png`
- `.improve/artifacts/baseline/desktop-06-habits.png`
- `.improve/artifacts/baseline/desktop-07-bills.png`
- `.improve/artifacts/baseline/desktop-08-shopping.png`
- `.improve/artifacts/baseline/desktop-09-notes.png`
- `.improve/artifacts/baseline/desktop-10-settings.png`
- `.improve/artifacts/baseline/desktop-11-settings-dark.png`
- `.improve/artifacts/baseline/desktop-12-today-dark.png`
- `.improve/artifacts/baseline/desktop-13-quickadd.png`
- `.improve/artifacts/baseline/desktop-14-today-with-item.png`
- `.improve/artifacts/baseline/desktop-15-command-palette.png`
- `.improve/artifacts/baseline/desktop-16-item-editor.png`
- `.improve/artifacts/baseline/mobile-390-01-today.png`
- `.improve/artifacts/baseline/mobile-390-02-today-bottomnav.png` (full page)
- `.improve/artifacts/baseline/mobile-390-03-calendar.png`
- `.improve/artifacts/baseline/mobile-390-04-shortcuts.png`
- `.improve/artifacts/baseline/mobile-390-05-settings.png`

(Note: the Playwright MCP screenshot tool sanitizes nested output paths into
`.playwright-mcp/-improve-artifacts-baseline-*.png`; these were copied to the canonical
`.improve/artifacts/baseline/` filenames above.)

## Console errors

**0 console errors or warnings** across the whole session (all views, both themes,
quick-add, command palette, shortcut sheet, item editor, mobile). The only console output was
Vite dev-server `DEBUG`/`INFO` HMR lines. No network request failures were observed.

## Findings

Severity scale: HIGH = blocks/degrades a core flow or violates a11y; MEDIUM = noticeable
friction/confusion; LOW = polish/hygiene.

| # | Sev | Area | Finding |
|---|-----|------|---------|
| 1 | HIGH | Mobile nav / reachability | Bottom nav overflows horizontally at 390px. Measured `nav.scrollWidth = 564` vs `clientWidth = 390` (`overflow-x: auto`). Only Today, Calendar, Matrix, Lists, Goals, Habits, Bills are visible; **Shopping, Notes and Settings are off-screen and require an undiscoverable horizontal swipe** (no fade, arrow, or scroll hint). Evidence: `mobile-390-01-today.png`, `mobile-390-02-today-bottomnav.png`, DOM measure. |
| 2 | MEDIUM | A11y / focus management | Input-first overlays receive focus on the **Close** button, not the primary input. Confirmed `[active]` on "Close dialog"/"Close panel" for Quick add, Command palette, Keyboard shortcuts, and Item editor snapshots. Keyboard users must Shift+Tab backwards to reach the text being typed. Evidence: `desktop-13-quickadd.png`, `desktop-15-command-palette.png`, `desktop-16-item-editor.png`. Quick add also works, but initial focus should be the textbox. |
| 3 | MEDIUM | Quick-add parser | Trailing preposition is left in the parsed title. `"Call dentist tomorrow at 3pm !urgent #health"` produced title **"Call dentist at"** (the "at" consumed by "3pm" is not stripped). Toast read `Added "Call dentist at"`; the stored item/List row shows the same. Date/time/tags parsed correctly. Evidence: `desktop-14-today-with-item.png`, Lists row snapshot. |
| 4 | MEDIUM | Loading state | List/query views render a **false empty state before `useLiveQuery` resolves**. Navigating to Lists immediately showed `All items 0` + "No items match", then flipped to `All items 1` once data loaded (IndexedDB held 1 item the whole time; `items.count = 1`). No skeleton/loading indicator, so a slow device shows "you have nothing / no items match" misleadingly. |
| 5 | LOW | Mobile layout | Fixed bottom nav overlaps the last content line on Today (`"Data stays on this device…"` is partly hidden in the viewport screenshot); bottom padding under the nav is insufficient. Also nav labels are ~10px. Evidence: `mobile-390-01-today.png`, `mobile-390-02-today-bottomnav.png`. |
| 6 | LOW | A11y / naming | The Quick add textbox accessible name is derived from its long placeholder (`"pay electricity $120 every month on the 5th !urgent"`), so screen readers announce an example sentence instead of a concise label. The command palette combobox name is likewise the full placeholder string. |
| 7 | LOW | Dev/repo hygiene | Repo ships `README.md` but **no `LICENSE` file** despite README declaring MIT; **no `engines`/`.nvmrc`/`.node-version`** despite README requiring "Node.js 20+"; only `.github/workflows/deploy.yml` exists (no lint/test/typecheck gate in CI). |
| 8 | LOW | Docs interop | Agent guidance lives at lowercase `agents.md` (README links it correctly), but the common convention/tooling expectation is uppercase `AGENTS.md`. On case-sensitive filesystems/CI an uppercase lookup misses the file. |

## Verified as working (no finding)

- Theme switching is correct. Toggling to dark set `html.class="dark"` and body bg
  `rgb(2,6,23)`; light and dark both render cleanly (`desktop-10`/`11`/`12`). An early
  screenshot showed a stale light frame purely from render timing, not a bug.
- All 10 nav views + the item editor render without layout breakage at 1280px; no horizontal
  document overflow at 390px outside the bottom nav (`document.scrollWidth == clientWidth == 390`).
- Quick add opens with focused state, shows live parsed chips + editable Kind/Date/Time, and
  commits with a toast. Command palette (`⌘K`) lists navigation + create actions + theme
  actions + existing items. Shortcut sheet (`?`) matches the documented shortcut list.
- Empty states exist and read well on Today (agenda/habits/bills/goals), Lists, and elsewhere.
- Calendar places items in the correct day cell (verified the Oct 4 chip is inside the
  `Add item on 2026-10-04` cell, not the adjacent 3rd).

## Developer / reader experience (PART B)

Documented commands **all work** on the current tree (independently re-run for this recon):

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS (exit 0, no diagnostics) |
| `npm run lint` | PASS (exit 0, no output) |
| `npm run test` | PASS — 10 test files, 49/49 tests, ~8.7s |
| `npm run build` | PASS — `tsc --noEmit` + `vite build` (2103 modules) + PWA `injectManifest` → `dist/sw.js`, precache 18 entries (601.93 KiB) |
| `npm run dev` | PASS — ready in ~1s, serves `http://localhost:3000/eisenmatrix-calendar/` exactly as documented |

Documentation quality is strong:

- `README.md` is accurate: install/dev/build/preview, quality gates, architecture table,
  data/privacy, deployment and the `/eisenmatrix-calendar/` base path all match reality.
- `agents.md` is an unusually complete onboarding doc: commands, directory map, unified `Item`
  model, data-flow rules, recurrence engine, date rules, conventions, keyboard shortcuts, PWA,
  and the v1 migration. **Every one of the 18 src paths it references was verified to exist**
  (`src/domain/*`, `src/db/*`, `src/store/useUiStore.ts`, `src/hooks/*`, `src/pwa/*`, etc.).
- Error/empty copy is user-facing and calm ("Nothing scheduled today", "No habits yet.").
- Minor gaps: no `CONTRIBUTING`, no `LICENSE` file, no Node version pin, and CI has no
  quality gate (build-only) — cross-reference `.improve/reports/recon-runbook.md` and
  `recon-quality.md`.

## Recommendations (priority order)

1. Fix mobile bottom nav: make all 10 destinations reachable, or reduce the set + provide an
   overflow "More" affordance, and add a scroll fade indicator.
2. Move initial focus in Quick add, Command palette, and Item editor to the primary input/field.
3. Strip trailing prepositions in `src/domain/quickadd.ts` title parsing.
4. Render a loading skeleton (or `undefined` guard) instead of a zero/empty state while
   `useLiveQuery` is pending.
5. Add bottom padding for the fixed mobile nav; add a concise accessible `aria-label` to the
   quick-add input and palette combobox.
6. Repo hygiene: add `LICENSE`, `engines`/`.nvmrc`, and a lint/test CI job.
