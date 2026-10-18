# verify-IMP-100 — Independent review of "Accessible tap targets for the completion toggle and calendar day add"

**Reviewer:** independent skeptical review
**Verdict:** PASS (acceptance criteria met) — with one minor UX regression and one over-stated metric.
**Method:** read the full diff against `HEAD` (`525d53c`); ran all four gates; built `dist/`, reset
SW/caches, ran `npm run preview` on 4173 and measured with a fresh Playwright context
(`indexedDB` is unavailable in the default MCP context, so a new `browser.newContext()` was used),
seeding 10 items across task/event/habit/goal/bill/shopping/note. Source was not modified.

---

## 1. Criteria check

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Every interactive control in the ten routes has a hit area ≥24×24 at 390px | **PASS** | Route probe over `/today /calendar /matrix /lists /goals /habits /bills /shopping /notes /settings`: the only sub-24 element is the `sr-only` "Skip to content" link (1×1, intentionally hidden). `documentElement.scrollWidth − innerWidth = 0` on all ten. |
| 2 | Completion toggle and calendar day add each measure ≥44×44 including padding | **PASS (bounding box only)** | Toggle `getBoundingClientRect` = 44×44 (Today 9, Matrix 5). Day add = 44×44 (35 visible in the month grid). See §3: the *effective* clickable area is ~40×44 / ~38×40 because the box is partly overlapped/clipped. |
| 3 | A target-size probe reports no control under 24px | **PASS** | Same probe as #1. |

## 2. Gates

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run format:check` ✓ · `npm run test` ✓ (57 files, 580 tests).

One flake on the first full run: `src/features/noDataRows.test.tsx › renders habits with a null target
and a partial target` failed once with `expected … to contain '2× per day'` (got `1× per day`). It
passes in isolation and on a re-run in the working tree, and also passes on a clean `HEAD` worktree —
so it is pre-existing order/`act` flakiness, **not** caused by this diff. Not a blocker.

## 3. Negative-margin hit areas — overlap and clipping (the substantive finding)

The diff keeps the original layout footprint by giving each 44px control large negative margins, so the
44px box deliberately overflows its layout slot. Empirically (elementFromPoint scan at 4px steps):

**Item completion toggle** (`ItemCard.tsx:83`, `-mb-3.5 -ml-3.5 -mr-3.5 -mt-3`):
- Rect 44×44. Horizontal scan at the vertical centre: SELF for offsets 0–38, then **`TITLEBTN` for the
  right ~6px**. Vertical scan: SELF 0–43.
- The right ~6px of the enlarged target is owned by the adjacent title button — which is also the
  dnd-kit drag handle (`aria-roledescription="draggable"`, `role="button"`, `tabindex=0`; the toggle
  itself has **no** drag attributes, so dnd-kit does not attach to it).
- **Confirmed mis-target:** clicking at `x = right − 3`, `y = centre` hit the title button's icon
  (`closestTitleBtn: true`), did **not** flip the toggle (`Mark as done` → `Mark as done`), and opened
  the item editor (`role=dialog`, title input value `Electric`). Clicking the toggle centre flips it and
  opens nothing; the left/top/bottom edges all hit SELF.
- Net: effective toggle ≈ 40×44 (still ≥24×24). A user aiming at the 16px circle and drifting a few px
  right gets "edit item" instead of "complete", which partly defeats the purpose of the enlargement.

**Calendar day add** (`CalendarView.tsx:209`, `-mx-3.5 -my-2.5`):
- Rect 44×44. Middle-column button horizontal scan: SELF 0–38, then the **next day cell** (`div.min-h-[6.5rem]`) at the right ~6px. Vertical scan (row ≥2): the previous row's cell owns the top ~4px and the next row's cell the bottom ~2px.
- Effective ≈ 38–40 × 38–40. Clicks at centre/left/bottom open the editor for the intended day; clicks
  at the right edge are a dead zone (no dialog) — **no unintended opens**.
- Last column: the box extends past the card edge and is clipped by `.card.overflow-hidden` (measured
  effective width 35, corners resolving to `html`), so the declared 44 is not fully clickable there.
- No chip mis-target observed: the first chip paints above the button's bottom strip in practice, but
  with a full cell the bottom ~2px is a dead zone.

## 4. Scope creep

Seven files outside the item's `Area / files` were touched (ToastHost, Form, MatrixView, ShoppingView,
GoalsView, HabitsView, NotesView). This is **justified, not creep**: criterion 1 explicitly demands
"every interactive control in the ten routes ≥24×24", which cannot hold without those fixes, and the
route probe confirms they are needed and now pass. The changes are mechanical (padding / `h-6 w-6` /
negative-free sizing), add no logic, and introduce no overflow. The only broader-than-necessary effect
is the shared `Checkbox` growing 16→24, which is visible in Lists rows, the item editor and settings;
native checkboxes ignore padding, so this is the only way to reach 24px, and no layout broke.

## 5. Tests

The added tests assert class tokens (`h-11 w-11`, `h-6 w-6`, `min-h-6`) — adequate for the stated
criteria but they cannot catch the right-edge overlap or clipping; the effective-area claims in the
implementation report ("44×44", "no control under 24px") are rect-based, not effective-area-based.

## 6. Clipping / overflow summary

- No `overflow-hidden` ancestor clips the item toggle in Today or Matrix (left/top/bottom edges hit SELF).
- The month grid's `.card.overflow-hidden` clips the last column's add button (right ~8px) and the
  first/last row edges; still ≥24×24, no mis-target.

## Recommendation

Accept as-is for the stated acceptance criteria. Optional follow-up (low priority): move the completion
toggle out of the negative-margin trick (e.g. absolutely-positioned 44px hit area that does not overlap
the title button, or reserve the space) so the right edge toggles instead of opening the editor, and
re-state criterion 2 as "effective clickable area ≥44×44" so the overlap/clipping is caught by the probe.
