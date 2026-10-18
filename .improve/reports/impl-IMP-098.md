# impl-IMP-098 — Give the Lists table a dedicated status/date column

- **Item:** IMP-098 (visual / layout, bug-fix, S / low risk)
- **Status:** DONE
- **Date:** 2026-10-18

## Change

`src/features/list/ListView.tsx` — the desktop header declared
`grid-cols-[2rem_1fr_7rem_7rem_6rem]` with four labelled columns, while each body row
rendered the status pill **and** the date inside the 96px fifth cell
(`flex justify-between`). At 1280px the pill wrapped (`To`/`Do`), the date wrapped, and
an `In Progress` pill overflowed into the date.

- Header grid → adds a `Status` `role="columnheader"` between `Priority` and `Date`.
- Body row grid → same tracks as the header.
- Split the combined cell into two `role="cell"` elements: the status pill and the date
  each own a track. Both use `whitespace-nowrap` so neither wraps.

Only semantic tokens are used (`border-border`, `bg-elevated`, `text-muted`,
`statusClasses`); no hardcoded colors.

### Follow-up: responsive tracks (verify-IMP-098 regression)

The first cut used fixed `7rem` tracks (`2rem 1fr 7rem 7rem 7rem 6rem`, 464px + 60px
gap). At `md` (768px) and at `lg` with the expanded sidebar (1024–1100px) the content
column is only ~502px, so the four fixed tracks starved the `1fr` Item track to 0px and
every title cell overflowed; the header's Item cell (no `min-w-0`) sized to its content,
so header and row tracks also diverged.

Fix — a single shared constant `TABLE_GRID` used by both the header and every row, so the
two grids cannot drift:

```
md:grid-cols-[2rem_minmax(0,1fr)_5.5rem_6.5rem_6rem]
xl:grid-cols-[2rem_minmax(0,1fr)_5.5rem_5.5rem_6.5rem_6rem]
```

- Item track is `minmax(0,1fr)` (not `1fr`) so it can shrink and truncate instead of
  forcing the grid wider; the header Item cell also gains `min-w-0`.
- The List track only renders at `xl` (≥1280px); the header and body List cells are
  `hidden xl:block`. Below `xl` the four remaining tracks fit ~502px with the Item track
  at 110px and no overflow.
- Fixed tracks narrowed (`5.5rem` list/priority, `6.5rem` status, `6rem` date) so the pill
  and date still fit without wrapping.

At 1280px the layout is unchanged in spirit (6 tracks, List visible).

## Add-on: Goals numeric progress track (light mode)

`src/features/goals/GoalsView.tsx:150` — the numeric goal progress track used
`bg-elevated`, which is `255 255 255` in light mode, identical to the card `bg-surface`,
so the unfilled track was invisible. Changed to `bg-border` (`226 232 240` light /
`30 41 59` dark), matching IMP-099.

## Test

`src/features/list/ListView.test.tsx` — new `ListView status/date columns` case seeds a
`doing` item and asserts: header labels are `[Select, Item, List, Priority, Status, Date]`;
the header and every body row expose the same set of **responsive** `grid-cols-[…]` tokens
(the `md:` and `xl:` variants are compared, not just the base class, so a breakpoint drift
between header and rows fails the test); each row has 6 `role="cell"` cells; the
`In Progress` pill and the `2026-10-18` date live in different, `whitespace-nowrap` cells.

## Verification (Playwright, `npm run preview`, 390 / 768 / 1024 / 1280, light + dark)

Service workers unregistered and caches cleared, then a real document reload before the
check. Seeded a `doing` task (`Ship the release notes`, Q1) plus a `todo` and a `done`
item; a persisted goal (`Read 10 books`, numeric 4/10) for the add-on.

Computed `gridTemplateColumns` and overflow probe (every cell `scrollWidth <= clientWidth + 1`,
table `scrollWidth <= clientWidth`):

| Viewport | Header tracks                                     | Row tracks         | Match | Overflow |
| -------- | ------------------------------------------------- | ------------------ | ----- | -------- |
| 390      | header `display:none`, rows `340px` (1 col)       | `340px`            | n/a   | 0        |
| 768      | `32 110 88 104 96` (5 cols, List hidden)          | identical          | yes   | 0        |
| 1024     | `32 110 88 104 96` (List hidden)                  | identical          | yes   | 0        |
| 1100     | `32 186 88 104 96` (List hidden)                  | identical          | yes   | 0        |
| 1280     | `32 266 88 88 104 96` (6 cols, List visible)      | identical          | yes   | 0        |

No title-cell overflow at any width; titles truncate (`min-w-0` + `truncate`). The
`In Progress` pill fits its 104px track and the date its 96px track in both themes.

Goals light-mode track: `backgroundColor rgb(226, 232, 240)` vs card `rgb(255, 255, 255)`
— measurably distinct.

Screenshots (all inspected), light + dark at each width:

- `.improve/artifacts/IMP-098/light-{390,768,1024,1280}-lists.png`
- `.improve/artifacts/IMP-098/dark-{390,768,1024,1280}-lists.png`
- `.improve/artifacts/IMP-098/goals-light-1280-progress.png` (add-on)

At 390px the header is hidden and rows stack (`grid-cols-1`); the status pill and date
each get their own line, neither wraps. Preview server stopped after the run.

## Gates

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` ✓ (47 files, 533 tests) ·
`npm run format:check` ✓ · `npm run build` ✓

No commit, push, or out-of-scope changes.
