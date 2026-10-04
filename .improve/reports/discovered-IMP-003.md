# discovered-IMP-003 — out-of-scope findings

Findings noticed while implementing IMP-003; not fixed here to stay in scope.

- `deleteItems` (bulk delete, `src/domain/itemActions.ts:120`) still calls
  `itemRepo.removeMany` with no descendant cascade, and its undo restores only the selected
  items. Deleting a goal via bulk selection leaves dangling milestones. This is exactly
  IMP-004; the new `itemRepo.collectDescendants` helper added here can be reused for it.
- `pushToast`'s `setTimeout` dismissal keeps a live timer after actions under test; harmless
  in Vitest but worth faking timers in a shared test helper when more itemActions tests land
  (IMP-025 notes this too).

No regressions observed; baseline gates remain green (typecheck/lint/59 tests).
