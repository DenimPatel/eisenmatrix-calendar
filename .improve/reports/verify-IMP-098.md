# verify-IMP-098 — Dedicated status/date column in the Lists table

- **Item:** IMP-098
- **Impl report:** `.improve/reports/impl-IMP-098.md`
- **Reviewer:** independent skeptical review (no source modified)
- **Date:** 2026-10-18
- **Diff reviewed:** working tree vs `055fe79` — `src/features/list/ListView.tsx`,
  `src/features/list/ListView.test.tsx`, `src/features/goals/GoalsView.tsx`

## Verdict: PASS (with a regression to fix at md / 1024–1100)

The change meets all three acceptance criteria **at the 1280px target** in both themes,
and a11y roles are intact. It introduces a real header/row track mismatch and row
overflow at the `md` breakpoint (768px) and at lg widths where the sidebar is expanded
(1024–1100px), which the jsdom test cannot detect.

## Acceptance criteria

1. **Header cell ↔ body cell, equal width (desktop).**
   - At **1280px**: header `gridTemplateColumns = 32px 210px 112px 112px 112px 96px`,
     every body row identical; 6 `role="columnheader"`, 6 `role="cell"` per row. **PASS.**
   - At **768 / 1024 / 1100px**: header `… 41.5px …` vs row `… 0px / 30px …` — the `1fr`
     Item track diverges because the row cell has `min-w-0` and the header cell does not.
     **FAIL** (see Regression).
2. **Pill and date own a track and neither wraps at 1280px, light + dark.** Status pill
   `whitespace-nowrap`, date cell `truncate whitespace-nowrap`; measured in light and
   forced-dark, `scrollWidth <= clientWidth` for every cell, no wrap. **PASS at 1280.**
3. **No cell content exceeds its track width.** At 1280px: `In Progress` pill measured
   112/112px, no overflowing cells. **PASS at 1280**; fails at 768–1100 (below).

## Regression (introduced by this change)

Fixed tracks grew from `2rem 1fr 7rem 7rem 6rem` (352px) to `… 7rem 7rem 7rem …`
(464px). With `gap-3` (60px) that is 524px of content needed; the content column is
narrower whenever the sidebar is expanded.

| Viewport | Content col | Header tracks | Row tracks | Match | Overflowing cells |
| -------- | ----------- | ------------- | ---------- | ----- | ----------------- |
| 768      | 502px       | `32 41.5 112 112 112 96` | `32 0 112 112 112 96` | no  | 17 |
| 900      | 634px       | `32 86 …`                | `32 86 …`             | yes | 0  |
| 1024     | 502px       | `32 41.5 …`              | `32 0 …`              | no  | 17 |
| 1100     | 578px       | `32 41.5 …`              | `32 30 …`             | no  | 16 |
| 1280     | 722px       | `32 210 …`               | `32 210 …`            | yes | 0  |

At `md` (768px, the first width where the desktop header appears) the Item track collapses
to 0px, every title cell overflows its track, and the header/row grids no longer align.
At 1024px the `lg` sidebar expands, shrinking the content column back to 502px and
reproducing the overflow. HEAD did not have this (fixed tracks 352px fit both widths; the
HEAD defect was the intra-cell pill/date wrap that IMP-098 fixed).

Suggested fix directions (not applied): shrink the Status track to `6rem`, make the
header Item cell `min-w-0`, or move the split to a wider breakpoint.

## Long title / date overflow

Title cell is `min-w-0` + `truncate`; date is `truncate whitespace-nowrap`; both clip
rather than push. No title/date overflow observed at any tested width. OK.

## md and below (mobile)

Header is `hidden … md:grid` (IMP-091 context preserved). At 390px: header `display:none`,
row `grid-template-columns: 340px` (single column), 6 `role="cell"` stacked, 0 overflow.
PASS.

## Accessibility roles

`role="table"` / `rowgroup` / `row` / `columnheader` / `cell` all preserved; the split
keeps 6 header cells and 6 body cells aligned 1:1. Status pill nested inside its
`role="cell"` span is valid. PASS.

## Test quality

`ListView.test.tsx` compares the extracted `grid-cols-[…]` **class token** between header
and row. Both are the same literal string, so it asserts the source matches but cannot
detect the real-browser track divergence (jsdom has no layout). It also does not cover the
md breakpoint. The `waitForRow` poll is bounded and deterministic.

## Out-of-scope change

`src/features/goals/GoalsView.tsx:150` (`bg-elevated` → `bg-border` progress track) is an
unrelated light-mode contrast fix (IMP-099 family), bundled into an IMP-098 diff with no
test. Harmless, but not part of this item's criteria.

## Gates (all pass)

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npm run test` ✓ (47 files, 533 tests)
- `npm run format:check` ✓
- `npm run build` ✓

## Browser evidence

`npm run preview` (4173), SW unregistered + caches cleared, real reload before measuring.
Artifacts: `.improve/artifacts/IMP-098/verify-1280-lists.png`,
`.improve/artifacts/IMP-098/verify-1024-overflow.png`. Preview server stopped after the run.
