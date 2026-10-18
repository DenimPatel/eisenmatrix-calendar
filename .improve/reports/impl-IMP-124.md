# impl-IMP-124 — Habit heatmap legend + non-colour summary; skip-to-content landmark

**Status:** done

Covers IMP-124 and IMP-125 (both accessibility items from `discover3-features.md` F4/F5).
Note: both were already marked `Status: DONE` in `FEATURES.md` while neither was actually
implemented — the code, tests, and artifacts did not exist. This change implements them.

## IMP-124 — Legend and non-colour summary for the habit heatmap

`src/features/habits/HabitsView.tsx`

- Extracted the four-shade mapping into a module-level `intensityClass(intensity)` so the
  heatmap cells and the legend can never drift apart (`0` → `bg-border`, `1–4+` → the
  emerald ramp, unchanged tokens incl. the IMP-099 light-mode empty-cell fix).
- Added a visible `HeatmapLegend` under the grid: `Less` → five shade swatches → `More`,
  plus `0–4+ completions per day`. The swatch row is `aria-hidden`; the words carry the
  meaning.
- Added a visually hidden (`sr-only`) `<table>` per habit, the same data the shaded grid
  encodes: a `<caption>` naming the habit and the 12-week window, a `Weekday` column plus
  one column header per week (`formatDisplayDate(week, 'MMM d')`), one row per weekday
  (full names, rotated to `weekStartsOn`), and one `<td>` per day holding its completed
  count as text. Cells are keyed to the exact day the visual grid colours, so colour is no
  longer the sole encoding and per-day values are reachable by screen readers.
- The table is wrapped in a `<div className="sr-only overflow-hidden">`. `sr-only` on the
  table itself did not work: a table's used width is its min-content width (auto layout,
  ~1537 px here), `clip` does not remove it from layout, and because the table *was* the
  `sr-only` element nothing clipped its box — so it pushed `documentElement.scrollWidth`
  past the viewport (the defect in `verify-IMP-124.md`). Moving `sr-only` to the wrapper
  makes the wrapper the clipped 1 px box and contains the table.
- The visual grid keeps `role="img"` + `aria-label` and its `title` tooltips, so existing
  behaviour (and the existing tests) is unchanged.

`src/lib/labels.ts` — added `weekdayFullLabels(weekStartsOn)`, the full-name twin of the
existing `weekdayLabels`, so the table's row headers rotate with the configured week start.

## IMP-125 — Skip-to-content link and addressable `<main>`

`src/features/shell/AppShell.tsx`

- Added `id="main"` and `tabIndex={-1}` to `<main>`.
- Added a `Skip to content` button as the first focusable element in the shell. It is
  `sr-only` until focused (`focus:not-sr-only` + an accent chip at `left-3 top-3 z-50`).
- HashRouter owns the fragment, so the bypass is a `<button type="button">` whose
  `onClick` calls `document.getElementById('main').focus()` and `scrollIntoView({ block:
  'start' })`. It never writes `#main`, so the active route hash (`#/habits`) is preserved.
  Focus lands on `<main>`; the global `:focus-visible` rule provides the ring.

## Tests

`src/features/habits/HabitsView.test.tsx` — new `HabitsView heatmap legend and text summary`
suite:

1. The legend exists, shows `Less`/`More`, and its five swatches use the same shade tokens
   as the grid (`bg-border` … `bg-emerald-600`).
2. The accessible table is wrapped in an `sr-only` container, captions the habit, has 13
   column headers (`Weekday` + 12 weeks) and 7 full-name row headers in Monday-first order,
   with 84 cells all reading `0` for an uncompleted habit. The test also asserts the
   table's **wrapper** carries `sr-only overflow-hidden` (the clipping container), not the
   table itself.
3. Completing today flips exactly one table cell to `1`, proving the non-colour summary
   tracks the data.

`src/features/shell/AppShell.test.tsx` — new test: `<main>` has `id="main"` and
`tabIndex="-1"`; there is no `a[href="#main"]`; the first button is `type="button"`,
labelled `Skip to content`, `sr-only` with `focus:not-sr-only`; clicking it moves
`document.activeElement` to `<main>`.

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check` — all pass
(52 files, 563 tests).

## Visual verification

Built `dist/`, ran `npm run preview` on 4173, unregistered the service worker, deleted all
caches, seeded one habit (84 days, varied completions) plus `app` settings via IndexedDB,
then reloaded from `about:blank`. Verified at 1280 and 390 in light and dark:

- The heatmap, the `Less → More` legend, and the `0–4+ completions per day` hint all render
  with no layout breakage; dark shades keep their contrast.
- First `Tab` reveals the visible `Skip to content` chip; clicking it moved
  `document.activeElement` to `MAIN#main` while `location.hash` stayed `#/habits`.

Screenshots in `.improve/artifacts/IMP-124/`: `habits-1280-{light,dark}.png`,
`habits-390-{light,dark}.png`, `skip-1280-light.png`. Preview server stopped afterwards.

### Overflow fix verification (per `verify-IMP-124.md`)

Rebuilt, re-ran the preview, reset the SW/caches, seeded **8** daily habits (84 days each,
varied completions), reloaded from `about:blank`, and measured with the verifier's method
(`documentElement.scrollWidth` vs `innerWidth`, plus `window.scrollTo(500, 0)`):

| Viewport | `documentElement.scrollWidth` | `innerWidth` | `scrollTo(500,0)` → `scrollX` |
| -------- | ----------------------------- | ------------ | ----------------------------- |
| 390 px   | 390                           | 390          | 0 (no horizontal scroll)      |
| 1280 px  | 1280                          | 1280         | 0 (no horizontal scroll)      |

The tables still over-report their own box (`getBoundingClientRect().right` ≈ 1537 px) but
the `sr-only overflow-hidden` wrapper contains them, so the document no longer scrolls
sideways. Artifact: `.improve/artifacts/IMP-124/overflow-fix-390.png`.

## Notes

- No changes outside the two items' files plus the `labels.ts` helper.
- Not committed or pushed.
