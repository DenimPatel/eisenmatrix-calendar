# impl-IMP-033 — ARIA state for toggles and sortable list headers

## Retry fix (AC3)

The verifier failed AC3: `aria-sort` was on `<button>`/`<span>` elements with no
`table`/`grid`/`columnheader` ancestor, so the accessibility tree exposed no sort
state.

### Files changed in the retry
- `src/features/list/ListView.tsx` — added real table semantics to the existing
  grid layout, without changing its visual geometry:
  - header + body rows wrapped in `role="table"` (`aria-label="Items"`) with
    `role="rowgroup"` containers;
  - header row is `role="row"` with five `role="columnheader"` cells;
  - `aria-sort="ascending|descending"` now lives on the active
    `role="columnheader"` cell, with the existing sort `<button>` inside it;
  - inactive sortable columns keep `aria-sort="none"`;
  - the unsortable `List` column is a `columnheader` with no `aria-sort`;
  - leading select-all and every data cell use `role="cell"`; the title button is
    inside a `role="cell"` wrapper as `block w-full text-left` so row height,
    checkbox alignment, and text position match the old grid exactly.
- `src/features/list/ListView.test.tsx` — queries `[role="columnheader"]` (and
  asserts each is inside `[role="table"]`/`[role="row"]`), asserts `aria-sort`
  on the header rather than the button, asserts `List` has no `aria-sort`, and
  clicks the button inside the header.

The four toggle fixes from the first attempt are unchanged:
theme `aria-pressed` (`SettingsView.tsx`), note pin (`NotesView.tsx`), bill paid
(`BillsView.tsx`), habit mark-today (`HabitsView.tsx`), plus their tests.

## Verification

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (37 files, 402 tests)
- `npm run build` — PASS (PWA service worker generated, 18 precache entries)
- Browser (`vite preview` on a fresh origin, final build):
  - accessibility tree exposes `table "Items"` → `rowgroup` → `row` →
    `columnheader "Select"/[Item]/"List"/[Priority]/[Date]`;
  - initial: Date `aria-sort="ascending"`, Item/Priority `"none"`, List and
    Select have no `aria-sort`;
  - after clicking Date: Date `"descending"`, Item/Priority `"none"`, List
    unchanged;
  - header cell geometry matches the verifier's baseline:
    Item 557,148 524x21 · List 1093,148 112x21 · Priority 1217,148 112x21 ·
    Date 1341,148 96x21; header row 948x37.5;
  - a matched old-vs-new row probe measured identical row height (53.5), button
    height (36.5), checkbox/button center offsets, and title y;
  - console: 0 errors, 0 warnings.

No new unrelated findings; `discovered-IMP-033.md` is unchanged.
