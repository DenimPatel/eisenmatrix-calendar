# verify-IMP-101 — First-run create CTA in the Lists empty state

- **Item:** IMP-101 (UX / onboarding, bug-fix, S / low risk)
- **Verdict:** PASS (one minor, non-blocking edge-case note)
- **Reviewer:** independent, skeptical. Source not modified.
- **Date:** 2026-10-18

## Diff under review

Only these files changed; no out-of-scope edits:

- `src/features/list/ListView.tsx` — added `hasActiveFilter` guard and split the single
  `filtered.length === 0` branch into a first-run `EmptyState` ("No items yet" / `+ Add
  item`) vs. the existing "No items match / Reset filters". Extracted `createFirstItem`;
  the header `Add` button reuses it.
- `src/features/list/ListView.test.tsx` — new `ListView empty states` suite; `beforeEach`
  resets `filters`/`editor`.
- `.improve/FEATURES.md` — status TODO → DONE.

## Acceptance criteria

1. **Zero items, no active filter → first-run CTA whose primary action creates an item.**
   PASS. `hasActiveFilter` is false when search/kinds/statuses/listId/tags are empty, so the
   `ListTodo` EmptyState renders with title "No items yet", description "Add your first
   task, event or note to get started.", and an `Add item` button that calls
   `openEditor(createItem({ kind: 'task', start: formatISODate(new Date()) }))`. Verified in
   the browser on a cleared DB (mouse click and keyboard Enter both opened the editor with
   heading "Untitled" / kind "Task").
2. **"No items match / Reset filters" only with an active filter.** PASS. Guard covers
   search, kinds, statuses, listId and tags; verified for search, listId and a zero-data DB
   with a typed search.
3. **Both states covered by a test.** PASS. Two tests in `ListView.test.tsx`: zero-data
   no-filter asserts "No items yet" + click opens editor with a `task`; one-item + search
   asserts "No items match"/"Reset filters", that "No items yet" is absent, and Reset
   clears `filters.search` and reveals the row.

## Edge cases requested

- **Empty because only archived items exist (Archived toggle off).** MINOR ISSUE. With all
  items archived, `filtered` is empty and `hasActiveFilter` is false, so the first-run
  "No items yet" CTA shows even though items exist (just archived). `showArchived` is not
  part of `hasActiveFilter`, so the copy is slightly inaccurate and gives no hint that
  archived items exist. Acceptance criteria do not cover this case, and "Reset filters"
  would not help (it does not touch `showArchived`), so this is a low-severity wording/edge
  gap, not a regression. Suggested follow-up: word the state as "No active items" or add a
  hint when archived items exist.
- **Empty selected list (non-All) with items elsewhere.** PASS/reasonable. `listId` is an
  active filter → "No items match / Reset filters"; Reset reveals the items elsewhere.
- **Empty selected list with the whole DB empty.** PASS per criteria (listId is active) but
  shows "No items match" rather than the CTA; Reset then reveals "No items yet". One extra
  click; criteria-compliant.
- **Filter active but zero items overall.** PASS. Shows "No items match / Reset filters";
  Reset leads to the first-run CTA.
- **CTA by mouse, keyboard and focus.** PASS. Native `<button type="button">` (Button
  primitive); Enter activates when focused. Reachable via Tab with `:focus-visible` true and
  a visible accent ring (`box-shadow: … 0 0 0 2px, rgb(79,70,229) 0 0 0 4px`). No
  `focus-visible` styles are hardcoded; ring comes from the shared Button.

## Gates (all run)

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npm run format:check` ✓
- `npm run test` ✓ — 47 files / 535 tests. One run showed a single failure in the
  unrelated `src/features/noDataRows.test.tsx:103` ("2× per day" habit row); it passed in
  isolation and on an immediate full re-run. Pre-existing parallel-load flakiness in a
  habits test, not touched by this diff.
- `npm run build` ✓

## Browser verification

`npm run preview` on 4173. Service-worker registrations unregistered, caches and IndexedDB
deleted, then a real document load (`about:blank` → back). 1280×800 and 390×844, light and
dark.

- Fresh DB: "No items yet" + `Add item`; no "No items match"/"Reset filters".
- `Add item` by mouse → editor "Untitled"/Task. By keyboard (focus + Enter) → same.
- 390 light/dark and 1280 light render correctly; semantic tokens only, no hardcoded colors.
- 0 console errors.

Artifacts: `.improve/artifacts/verify-IMP-101-390-light.png`,
`verify-IMP-101-390-dark.png`, `verify-IMP-101-1280-light.png`.

Preview server stopped after the run.

## Notes

- CTA uses `variant="outline"`, matching the Goals/Habits first-run pattern
  (`GoalsView.tsx:74`, `HabitsView.tsx:90`); "primary action" here means the main action,
  which it is. Title "No items yet" matches the "No goals/habits/notes yet" convention.
- No source files were modified during verification.
