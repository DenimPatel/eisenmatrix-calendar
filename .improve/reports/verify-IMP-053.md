# IMP-053 — Independent verification report

**Verdict: PASS** (with 6 non-blocking observations, no blockers)

Reviewer: independent reviewer (did not author the change). Date: 2026-10-05.
Scope reviewed: working-tree diff of IMP-053 against
`HEAD = 9c5de51` (branch `claude/agent-manager-5ceb0eb4`, clean before the change).

---

## 1. Diff inventory and hygiene

```
$ git diff --numstat
1     0   .improve/PROGRESS.log
121   3   src/features/calendar/CalendarView.test.tsx
29    8   src/features/calendar/CalendarView.tsx
```

Untracked (not part of the change): `.improve/reports/discovered-IMP-053.md`,
`.improve/reports/impl-IMP-053.md`, `.improve/reports/regression-30.md`, `.kilo/kilo.jsonc`.

- **Scope creep:** none. Both source files are the only production files touched, and both
  are named in the impl report. No schema, repository, migration, `labels.ts`, `useUiStore`,
  `quickadd.ts` or `types/` change. `AGENTS.md` layering rules honoured: view-only local
  `useState`, no Dexie access, no `localStorage`.
- **Unrelated change:** the single `.improve/PROGRESS.log` line is an **IMP-052** entry
  (`RFC 5545 line folding`), not IMP-053. It is orchestrator log state, not source; flagged
  for completeness only.
- **Debug leftovers:** none. `git diff -U0 | grep -iE "console\.|debugger|TODO|FIXME|XXX|HACK|@ts-ignore|eslint-disable|\.only\(|api[_-]?key|secret|token|password|bearer"`
  → `NO-DEBUG-OR-SECRET-PATTERNS`.
- **Secrets:** none.
- **Style:** both toggles use semantic tokens only —
  `'block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-muted hover:bg-elevated hover:text-accent'`
  (month) and `'mt-1 text-[10px] text-muted hover:bg-elevated hover:text-accent'`
  (year card). No `slate`/`white` hardcode. Verified the tokens resolve per theme in
  `src/styles/index.css:11,28` (`--muted` differs light vs dark), and confirmed by computed
  style in dark mode: `color: rgb(148,163,184)` (dark `--muted`) against
  `body bg rgb(2,6,23)` — contrast is correct, not a hardcode leaking through.
- `MONTH_CELL_LIMIT = 3` / `YEAR_CARD_LIMIT = 5` extracted as named module constants replacing
  bare literals — a readability win, not scope creep.

---

## 2. Acceptance criteria, criterion by criterion

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Month `+N more` is a **button** that reveals all occurrences for that day | **MET** | `CalendarView.tsx:184` `shown` derivation, `:236-247` button. DOM probe: `{tag: "BUTTON", type: "button", ariaExpanded: "false", tabIndex: 0, disabled: false, rect: 132×19}` |
| 2 | Year-card `+N more` does the same for that month | **MET** | `CalendarView.tsx:342` local `expanded`, `:361-369` button; a11y tree shows 3 year-card buttons simultaneously (Oct/Nov/Dec) |
| 3 | With 6 items on a day, activating `+3 more` makes **all 6** reachable | **MET** | Playwright: cell `2026-10-20` showed `[Delta, Alpha, Echo] +3 more`; after activation `[Delta, Alpha, Echo, Charlie, Foxtrot, Bravo] Show less` — 6/6, no inner cap |
| 4 | Default (≤3 / ≤5) rendering unchanged | **MET** | Two dedicated tests assert `moreControl === undefined` at 3 and at 5. Confirmed in browser: every other day in October renders no control; the gated `shown` equals the old `slice` |

---

## 3. Interaction and a11y semantics

### 3.1 Real focusable control, keyboard reachable, `aria-expanded` reflects state

- Native `<button type="button">` — **not** a bare `div`. Present in the accessibility tree as
  `button "+3 more" [cursor=pointer]` (pre-change it was `paragraph`/generic with no cursor).
- `tabIndex = 0`, not `disabled`; focusable.
- `aria-expanded` flips correctly in both views: `"false"` with `+N more` → `"true"` with
  `Show less`, and back.
- **Keyboard activation:** native button semantics, no custom key handling. Pressed
  <kbd>Enter</kbd> with the control focused → collapsed to `+3 more` / 3 titles.
- **Focus retention across the toggle cycle** (checked because the toggle is an unkeyed
  trailing sibling of a keyed array, which can force React to remount it):
  ```
  nodeIdentityPreserved: true      (data-probe marker survived the click)
  focusStillOnToggle:   true      (document.activeElement === the Show less button)
  activeElementText:    "Show less", aria-expanded: "true"
  ```
  The a11y snapshot reports `[active]` on the `Show less` control in every expanded state.
  No focus loss to `<body>` — WCAG 2.4.3 satisfied.
- Label change (`+N more` ↔ `Show less`) is correct disclosure practice; the
  `+N more`/`Show less` pairing plus `aria-expanded` is what this repo already uses
  (`CommandPalette.tsx`), so the change is consistent with local convention.

### 3.2 Expanding reveals ALL capped occurrences; collapsing works

- Month, 6 items on `2026-10-20`: `+3 more` → 6 titles → `Show less` → back to 3 titles and
  `+3 more` reappears. No cap applied inside the expanded list.
- Year, October: `+14 more` → all **19** occurrences rendered (6 tasks on the 20th + 13
  daily-recurring occurrences) → `Show less`. November and December kept their own
  `+25 more` / `+26 more` simultaneously, confirming per-card independent state.

### 3.3 Works in BOTH month and year views

Verified independently in each. Screenshot evidence: `year-collapsed-1280.png` vs
`year-expanded-1280.png` (16→19 rows in October, `Show less [expanded]`); `month-collapsed-1280.png`
vs `month-expanded-1280.png`.

### 3.4 Each revealed occurrence is fully usable, not just visible text

Revealed rows are the *same* `<button onClick={() => openEditor(occ.item, occ.occKey)}>` as the
already-visible rows, so editing is available by construction. Verified end to end for a row
that was **hidden before expanding**:

1. Clicked hidden `IMP053 Bravo` on `2026-10-20` → editor opened, header
   `IMP053 Bravo` / `Occurrence 2026-10-20`.
2. Set **Status → Done**, clicked Save → chip re-rendered with
   `line-through text-muted bg-elevated` (done branch of the existing class ternary).
3. Clicked hidden **recurring** `IMP053 probe` on `2026-10-24` → editor opened with the
   scope selector and header `Occurrence 2026-10-24`; chose **This occurrence**,
   Status → Done, Save → toast `Occurrence updated`.

### 3.5 Toggling does not lose, duplicate, or reset occurrence state

Full expand → collapse → expand cycle, checked on DOM class names and text:

```json
{
  "afterSave":    ["IMP053 Hotel","IMP053 India","IMP053 probe [DONE]","IMP053 Gold"],
  "afterCollapse":["IMP053 Hotel","IMP053 India","IMP053 probe [DONE]"],   "+1 more"
  "afterReexpand":["IMP053 Hotel","IMP053 India","IMP053 probe [DONE]","IMP053 Gold"],
  "expandedAria": "true",  "noDuplicates": true,
  "neighboursUnchanged": { "23": ["IMP053 probe"], "25": ["IMP053 probe"] }
}
```

And for the plain task on the 20th:

```json
{ "afterSave": [..., "IMP053 Bravo [DONE]"],
  "afterReexpand": [Delta, Alpha, Echo, Charlie, Foxtrot, "IMP053 Bravo [DONE]"],
  "occurrencesMatch": true, "uniqueTitles": true }
```

Conclusions: status/override state **survives** the cycle; **no duplicates** (title set size ==
list length); **no reset**; **no order change**; and the occurrence-scoped done state does not
leak to neighbouring days of the same series (Oct 23 / Oct 25 stay to-do). The toggle holds
only `string | null` / `boolean` view state and the list stays derived from `useOccurrences`,
which is the correct layering per `AGENTS.md`.

---

## 4. Gates

```
$ npm run typecheck && npm run lint && npm run test && npm run build
```
All four green (`background_process` monitor, wall time well under the 400 s budget):

| Gate | Result |
|---|---|
| `typecheck` | clean (`tsc --noEmit`, no output) |
| `lint` | clean (`eslint .`, no errors/warnings) |
| `test` | **29 files, 287 tests passed** — baseline 28/282, so +1 file / +5 tests, 0 regressions |
| `build` | OK, `dist/sw.js` emitted |

The only emitted noise is a Node harness warning `--localstorage-file was provided without a
valid path`, which is pre-existing and unrelated.

---

## 5. Mutation check (independent re-run)

I re-ran mutation testing myself rather than trusting the impl report. The file was backed up
to `/tmp/CalendarView.IMP053.keep.tsx` and restored byte-identically afterwards
(`diff` clean, `git diff --stat` unchanged at 29/8, diff md5 `9a841e9583f568d6be73635cc190e188`).

| Mutant | Result |
|---|---|
| **Full revert** of `CalendarView.tsx` to `HEAD` | `Test Files 1 failed (1)`, `Tests 3 failed \| 6 passed (9)` — 3 of the 5 new tests fail |
| **Mutant A** — drop the month expansion branch (`const shown = dayOccurrences.slice(0, MONTH_CELL_LIMIT)`) | `1 failed \| 8 passed` — month reveal + collapse tests fail |
| **Mutant B** — drop the year-card expansion (`{occurrences.slice(0, YEAR_CARD_LIMIT).map(...)}`) | `1 failed \| 8 passed` — year reveal test fails |

The 2 new tests that survive a full revert are the two "default rendering free of a control"
tests, which is correct and expected: they assert criterion 4, i.e. behaviour that is
*unchanged* by this diff, so they cannot fail when the diff is removed. The two tests that
actually bind the new behaviour (month reveal/collapse, year reveal) are all caught.

---

## 6. Visual verification (Playwright, `npm run preview` on :4173)

Setup: wiped the browser `eisenmatrix` IndexedDB, cleared `localStorage` so the v1 legacy
migration did not re-seed, cleared the service worker + caches, then seeded through the app's
own Quick add: **6 tasks on 2026-10-20**, a **daily-recurring** task from 2026-10-22, and
**3 more tasks on 2026-10-24**.

**Console: `playwright_browser_console_messages` returned `[]` — zero errors and zero
warnings across the entire session** (expand/collapse, both views, editor open/save, dark-mode
toggle, both viewport sizes).

Artifacts in `.improve/artifacts/IMP-053/`:

| File | Content |
|---|---|
| `month-collapsed-1280.png` | Baseline: 3 chips + `+3 more`, pixel-equivalent to the pre-change rendering |
| `month-expanded-1280.png` | All 6 chips + `Show less` with a visible focus ring; cell grows, grid stays intact, **no overflow** |
| `month-expanded-dark-1280.png` | Dark mode: done items (`IMP053 Bravo`, `IMP053 probe` on the 24th) show line-through + elevated bg; toggles legible |
| `year-collapsed-1280.png` | Oct/Nov/Dec each showing 5 rows + `+N more` |
| `year-expanded-1280.png` | October fully expanded (19 rows); sibling cards stretch to keep the grid aligned; **no clipping** |
| `month-expanded-390.png` | 390px month grid |
| `year-expanded-390.png` | 390px year view — 19 rows fully readable, `Show less` legible, **no horizontal overflow** |

Measured, 1280px: toggle hit area **132 × 19** CSS px, consistent with the 18px-tall rows it
sits under — reads as part of the same hierarchy, not a bolted-on control. Measured, 390px:
`document.documentElement.scrollWidth === window.innerWidth === 390` → **no page-level
horizontal overflow in either view**.

**Layout judgement:** intentionally designed. Light and dark both read as one system, the
expanded list inherits the exact row treatment of the capped list, and the toggle's
`text-[10px] text-muted` weight matches the `+N more` it replaces, so the affordance reads as a
continuation rather than a new UI element. Row growth in both views is the honest consequence
of in-place expansion in a CSS grid and stays aligned.

---

## 7. Issues (all non-blocking; none contradict an acceptance criterion)

1. **Only one month cell can be expanded at a time** (`expandedDay: string | null`,
   `CalendarView.tsx:69`). Expanding a second cell silently collapses the first — observed when
   opening `2026-10-24` reverted `2026-10-20` to `+3 more`. This is a deliberate, documented
   choice (`impl-IMP-053.md:27-30`) and the year cards correctly do not share it, but it is a
   behaviour no acceptance criterion states, and it can yank content out from under a keyboard
   user mid-flow. Consider `string[]`, or at minimum clearing `expandedDay` on month
   navigation so the state cannot follow the user across months.
2. **Year-card toggle has no month context in its accessible name.** 12 sibling buttons read
   `+25 more`, `+26 more`, … with the month name only in an adjacent unassociated `<h3>`
   (`CalendarView.tsx:361-369`). `aria-controls` is likewise absent on both toggles
   (permitted by ARIA, but recommended). Suggest
   `aria-label={`Show all ${label} items`}` on the year toggle.
3. **390px legibility is poor, inherited from a pre-existing problem.** The month cell is only
   **52 px** wide at 390px, so the toggle needs 48 px of text in a 39 px box and truncates to
   `Sho…` / `+1 …`; the hit area is 39 × 19 px, under the WCAG 2.5.8 24 × 24 minimum. The old
   non-interactive `<div>` truncated identically in the same cell, so this is **not a
   regression** — but the 7-column month grid has no responsive treatment at all. The year
   view at 390px is fine. Worth a follow-up item for the month grid.
4. **Year-card rows render no done status** (no line-through), unlike month cells — a done item
   looks identical to a to-do one in year view. **Pre-existing**: the row `className` at
   `CalendarView.tsx:355` is untouched by this diff (verified in the diff hunks).
5. `expandedDay` is not cleared on prev/next month navigation, so an expanded day stays expanded
   if the user navigates away and back. Cosmetic, unspecified by the criteria.
6. `.improve/PROGRESS.log` in the working tree carries an **IMP-052** line, unrelated to
   IMP-053 (see §1).

None of the above is a blocker: every acceptance criterion is met, all four gates are green,
the mutation check bites, and the browser run shows zero console errors with occurrence state
intact across expand/collapse cycles in both views.