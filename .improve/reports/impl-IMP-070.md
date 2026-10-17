# IMP-070 — implementation report

## Status
Done. All four acceptance criteria met; no migration added.

## Files changed
- `src/domain/itemFactory.ts` — `createItem` now resolves `recurrence` from
  `options.recurrence ?? defaultRecurrenceFor(options.kind)`. The helper returns a daily
  `interval: 1` rule only for `habit`; every other kind stays `null`. `CreateItemOptions`
  gained an optional `recurrence` field so a caller-supplied rule always wins.
- `src/domain/itemFactory.test.ts` (new) — unit tests for the habit default, the
  seven-day expansion, explicit-rule precedence, a no-default control across all other
  kinds, and `normalizeItem` preserving `recurrence: null` on legacy habits.
- `src/features/habits/HabitsView.test.tsx` — regression test that clicks the real
  "New habit" button, inspects the editor draft, and asserts its occurrences fill the
  next 7 days.

## Approach
The defect was the single hardcoded `recurrence: null` in `createItem`. Fixing it at the
factory covers both `HabitsView` buttons and the editor, while leaving the quick-add
default in `quickAddToItem` untouched (its output is unchanged). `normalizeItem`
continues to force `partial.recurrence ?? null`, so stored single-occurrence habits are
not rewritten on load/import — behavior covered by a regression test. No schema,
migration, route, or public URL changes.

## Commands / results
```
npm run typecheck   PASS
npm run lint        PASS
npm run test        PASS — 33 files / 337 tests
```

## Uncertainty
None material. Browser-level Playwright was not run in this pass; the equivalent
user-visible behavior (New habit button → daily rule → 7 expanded occurrences) is covered
by the jsdom HabitsView regression test instead.
