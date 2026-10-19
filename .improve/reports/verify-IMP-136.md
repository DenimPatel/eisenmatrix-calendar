# Verification — IMP-136 (per-route document title + view announcement)

**Verifier:** independent (did not author the change)
**Date:** 2026-10-19
**Branch:** `improve/auto-20261018` (uncommitted)
**Baseline claim:** all gates green at HEAD (`2ff6b3d`).

## VERDICT: PASS

All three acceptance criteria are met; no scope creep, no new dependencies, no debug
leftovers, no visible UI change, no regressions.

---

## 1. Scope review

`git status` / `git diff` (uncommitted):

```
 M .improve/FEATURES.md      (IMP-136 status: TODO -> IN-PROGRESS, 1 line)
 M src/App.tsx               (+1 import, +1 <RouteAnnouncer /> mount)
 M src/features/shell/nav.ts (+BASE_TITLE, RouteMeta, ROUTE_META, routeMetaFor)
?? .improve/reports/discovered-IMP-136.md
?? .improve/reports/impl-IMP-136.md
?? src/features/shell/RouteAnnouncer.tsx
?? src/features/shell/RouteAnnouncer.test.tsx
?? src/features/shell/routeChange.ts
?? src/features/shell/routeChange.test.ts
```

- **No unrelated edits.** No view files, no `index.html`, no schema/migrations, no
  package.json / package-lock.json (no new dependencies), no other `.improve` state/backlog
  file touched (`git diff HEAD -- .improve/STATE.md .improve/PROGRESS.log .improve/DECISIONS.md`
  is empty; only `FEATURES.md` is modified).
- **No debug leftovers**: no `console.*`, `debugger`, `TODO`/`FIXME` in any new/changed file.
- **`index.html:13` unchanged** — intentional: the spec (discover4-delivery.md:65, criterion 3)
  requires the initial load to keep the static `<title>`.
- Minor observation (not a defect): `FEATURES.md` is left at `IN-PROGRESS` while
  `impl-IMP-136.md` says "done"; the DONE flip is presumably deferred to integration.

## 2. Static gates (all green, no new failures)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS (no output) |
| `npm run lint` | PASS (no output) |
| `npm run test` | PASS — 74 files, 722 tests |
| `npm run format:check` | PASS — all matched files use Prettier |
| `npm run build` | PASS — `dist/sw.js` generated, precache 28 entries (656.66 KiB) |

Matches the implementer report exactly. No baseline failure introduced.

## 3. Browser verification

Isolated preview: `npm run preview -- --port 4182 --strictPort` →
`http://localhost:4182/eisenmatrix-calendar/`. SW registrations + caches cleared per
AGENTS.md, then `about:blank` → URL for a real document load.

### Initial load (1280x800 and 390x844)
- `document.title === 'EisenMatrix Calendar'` (static). ✔
- `document.activeElement === BODY` — no focus theft. ✔
- Both `role="status"` regions empty — no announcement. ✔

### 10 routes via nav click — desktop 1280x800 and mobile 390x844

| route | title | focus target | live region |
| --- | --- | --- | --- |
| calendar | `Calendar — EisenMatrix Calendar` | `#main` (no h1) | `Calendar` |
| matrix | `Matrix — EisenMatrix Calendar` | `H1` ("Eisenhower Matrix") | `Matrix` |
| lists | `Lists — EisenMatrix Calendar` | `#main` (no h1) | `Lists` |
| goals | `Goals — EisenMatrix Calendar` | `H1` | `Goals` |
| habits | `Habits — EisenMatrix Calendar` | `H1` | `Habits` |
| bills | `Bills — EisenMatrix Calendar` | `H1` | `Bills` |
| shopping | `Shopping — EisenMatrix Calendar` | `H1` | `Shopping` |
| notes | `Notes — EisenMatrix Calendar` | `H1` | `Notes` |
| settings | `Settings — EisenMatrix Calendar` | `H1` | `Settings` |
| today | `Today — EisenMatrix Calendar` | `H1` | `Today` |

Titles distinct, each begins with the view name; live-region text equals the view name;
focus lands on the new `h1` (or `#main` where no h1 exists — IMP-152 out of scope). ✔
Focus is not trapped: `Tab` after navigation moves to the next control inside `#main`.

### Back / Forward
`history.back()` restored `Settings → Notes → Shopping` and `history.forward()` restored
`Notes → Settings`, each with the matching title, live-region text and focus on the h1. ✔

### Overlay guard
Opened Quick-add (`c`): `[role="dialog"][aria-modal="true"]` present, focus inside the
dialog input. Clicking a nav link behind it was **intercepted** (Playwright click timeout),
hash/title unchanged, dialog still open, focus still inside. A programmatic `#/matrix` change
while open updated the title + announcement but **did not** move focus out of the overlay. ✔

### Console / network
0 console errors, 0 warnings; 0 failed requests (all 200). ✔

### No visible UI change
`RouteAnnouncer` renders only a Tailwind `sr-only` region (clipped, no layout impact). After a
mouse-driven nav the focused `h1` has `outline: none` and `:focus-visible === false`, so no
focus ring is painted — no visible change. ✔

**Artifacts:** `.improve/artifacts/IMP-136/` — `01-initial-1280x800.png`,
`02-initial-390x844.png`, `03-matrix-390x844.png`, `06-calendar-1280x800.png`,
`07-calendar-1280x800-snapshot.yml`.

## 4. Test quality (non-vacuous — confirmed by mutation)

Mutated production logic, ran `vitest run routeChange.test.ts RouteAnnouncer.test.tsx`, then
restored (verified byte-identical via `diff`):

| Mutation | Failures |
| --- | --- |
| `planRouteChange` returns `NO_ACTION` always | 7 failed / 15 |
| `title: meta.title` → `title: null` | 5 failed / 15 |
| `announcement: meta.name` → `announcement: null` | 7 failed / 15 |
| `if (plan.moveFocus) focusView();` → never | 2 failed / 15 |

**Answer: the tests are non-vacuous.** Removing the title write, the announcement, or the
focus move each fails the suite; the jsdom tests assert real DOM effects (title, focus,
live-region text), not just that helpers exist. 15/15 pass unmutated.

## 5. Files/state check

No other state or backlog file modified. `.improve/artifacts/` is excluded via
`.git/info/exclude`, so screenshots do not pollute the tree.

## 6. Observations (non-blocking, not criteria violations)

1. A **fresh deep link** to a non-landing route (e.g. `#/settings` on a full document load)
   keeps the static title and does not announce. This is exactly spec criterion 3
   (`discover4-delivery.md:65`) and the implementer's documented choice.
2. The Matrix `h1` reads "Eisenhower Matrix" while the announced name is "Matrix" — both
   begin the correct route identity; cosmetic only.
3. Two `role="status"` regions (`RouteFallback` + `RouteAnnouncer`) can both be present; the
   lazy fallback may briefly announce "Loading…". Both polite; already logged in
   `discovered-IMP-136.md`.
4. `FEATURES.md` status left `IN-PROGRESS` vs. the report's "done" — bookkeeping only.

## Suggested health delta per dimension touched

- **Correctness / delivery:** +1 (routes now distinguishable to AT and browser history;
  no data-path change, low risk).
- **Accessibility:** +1 (title + focus management + polite live region; initial load and
  overlay guard respected).
- **Test coverage:** +1 (new pure + jsdom suites, mutation-proven non-vacuous).
- **Performance / security / data integrity:** 0 (no change).
