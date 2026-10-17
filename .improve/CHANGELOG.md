# Changelog

Historical per-item entries before 2026-10-17 live in `PROGRESS.log` and the commit history;
this file is appended per dimension from the resumed session onward.

## Bugs/Correctness

- 2026-10-17 · IMP-069 · Undo now reverses an item created in the editor, not just edits · 8c5ffab · files: `src/domain/itemActions.ts`, `src/domain/itemActions.test.ts`
- 2026-10-17 · IMP-070 · Habits created from the Habits view or editor now repeat daily by default · ecf419f · files: `src/domain/itemFactory.ts`, `src/domain/itemFactory.test.ts`, `src/features/habits/HabitsView.test.tsx`
- 2026-10-17 · IMP-054 · Switching quick-add kind keeps compatible parsed fields and restores them on round-trip · 1158feb · files: `src/domain/quickadd.ts`, `src/features/quickadd/QuickAdd.tsx`
- 2026-10-17 · IMP-071 · Items with missing or null `data` now open with kind defaults instead of crashing the editor or ICS export · d6f3590 · files: `src/domain/itemFactory.ts`, `src/features/item/KindFields.tsx`, `src/lib/ics.ts`
- 2026-10-17 · IMP-072 · Wrong-file imports now fail loudly, and blank-title CSV rows are skipped instead of created · SHA pending · files: `src/lib/backup.ts`, `src/lib/csv.ts`, `src/features/settings/SettingsView.tsx`

## Accessibility

- 2026-10-17 · IMP-059 · Overlays focus their first control in the mount commit, so the first keystroke cannot land outside the dialog · 612bc4b · files: `src/hooks/useFocusTrap.ts`, `src/hooks/useFocusTrap.test.tsx`

## UX/Interaction

## Visual

## Delivery

## Performance

## Format/Structure

## Docs/Onboarding

## Tests/Tooling

## Content
