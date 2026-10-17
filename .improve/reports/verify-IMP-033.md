# verify-IMP-033 — ARIA state for toggles and sortable list headers

**Reviewer:** independent verifier (did not write the change)
**Date:** 2026-10-17
**Item:** `.improve/FEATURES.md` → `### IMP-033` (`:828-843`)
**Impl report:** `.improve/reports/impl-IMP-033.md`
**Conventions:** `.improve/REPO_PROFILE.md`, `AGENTS.md`
**Branch:** `improve/auto-20261017` (IMP-033 uncommitted; HEAD `e1ea1ff`)
**Browser:** Playwright MCP / Chromium against `npm run preview` at
`http://localhost:4173/eisenmatrix-calendar/`

---

## VERDICT: FAIL

The four toggle controls are implemented correctly and verified in the browser. The
sortable-header criterion is **not** met: `aria-sort` is attached to `<button>` elements
and a `<span>`, with no `table`/`grid`/`row`/`columnheader` semantics anywhere in the
header or rows. `aria-sort` is only defined on `columnheader`/`rowheader`, so the active
column and direction are not exposed to assistive technology; Chromium's accessibility
tree reports these controls as ordinary `button`s. The new `ListView` test asserts the
same invalid placement, so the suite is green while the accessibility contract is unmet.

---

## 1. Scope of the diff

```
 .improve/CHANGELOG.md                       |  1 +
 .improve/FEATURES.md                        |  2 +-
 .improve/PROGRESS.log                       |  1 +
 src/features/bills/BillsView.tsx            |  1 +
 src/features/habits/HabitsView.test.tsx     | 28 ++++++++++++++++++++++++++
 src/features/habits/HabitsView.tsx          |  1 +
 src/features/list/ListView.tsx              |  8 +++++++-
 src/features/notes/NotesView.test.tsx       | 28 ++++++++++++++++++++++++++
 src/features/notes/NotesView.tsx            |  1 +
 src/features/settings/SettingsView.test.tsx | 31 ++++++++++++++++++++++++++++-
 src/features/settings/SettingsView.tsx      |  1 +
 11 files changed, 100 insertions(+), 3 deletions(-)
 plus untracked: src/features/bills/BillsView.test.tsx,
                 src/features/list/ListView.test.tsx,
                 .improve/reports/{impl,discovered}-IMP-033.md
```

| File | Verdict |
|---|---|
| `SettingsView.tsx:201` | In scope: one `aria-pressed={theme === option}`. |
| `NotesView.tsx:128` | In scope: one `aria-pressed` from `data.pinned`. |
| `BillsView.tsx:125` | In scope: one `aria-pressed={paid}`. |
| `HabitsView.tsx:114` | In scope: one `aria-pressed={doneToday}`. |
| `ListView.tsx:71-72, 284, 288, 293, 301` | In scope but semantically incorrect (see §4). |
| Four test files | Additive tests; no existing assertions weakened. |
| `.improve/CHANGELOG.md`, `.improve/PROGRESS.log` | **Unrelated prior IMP-088 bookkeeping** left uncommitted, not attributable to IMP-033. |
| `.improve/FEATURES.md` | Bookkeeping: IMP-033 status `TODO → IN-PROGRESS` only. |

No dependency, lockfile, Dexie/repository, style, or generated-output changes. No
`console.*`, `debugger`, `TODO`, or `FIXME` in the changed source. `git diff --check`
is clean. `npx prettier --check` passes for every touched file except
`SettingsView.tsx`, whose warning is confirmed pre-existing against `HEAD`
(`git show HEAD:src/features/settings/SettingsView.tsx | npx prettier ... --check`
exits 1). This matches `discovered-IMP-033.md`.

`FEATURES.md` still says `IN-PROGRESS`; that is coordinator state, not an acceptance
criterion, but it should only become `DONE` after the sort-header defect is fixed.

---

## 2. Static gates

Run at 16:39Z:

| Command | Result |
|---|---|
| `npm run typecheck` | PASS (no diagnostics) |
| `npm run lint` | PASS (no output) |
| `npm run test` | PASS — 37 files, **402/402** tests (baseline 397, +5 as expected) |
| `npm run build` | PASS — `dist/sw.js` generated, 18 precache entries |

The test delta is exactly one test per touched control: Settings, Notes, Habits, Bills
(new file), Lists (new file).

---

## 3. Acceptance criteria

### AC1 — theme control exposes a proper `radiogroup`/`radio` or `aria-pressed` with the selected option — **MET**

`src/features/settings/SettingsView.tsx:201` adds `aria-pressed={theme === option}` to the
three segmented buttons. The criterion explicitly allows `aria-pressed`. Browser:

- initial: `system` `[pressed]`, `light`/`dark` unpressed;
- click `dark`: `dark` `[pressed]`, `system`/`light` unpressed;
- the header's theme label changes to `Theme: dark`.

The unit test independently asserts all three initial values and all three post-click
values, and also asserts the store updated to `dark`. Non-vacuous.

### AC2 — pin, bill-paid, and habit controls expose `aria-pressed` reflecting state — **MET**

| Control | Source | Browser evidence |
|---|---|---|
| Note pin | `NotesView.tsx:128` | `data.pinned=false` → button `aria-pressed="false"`; click → `true`, note moves to Pinned. |
| Bill paid | `BillsView.tsx:125` | `Mark paid` / `aria-pressed="false"`; click → `Mark unpaid` / `aria-pressed="true"`. |
| Habit mark-today | `HabitsView.tsx:114` | `Complete today` / `false`; click → `Undo today` / `true`, day/streak updated. |

All three unit tests seed real records, assert the before state, click, and assert the
after state; they are not mere attribute-presence checks.

Non-blocking semantic note: the bill and habit buttons change their accessible name
with state (`Mark paid` → `Mark unpaid`, `Complete today` → `Undo today`) while also
now exposing `aria-pressed`. AT will therefore announce action-oriented names plus a
pressed state (e.g. “Mark unpaid, pressed”). APG prefers a stable label for toggle
buttons. This is a pre-existing copy pattern, not introduced by IMP-033, and the
criterion only requires the pressed state to reflect state.

### AC3 — sortable ListView headers expose `aria-sort` = `ascending`/`descending` and the active column — **UNMET**

The attribute values are computed correctly and flip correctly in the DOM:

- initial: Date `ascending`; Item/Priority/List `none`;
- click Date: Date `descending`; others `none`;
- click Item twice: Item `ascending` then `descending`; Date `none`.

However, the attributes are placed on:

```
BUTTON  Item      aria-sort="none"        implicit role=button
SPAN    List      aria-sort="none"        implicit role=generic
BUTTON  Priority  aria-sort="none"        implicit role=button
BUTTON  Date      aria-sort="ascending"   implicit role=button
```

There is no semantic table/grid anywhere:

```
closest('[role="table"], [role="grid"], table')            -> null for all four
closest('[role="columnheader"], th')                        -> null for all four
```

The header row is a plain `div` (`ListView.tsx:270`) and the data rows are plain `div`s.

`aria-sort` is defined only for `columnheader`/`rowheader`; it is not a global attribute.
Chromium's CDP `Accessibility.getFullAXTree` confirms the result:

```
role=button name=Item      properties: invalid, focusable
role=button name=Priority  properties: invalid, focusable
role=button name=Date      properties: invalid, focusable, focused
(no columnheader node, no sort information)
```

So a screen-reader user still hears four unrelated buttons/text fragments with no table
structure, no header association, and no sort direction. The acceptance criterion's
“expose … and the active column” is not satisfied. The non-sortable `List` column is
also not a `columnheader`, so its explicit `none` is likewise ignored.

Correct remediation (one option):

1. Render the header as a real table (`<table><thead><tr><th scope="col">…`) or add full
   `role="table"`/`row`/`columnheader` structure to both the header and data rows.
2. Put `aria-sort` on the `th`/`role="columnheader"` cell, not the button; keep the
   button inside as the click target.
3. Omit `aria-sort` on the unsortable List column (a non-sortable header should have no
   sort state; if the coordinator insists on the spec note's “explicit non-sort state”,
   it must at least be on a `columnheader`).
4. Update `ListView.test.tsx` to assert the `columnheader` role plus its `aria-sort`
   (e.g. `getByRole('columnheader', { name: 'Date' })`), so the test cannot pass with
   the current invalid placement.

### AC4 — no visual change — **MET**

The source diff is attribute-only: no classes, CSS, markup nesting, icon, or text
changes. Screenshot dimensions are identical before/after each toggle
(Settings 1470×1003; Lists 1470×1067), and the List header geometry is byte-for-byte
identical across the sort flip:

```
Item 557,148 524x21 · List 1093,148 112x21 · Priority 1217,148 112x21 · Date 1341,148 96x21
```

The visible differences between screenshots are the intended pre-existing state styles
(theme colours, accent/check icon, row reorder), not layout changes from the ARIA work.

### Tests non-vacuous — **MET with a caveat**

All four toggle tests assert initial state, perform the interaction, and assert the
changed state. `ListView.test.tsx` is non-vacuous relative to the implementation (it
would fail if the mapping stopped flipping), but it asserts the attribute on the same
non-columnheader elements. It therefore locks in the AC3 defect instead of catching it;
this is the reason a green suite is not sufficient here.

---

## 4. Browser verification

Method: `npm run preview` on port 4173, Playwright MCP, seeded one note/bill/habit and
three tasks via raw IndexedDB, hard `page.reload()` so Dexie live queries saw the data.
Each control was snapshotted, clicked, and re-snapshotted; the List headers were checked
both in the DOM and in Chromium's accessibility tree.

| View | Before | After | Result |
|---|---|---|---|
| Settings | system `[pressed]` | dark `[pressed]` | PASS |
| Notes | pin `aria-pressed=false` | `true`, moved to Pinned | PASS |
| Bills | Mark paid `false` | Mark unpaid `true` | PASS |
| Habits | Complete today `false` | Undo today `true` | PASS |
| Lists | Date `ascending` | Date `descending` | DOM only; **not exposed to AT** |

Console: **0 errors, 0 warnings** across the session (`browser_console_messages`,
`all=true`). No failed network requests or React warnings were observed.

Evidence:

- `.improve/artifacts/IMP-033/browser-checks.txt` — raw observations, AX-tree output, geometry
- `.improve/artifacts/IMP-033/settings-theme-system.png`
- `.improve/artifacts/IMP-033/settings-theme-dark.png`
- `.improve/artifacts/IMP-033/notes-pin-unpressed.png`
- `.improve/artifacts/IMP-033/notes-pin-pressed.png`
- `.improve/artifacts/IMP-033/bills-paid-unpressed.png`
- `.improve/artifacts/IMP-033/bills-paid-pressed.png`
- `.improve/artifacts/IMP-033/habits-mark-unpressed.png`
- `.improve/artifacts/IMP-033/habits-mark-pressed.png`
- `.improve/artifacts/IMP-033/list-sort-date-ascending.png`
- `.improve/artifacts/IMP-033/list-sort-date-descending.png`

Browser automation was available; no fallback statement is needed.

---

## 5. Primary actionable issue

**Blocking — AC3: `aria-sort` is on invalid roles and is not exposed.**

- Location: `src/features/list/ListView.tsx:270-305` (header row, `:284`, `:288`, `:293`, `:301`)
- Observed: `aria-sort` on three `<button>`s and one `<span>`; no table/grid/columnheader
  ancestor; Chromium AX tree shows `role=button`, no sort property.
- Expected: `aria-sort` on `columnheader`/`th` cells in a coherent table/grid, with the
  active column marked `ascending`/`descending` and the non-sortable `List` column
  correctly represented (normally by omitting `aria-sort`).
- Fix + test: see AC3 remediation above; use an accessibility-role query in the test.

No other blocking issues.

---

## 6. Suggested Accessibility health delta

**0 as-is** (Accessibility stays **3/5**). IMP-033 fixes four real toggle-state gaps and
should be credited for those, but the headline sort-header gap named in the item's
intent remains unaddressed for AT users. After the header semantics are fixed and the
test asserts `columnheader` roles, the item would justify **+1 (3 → 4)**.

---

# Second attempt — independent re-verification

**Reviewer:** independent verifier (second attempt; did not write the change)
**Date:** 2026-10-17 (16:48Z–16:56Z)
**Item:** `.improve/FEATURES.md` → `### IMP-033` (`:828-843`)
**Impl report:** `.improve/reports/impl-IMP-033.md` (§Retry fix (AC3))
**Conventions:** `.improve/REPO_PROFILE.md`, `AGENTS.md`
**Branch:** `improve/auto-20261017` (IMP-033 uncommitted; HEAD `e1ea1ff`)
**Browser:** Playwright MCP / Chromium against two fresh-origin previews: current working
tree on `:4193`, HEAD baseline on `:4194` (`git archive HEAD` → temp dir → same
`node_modules` symlink → `npm run build`), after rebuilding the working tree.

## VERDICT: PASS

All four acceptance criteria are met. The AC3 defect from the first attempt is fixed: the
List view now exposes a complete ARIA table, `aria-sort` lives on `columnheader` cells, the
active direction flips correctly, and the unsortable List column carries no sort state. The
four toggle fixes are unchanged and re-verified. Layout is pixel-identical to HEAD.

## 1. Scope, style, and leftovers

```
 src/features/list/ListView.tsx     | 145 ++++++++++++++++-----  (145+, 108-)
 src/features/list/ListView.test.tsx| new file, 92 lines
 plus the first-attempt toggle/test files and IMP-033 bookkeeping (unchanged in retry)
```

- The retry is confined to `ListView.tsx` (table semantics + cell wrappers) and its new
  test. `sortDirection()` is a small local helper; sort comparison, `toggleSort`, filters,
  selection, bulk actions, drag/drop targets, and list creation are untouched.
- Large-looking diff is mostly re-indentation/wrapping; no dependency, lockfile, Dexie,
  repository, schema, CSS, or generated-output changes.
- `.improve/CHANGELOG.md` and `.improve/PROGRESS.log` still carry **unrelated IMP-088**
  bookkeeping (`e1ea1ff`). They are not attributable to IMP-033 and must not be bundled
  into an IMP-033 commit. `FEATURES.md` remains `IN-PROGRESS` (coordinator state).
- No `console.*`, `debugger`, `TODO`, `FIXME`, lint suppressions, or dead code in the
  changed source/tests. `git diff --check` is clean. Prettier passes for `ListView.tsx`,
  `ListView.test.tsx`, and the other touched source/test files; `SettingsView.tsx` still
  fails only with its pre-existing drift (confirmed by checking `git show HEAD:` output).

## 2. Static gates (re-run independently)

| Command | Result |
|---|---|
| `npm run typecheck` | PASS, no diagnostics |
| `npm run lint` | PASS, no output |
| `npm run test` | PASS — 37 files, **402/402** tests (expected 402) |
| `npm run build` | PASS — `dist/sw.js` generated, 18 precache entries |

The new `ListView.test.tsx` would fail against the first attempt: it queries
`[role="columnheader"]`, asserts each header is inside `[role="table"]`/`[role="row"]`,
asserts `aria-sort` on the header, and asserts `List` has none. It is non-vacuous.

## 3. Acceptance criteria

### AC1 — theme control exposes selected state — **MET**

`SettingsView.tsx:201` adds `aria-pressed={theme === option}`. Browser: initial
`system=true`, `light/dark=false`; click `dark` → `dark=true`, others false, `html.dark`
applied. Re-verified on the retry build.

### AC2 — pin, bill-paid, habit expose `aria-pressed` reflecting state — **MET**

| Control | Browser observation |
|---|---|
| Note pin | pinned note `true`; loose note `false` → click → `true` and moves to Pinned |
| Bill paid | `Mark paid` / `false` → click → `Mark unpaid` / `true`; sibling occurrence stays `false` |
| Habit mark-today | `Complete today` / `false` → click → `Undo today` / `true` |

The name-changing button copy is pre-existing APG-unideal but out of scope; the criterion
only requires the pressed state to reflect state.

### AC3 — table semantics and sort state — **MET**

Structure in the retry (`ListView.tsx:270-421`):

- one `role="table"` (`aria-label="Items"`) containing two `role="rowgroup"`s;
- header row is `role="row"` with five `role="columnheader"` cells; data rows are
  `role="row"` with five `role="cell"`s each; one header row + 12 data rows, 60 cells;
- each sortable header wraps its existing `<button>`; `aria-sort` is on the **header**,
  never on the button;
- `Select` and `List` are `columnheader`s with no `aria-sort` and no button/tab stop.

DOM state, click by click:

| Step | Item | List | Priority | Date |
|---|---|---|---|---|
| initial | `none` | — | `none` | **`ascending`** |
| click Item | **`ascending`** | — | `none` | `none` |
| click Item again | **`descending`** | — | `none` | `none` |
| click Priority | `none` | — | **`ascending`** | `none` |
| click Date | `none` | — | `none` | **`ascending`** |
| keyboard Enter on Date | `none` | — | `none` | **`descending`** |

Clicking the `List` header text leaves Date `ascending` and List without a sort state.
`aria-sort` on the inactive sortable columns is `"none"`; absent on the unsortable column
is valid and matches the prior verifier's remediation. Chromium's accessibility tree
exposes `table "Items"` → rowgroups → rows → 5 named columnheaders and 60 cells.

Verification caveat: this Chromium's CDP `Accessibility.getFullAXTree` does not surface a
`sort` property even for a native `<th aria-sort="ascending">` test fixture, so the AX dump
cannot be used as a value oracle. The role placement is now spec-correct (`aria-sort` is
defined only on `columnheader`/`rowheader`), the header roles/names are present in the AX
tree, and the values flip in the live DOM; that satisfies the criterion.

### AC4 — no visual change — **MET**

Full-page RGB pixel diff current vs HEAD baseline, same seeded data, same viewport/state:

| State | Size | Differing pixels |
|---|---|---|
| Lists desktop initial | 1470×1067 | **0** (diff bbox `None`) |
| Lists mobile default | 390×844 | **0** |
| Lists empty state | 1470×1067 | **0** |

Geometry is identical to the first verifier's baseline: Item `557,148 524×20.5`,
List `1093,148 112×20.5`, Priority `1217,148 112×20.5`, Date `1341,148 96×20.5`,
header row `948×37.5`; first row `501,177.5 948×54`, title button `557,185.5 524×37`,
checkbox `513,196 16×16`. At 1470×700 the inner list is 648/648 and document scroll is
850/700 in both builds; at 390 no horizontal overflow in either build.

## 4. Browser verification of existing interactions

- Row title click opens the editor dialog with the correct title, Schedule tab, Save and
  Close panel; `Escape` closes it.
- Row checkbox shows the bulk bar `1 selected`; Select all shows `12 selected`; Clear
  restores the view. Selection, bulk actions, and select-all logic are unchanged.
- Keyboard: focusing the Date sort button and pressing Enter flips the sort and keeps
  focus on the button. The List header is not a tab stop.
- Empty state: “No items match” renders; Reset filters restores `""` and all 12 rows.
- Console: **0 errors, 0 warnings** across the session (`all=true`).
- Toggle re-checks (theme/pin/bill/habit) all show the expected `aria-pressed` before and
  after the interaction; no console output.

Evidence: `.improve/artifacts/IMP-033/browser-checks-retry.txt`,
`retry-list-initial.png`, `retry-list-item-ascending.png`, `retry-list-item-descending.png`,
`retry-list-priority-ascending.png`, `retry-list-date-ascending.png`,
`retry-list-date-descending.png`, `retry-list-empty.png`,
`retry-list-mobile-390.png`, `retry-list-mobile-390-default.png`,
`retry-lists-snapshot-initial.yml`; baselines `baseline-list-initial.png`,
`baseline-list-mobile-390.png`, `baseline-list-empty.png`.

## 5. Non-blocking findings

1. **EmptyState is inside `role="table"` without a row/rowgroup** (`ListView.tsx:395-419`).
   With `filtered.length === 0`, the table contains a heading/paragraph/button outside any
   row; Chromium exposes them under the table. This is invalid required-owned content for
   `table`, though it does not break the empty-state interaction (Reset filters works) and
   is pixel-identical to baseline. Suggested follow-up: render the EmptyState outside the
   `role="table"` container (or wrap it in row/cell semantics if it must stay inside).
2. **Mobile header is `display:none` (`md:grid`), so the table has 0 columnheaders below
   `md`.** Rows still expose 5 cells with no header association. This is a natural
   consequence of the pre-existing hidden header and sorting is not available on mobile;
   consider a visually-hidden header row (`sr-only`) or applying the table roles only when
   the header is rendered. Not a criterion failure.
3. The body `rowgroup` sits inside a generic `.overflow-y-auto` wrapper. Chromium flattens
   the generic container and exposes the rowgroup correctly; optionally move the rowgroup
   role onto the scroll container to keep the ownership explicit.
4. `FEATURES.md` is still `IN-PROGRESS`; mark `DONE` only after this retry is committed and
   the unrelated IMP-088 bookkeeping is separated.

No blocking issues remain.

## 6. Suggested Accessibility health delta

**+1 (3 → 4).** This retry closes the sort-header defect that kept the previous attempt at
zero: the four controls now expose pressed state, the List is a real ARIA table, `aria-sort`
is on the active columnheader and flips in both mouse and keyboard use, and the new test
asserts roles rather than the old invalid attribute placement. The residual notes above are
edge-state polish, not the headline gap. Visual, Bugs/Correctness, and Tests/Tooling stay
unchanged (one focused new test, 402 total).
