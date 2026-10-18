# verify2-IMP-098 — Dedicated status/date column in the Lists table

- **Item:** IMP-098
- **Impl report:** `.improve/reports/impl-IMP-098.md`
- **Prior review:** `.improve/reports/verify-IMP-098.md` (PASS with an md/1024 regression)
- **Reviewer:** independent skeptical re-review (no source modified)
- **Date:** 2026-10-18
- **Diff reviewed:** working tree vs `055fe79` — `src/features/list/ListView.tsx`,
  `src/features/list/ListView.test.tsx`, `src/features/goals/GoalsView.tsx`

## Verdict: PASS

The follow-up responsive fix in the impl report is real and the prior regression is gone.
Header and body grids are now byte-identical at every desktop width, the Item track no longer
collapses, and pill/date never wrap. One minor, pre-existing tag-row spill remains at 768/1024
(not introduced by this change).

## Acceptance criteria

1. **Header ↔ row alignment.** A single `TABLE_GRID` constant is applied to both the header
   row and every body row, and the header Item cell now has `min-w-0`. Measured
   `gridTemplateColumns` are identical and every cell's left/right edge matches within 1px at
   768 / 1024 / 1280 / 1440. **PASS** (prior failure at 768–1100 fixed).
2. **Zero horizontal overflow.** `documentElement.scrollWidth === clientWidth` and
   `table.scrollWidth === table.clientWidth` at 390 / 768 / 1024 / 1280 / 1440. **PASS.**
3. **Titles readable.** Title cell is `min-w-0` + `truncate`; long titles clip with an ellipsis
   (no spill) and short titles render in full. Title track is 110px at 768/1024, 266px at 1280,
   426px at 1440. **PASS.**
4. **Pill and date not wrapped.** Status pill `whitespace-nowrap` (measured height 21px vs
   15px line-height = one line) and date cell `whitespace-nowrap` (height 16px); no
   `scrollWidth > clientWidth` for either at any width, light and dark. **PASS.**
5. **Keyboard sort.** With the header button focused (not clicked), `Enter` on `Item` moved
   `aria-sort` `none → ascending → descending` and reordered rows alphabetically; `Space` on
   `Date` set `Date=ascending` with the visible dates in ascending order. **PASS.**

## Measured layout (light; dark spot-checked at 768 and 1280, identical)

| Viewport | Header tracks (px)           | Row tracks | Match | Doc/table overflow | Pill wrap | Date wrap |
| -------- | ---------------------------- | ---------- | ----- | ------------------ | --------- | --------- |
| 390      | header `display:none` (row 340px, 1 col) | n/a | n/a | 0 / 0 | 0 | 0 |
| 768      | `32 110 88 104 96`           | identical  | yes   | 0 / 0              | 0         | 0         |
| 1024     | `32 110 88 104 96`           | identical  | yes   | 0 / 0              | 0         | 0         |
| 1280     | `32 266 88 88 104 96`        | identical  | yes   | 0 / 0              | 0         | 0         |
| 1440     | `32 426 88 88 104 96`        | identical  | yes   | 0 / 0              | 0         | 0         |

At 390 the header is `display:none` and rows stack in one column; the status pill and date each
own a line and neither wraps. Content column: 502px at 1024, 758px at 1280, 918px at 1440.

## Minor residual (pre-existing, not a regression)

At 768 and 1024 the Item track is 110px; for a row carrying two tags the meta line
(kind badge + `#tag #tag`) measures 122px and spills ~12px into the 12px column gap, ending
flush at the next column's left edge (verified: spill right edge 423 == Priority cell left 423,
no overlap; screenshot confirms the tags stop just short of the Q1 badge). The cell has
`overflow: visible`, so the probe flags it. This is not introduced by IMP-098 — HEAD's Item
track at the same width was ~102px (`2rem 1fr 7rem 7rem 6rem`), so the spill is slightly smaller
now. All other `scrollWidth > clientWidth` cells (the `List` cell at 1280/1440, long title cells)
are `overflow: hidden` ellipsis truncation, which is the intended behavior.

## Test quality

`ListView.test.tsx` compares the responsive `grid-cols-[…]` tokens of the header and every row
(including the `md:` and `xl:` variants), so a breakpoint drift now fails the test. jsdom still
has no layout, so the real-browser track equality and overflow probes above remain the
authoritative check; the added test is a good structural guard but not a substitute.

## Out-of-scope change

`src/features/goals/GoalsView.tsx:150` (`bg-elevated` → `bg-border` progress track, light-mode
contrast, IMP-099 family) is still bundled into this diff. Harmless and unrelated to IMP-098.

## Gates (all pass)

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npm run test` ✓ (47 files, 533 tests)
- `npm run format:check` ✓
- `npm run build` ✓

## Browser evidence

`npm run preview` (4173), service worker unregistered + caches cleared, real document reload
before measuring. Artifacts:

- `.improve/artifacts/IMP-098/verify2-390-light-lists.png`
- `.improve/artifacts/IMP-098/verify2-768-dark-lists.png`
- `.improve/artifacts/IMP-098/verify2-768-dark-tagrow.png` (residual tag-row case)
- `.improve/artifacts/IMP-098/verify2-1280-light-lists.png`

Preview server stopped after the run (`lsof -ti:4173` → free). No source modified.
