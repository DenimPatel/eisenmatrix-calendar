# verify-IMP-124 — Habit heatmap legend/summary + skip-to-content

**Reviewer:** independent skeptical review (no source modified)
**Items:** IMP-124, IMP-125
**Impl report:** `.improve/reports/impl-IMP-124.md`
**Diff under review:** `git diff` on branch `improve/auto-20261017`
(`HabitsView.tsx`, `HabitsView.test.tsx`, `AppShell.tsx`, `AppShell.test.tsx`, `labels.ts`, `.improve/FEATURES.md`)

## Verdict

**PASS WITH ONE DEFECT.** All acceptance criteria are functionally met and the four gates
are green, but the new `sr-only` heatmap table introduces **page-level horizontal overflow**
(a sideways-scroll regression) at every viewport narrower than the table's min-content width
— including 390 px mobile and 1280 px desktop. The impl report's "no layout breakage at 390"
claim is not reproducible.

## Criteria check

### IMP-124
1. Visible "less → more" legend — **met.** `HeatmapLegend` renders `Less [5 swatches] More`
   plus `0–4+ completions per day` under each habit grid. Swatches share `intensityClass()`
   with the grid (no drift). Light swatches `#e2e8f0 / #a7f3d0 / #6ee7b7 / #10b981 / #059669`;
   dark swatches `#1e293b / #064e3b / #065f46 / #059669 / #34d399` — distinct in both themes.
2. Accessible per-day/per-week summary — **met.** One `sr-only <table>` per habit: `<caption>`
   naming habit + 12-week window, `Weekday` + 12 week column headers (`scope="col"`, `MMM d`),
   7 full-weekday row headers (`scope="row"`, rotated to `weekStartsOn`), 84 `<td>` day counts.
   Verified 13 col headers, 7 row headers, 84 cells, all `scope` attributes correct.
3. Tests pass — **met** (see gates).

### IMP-125
1. First Tab reveals "Skip to content", moves focus to `<main id="main" tabIndex="-1">` — **met.**
   On a clean document load the first `Tab` focuses the skip button (visible at 12,12, accent
   bg); activating it sets `document.activeElement` to `MAIN#main`.
2. Link visually hidden until focused — **met** (`sr-only focus:not-sr-only …`); tests pass.

## Browser verification (preview 4173, SW/caches reset, seeded 41 habits)

Seeded 40 daily habits + 1 pre-existing, 84 days each, varied completions, `weekStartsOn: 1`.
Reloaded from `about:blank` after unregistering the SW and deleting caches. Server stopped
after checks. Artifacts in `.improve/artifacts/verify-IMP-124/`.

- **Legend light/dark, 1280 & 390:** renders correctly, swatches match grid shades, dark
  variants apply (`habits-1280-light.png`, `habits-1280-dark.png`).
- **Semantics:** caption + `th[scope=col]`/`th[scope=row]` present and correct.
- **Skip link:** first tab stop; `skip-390-focus.png`; Enter → focus `MAIN#main`,
  `location.hash` unchanged (`#/habits`), `scrollIntoView` moved page to y=56.
- **Landmarks unique:** exactly one `<main>` (one `#main`) in normal render; `ErrorBoundary`'s
  `<main>` only replaces it on error, never co-renders. Two `<nav>` with distinct labels
  (`Primary sections` + mobile) — no duplicate landmark names.
- **Focus trap + dialogs:** with the item editor open, 40× `Tab` never left the `[role=dialog]`
  (0 escapes) — the skip button is not reachable while a dialog is open.
- **Console:** 0 errors/warnings.

## Defect — horizontal page overflow from the `sr-only` table (IMP-124)

`<table className="sr-only">` cannot be shrunk by `.sr-only`'s `width: 1px`: a table's used
width is its min-content width (auto layout), which here is ~1242–1277 px (13 columns of
`MMM d` headers + 7 rows). `clip: rect(0,0,0,0)` hides it visually but does **not** remove it
from layout, and because the table *is* the `sr-only` element, nothing clips its box.

Measured on the built bundle:

| Viewport | `documentElement.scrollWidth` | Table `getBoundingClientRect().right` | Horizontal scroll? |
| -------- | ----------------------------- | ------------------------------------- | ------------------ |
| 390 px   | 1305                          | 1305                                  | yes (`scrollTo(500,0)` → x=500) |
| 1280 px  | 1537                          | 1502                                  | yes |

Hiding all 41 `table.sr-only` (`display:none`) drops `scrollWidth` to exactly the viewport
(390) — proving the tables are the sole cause. `habits-1280-hscroll.png` shows the page
scrolled 250 px sideways, with the nav rail pushed off-screen and dead space at right.

Impact: visible sideways scrollbar and content shift on desktop and mobile; the report's
390 px "no layout breakage" verification is incorrect. Fix is a one-liner — wrap the table in
a `<div className="sr-only">` (the div, not the table, becomes the 1 px clipped box) — but
that is a source change and out of scope for this review.

## Perf / size note

84 cells × N habits. With 41 habits the page held 41 tables, 3444 `<td>`, and ~9792 total DOM
nodes. No measurable jank observed; the sr-only table roughly doubles per-card node count but
is not a blocker on its own.

## Gates (all pass)

```
npm run typecheck    # clean
npm run lint         # clean
npm run test         # 52 files, 563 tests passed
npm run format:check # clean
```

`npm run build` also succeeds (precache 18 entries).

## Summary

Functionally IMP-124 and IMP-125 meet their acceptance criteria; semantics, legend contrast,
skip-link behaviour, landmark uniqueness and dialog focus-trap interplay all verified. The
one blocking-quality issue is the `sr-only` table's contribution to document scroll width,
which breaks mobile (and desktop) layout and contradicts the impl report's visual check.
