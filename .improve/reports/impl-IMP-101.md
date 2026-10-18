# impl-IMP-101 — First-run create CTA in the Lists empty state

- **Item:** IMP-101 (UX / onboarding, bug-fix, S / low risk)
- **Status:** DONE
- **Date:** 2026-10-18

## Change

`src/features/list/ListView.tsx` rendered one `filtered.length === 0` branch:
"No items match / Reset filters", even on a zero-data first run where Reset does
nothing.

Added a `hasActiveFilter` guard (search, kinds, statuses, listId, tags) and split the
empty state into two branches:

```tsx
const hasActiveFilter =
  filters.search.trim() !== '' ||
  filters.kinds.length > 0 ||
  filters.statuses.length > 0 ||
  filters.listId !== null ||
  filters.tags.length > 0;
```

- **No active filter** → first-run `EmptyState` (`ListTodo` icon): title "No items yet",
  description "Add your first task, event or note to get started.", primary action
  `+ Add item` which calls `openEditor(createItem({ kind: 'task', start: formatISODate(new Date()) }))`.
- **Active filter** → unchanged "No items match / Reset filters".

The header `Add` button now reuses the shared `createFirstItem` helper. Reuses
`components/ui/EmptyState` and semantic tokens only (`text-fg`, `text-muted`,
`border-border`, `bg-elevated`); no hardcoded colors.

## Test

`src/features/list/ListView.test.tsx` — new `ListView empty states` suite:

1. Zero data, no filter: asserts "No items yet" renders, "No items match" / "Reset
   filters" do not, and clicking `Add item` opens the editor with a `task`.
2. One item + active search filter: asserts "No items match" / "Reset filters" render,
   "No items yet" does not, and Reset clears `filters.search` and reveals the row.

`beforeEach` now also resets `filters` and `editor` in the UI store. Extracted a
`waitFor`/`waitForText` helper.

## Verification (Playwright, `npm run preview` on 4173, 1280×800 and 390×844)

SW registrations unregistered, caches and IndexedDB cleared, then a real document load.
Fresh DB asserted the create CTA; clicking `Add item` opened the editor (`Task`,
"Untitled"). Seeded one task and typed a non-matching search to reach the filtered-empty
state. Both states rendered correctly at 1280 and 390, light and dark.

Screenshots (all 8 inspected):

- `.improve/artifacts/IMP-101/light-1280-first-run.png`
- `.improve/artifacts/IMP-101/dark-1280-first-run.png`
- `.improve/artifacts/IMP-101/light-390-first-run.png`
- `.improve/artifacts/IMP-101/dark-390-first-run.png`
- `.improve/artifacts/IMP-101/light-1280-filtered-empty.png`
- `.improve/artifacts/IMP-101/dark-1280-filtered-empty.png`
- `.improve/artifacts/IMP-101/light-390-filtered-empty.png`
- `.improve/artifacts/IMP-101/dark-390-filtered-empty.png`

Preview server stopped after the run.

## Gates

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` ✓ (47 files, 535 tests) ·
`npm run format:check` ✓ · `npm run build` ✓

No commit, push, or out-of-scope changes.
