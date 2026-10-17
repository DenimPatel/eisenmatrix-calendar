# Changelog

Historical per-item entries before 2026-10-17 live in `PROGRESS.log` and the commit history;
this file is appended per dimension from the resumed session onward.

## Bugs/Correctness

- 2026-10-17 · IMP-069 · Undo now reverses an item created in the editor, not just edits · 8c5ffab · files: `src/domain/itemActions.ts`, `src/domain/itemActions.test.ts`
- 2026-10-17 · IMP-070 · Habits created from the Habits view or editor now repeat daily by default · ecf419f · files: `src/domain/itemFactory.ts`, `src/domain/itemFactory.test.ts`, `src/features/habits/HabitsView.test.tsx`
- 2026-10-17 · IMP-054 · Switching quick-add kind keeps compatible parsed fields and restores them on round-trip · 1158feb · files: `src/domain/quickadd.ts`, `src/features/quickadd/QuickAdd.tsx`
- 2026-10-17 · IMP-071 · Items with missing or null `data` now open with kind defaults instead of crashing the editor or ICS export · d6f3590 · files: `src/domain/itemFactory.ts`, `src/features/item/KindFields.tsx`, `src/lib/ics.ts`
- 2026-10-17 · IMP-072 · Wrong-file imports now fail loudly, and blank-title CSV rows are skipped instead of created · ad61d18 · files: `src/lib/backup.ts`, `src/lib/csv.ts`, `src/features/settings/SettingsView.tsx`
- 2026-10-17 · IMP-073 · Quick add now consumes schedule tokens without eating ordinary words, and keeps times/relative dates after a weekday · ee267d6 · files: `src/domain/quickadd.ts`, `src/domain/quickadd.test.ts`
- 2026-10-17 · IMP-074 · Timed ICS exports now emit a floating `UNTIL` matching the floating `DTSTART`, ending the UTC-day shift · 2acc3af · files: `src/lib/ics.ts`, `src/lib/ics.test.ts`
- 2026-10-17 · IMP-075 · Multi-day all-day items now export an exclusive `DTEND`, so importers keep every day · 5bc7bf1 · files: `src/lib/ics.ts`, `src/lib/ics.test.ts`
- 2026-10-17 · IMP-076 · Occurrence status writes now merge into the persisted map, so one toggle cannot drop a sibling · 8b46ffa · files: `src/domain/itemActions.ts`, `src/domain/itemActions.test.ts`

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
- 2026-10-17 · IMP-025 · itemActions write paths now have direct create/edit/undo/occurrence tests · f27dff6 · files: `src/domain/itemActions.test.ts`
- 2026-10-17 · IMP-027 · Sheet and Dialog now announce a real accessible name and description · aeea3e3 · files: `src/components/ui/Sheet.tsx`, `src/components/ui/Dialog.tsx`
- 2026-10-17 · IMP-031 · CSV rows with mid-field quotes now parse literally instead of swallowing the rest of the row · 2e455ce · files: `src/lib/csv.ts`
- 2026-10-17 · IMP-029 · Node 20 is now declared in engines and pinned in .nvmrc, matching CI · 9647e37 · files: `package.json`, `.nvmrc`
- 2026-10-17 · IMP-088 · Items with missing data open with kind defaults in every view; repository reads normalize without rewriting rows · e1ea1ff · files: `src/db/repository.ts`, `src/domain/stats.ts`
- 2026-10-17 · IMP-033 · Toggles announce pressed state and List headers expose sort direction; mobile header row still hidden · 8a164e1 · files: `src/features/list/ListView.tsx`, `src/features/settings/SettingsView.tsx`, `src/features/notes/NotesView.tsx`, `src/features/bills/BillsView.tsx`, `src/features/habits/HabitsView.tsx`
- 2026-10-17 · IMP-032 · Editing a bill amount no longer retroactively changes the monthly Paid total · c52c7b8 · files: `src/domain/bills.ts`, `src/features/bills/BillsView.tsx`
- 2026-10-17 · IMP-026 · Eisenhower quadrant mapping and priority scoring now have direct tests · 3afe7fb · files: `src/domain/eisenhower.test.ts`
- 2026-10-17 · IMP-061 · Empty bulk deletes no longer replace the previous undo step or report a phantom deletion · ce661e3 · files: `src/domain/itemActions.ts`
- 2026-10-17 · IMP-039 · Render and boot/storage failures show a recoverable message instead of a blank page · f916b43 · files: `src/components/ui/ErrorBoundary.tsx`, `src/lib/bootFailure.ts`, `src/main.tsx`, `src/App.tsx`
