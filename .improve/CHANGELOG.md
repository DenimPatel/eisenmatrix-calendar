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
- 2026-10-17 · IMP-063 · Main pushes gate once and superseded runs cancel, without cancelling the deploy caller · 765d09d · files: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- 2026-10-17 · IMP-064 · Formatting drift is now caught in CI and source is clean · 5feff5d · files: `.prettierignore`, `.github/workflows/ci.yml`, `package.json`, five formatted sources
- 2026-10-17 · IMP-065 · Browser verification docs now include the preview SW reset and focus-trap event target · 72094b6 · files: `agents.md`
- 2026-10-17 · IMP-062 · Pasted CRLF notes no longer store trailing carriage returns · 692dc5f · files: `src/domain/quickadd.ts`
- 2026-10-17 · IMP-066 · Remaining data hooks have dep-aware tests and no per-render fallback serialization · d18883e · files: `src/hooks/useData.ts`, `src/hooks/useData.test.tsx`
- 2026-10-17 · IMP-077 · Editing an occurrence shows and saves that occurrence date, without leaking into series edits · e9807ef · files: `src/features/item/ItemEditorSheet.tsx`
- 2026-10-17 · IMP-078 · Today lists a daily habit once, in the Habits panel, with matching agenda counts · 628f42c · files: `src/features/today/TodayView.tsx`
- 2026-10-17 · IMP-081 · Third-party GitHub Actions are pinned to reviewed commit SHAs · 0a185e4 · files: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- 2026-10-17 · IMP-079 · One Escape now closes only the topmost overlay and focus returns to the survivor · e9fc259 · files: `src/store/useUiStore.ts`, `src/hooks/useOverlayLayer.ts`, `src/components/ui/Dialog.tsx`, `src/components/ui/Sheet.tsx`
- 2026-10-17 · IMP-080 · Failed migration reruns now report an error and preserve the prior marker · b9934d5 · files: `src/features/settings/SettingsView.tsx`
- 2026-10-17 · IMP-035 · Concurrent theme and Settings writes no longer lose each others keys · 8605686 · files: `src/db/repository.ts`, `src/hooks/useTheme.ts`, `src/features/settings/SettingsView.tsx`
- 2026-10-17 · IMP-060 · One shared items subscription replaces twelve per-component live queries · fbcd4fd · files: `src/hooks/useData.ts`
- 2026-10-17 · IMP-087 · Undoing an editor-created parent now removes its new subtasks too · 3001432 · files: `src/domain/itemActions.ts`
- 2026-10-17 · IMP-083 · Boot migrations are asserted by the smoke test and CI runs the suite twice · 2b3b358 · files: `src/App.tsx`, `src/test/app.smoke.test.tsx`, `.github/workflows/ci.yml`
- 2026-10-17 · IMP-089 · Concurrent occurrence status writes can no longer lose a key · be7edc1 · files: `src/db/repository.ts`, `src/domain/itemActions.ts`
- 2026-10-18 · IMP-038 · Imported JSON/CSV items are shape-validated and coerced; invalid entries counted instead of crashing
- 2026-10-18 · IMP-036 · Reminder delivery log has unique [itemId+occKey] index with atomic record and tick guard, preventing duplicate notifications
- 2026-10-18 · IMP-090 · Habits/goals with partial nested target/metric payloads now render and compute stats without throwing
- 2026-10-18 · IMP-043 · no-explicit-any lint rule is enforced with a regression test
- 2026-10-18 · IMP-037 · Editing 'This and future' leaves past occurrences untouched and the split is undoable in one step
- 2026-10-18 · IMP-082 · 'This and future' no longer creates a phantom zero-occurrence series or inverted range
- 2026-10-18 · IMP-093 · Schedule edits survive switching edit scope to 'This and future'
- 2026-10-18 · IMP-084 · Duplicate-import children with fresh ids attach to the duplicated parent
- 2026-10-18 · IMP-085 · A 'This occurrence' retitle now shows on that occurrence in cards, Today and Calendar
- 2026-10-18 · IMP-086 · Undelivered reminders are recorded and surfaced once instead of dropped silently; digest no longer rebuilt each tick; notifications show retitled occurrence
- 2026-10-18 · IMP-094 · Closing a top overlay no longer unlocks scroll behind a remaining modal
- 2026-10-18 · IMP-092 · Blocked storage no longer produces unhandled prune rejections every tick
- 2026-10-18 · IMP-096 · Habit status and streak persist in one transaction; concurrent toggles stay consistent
- 2026-10-18 · IMP-097 · Concurrent occurrence skip/edit no longer drop sibling edits
- 2026-10-18 · IMP-046 · Agent guide is tracked as AGENTS.md and README links to it
- 2026-10-18 · IMP-110 · Reminders set 'N before' crossing midnight now fire at their true time
- 2026-10-18 · IMP-111 · Malformed imported recurrence rules are coerced or rejected instead of throwing or expanding wrongly
- 2026-10-18 · IMP-113 · Editing recurrence with 'This and future' now persists; ICS RRULE no longer emits both COUNT and UNTIL
- 2026-10-18 · IMP-114 · ICS export handles CRLF notes and inverted ranges; delivery tick tolerates blocked storage
- 2026-10-18 · IMP-116 · Recurring events keep their wall-clock end across DST transitions
- 2026-10-18 · IMP-099 · Habit heatmap grid is visible in light mode
- 2026-10-18 · IMP-098 · Lists status pill and date no longer wrap; Goals progress track visible in light mode
- 2026-10-18 · IMP-101 · Empty Lists shows 'No items yet' with an Add item button instead of 'No items match'
- 2026-10-18 · IMP-126 · Habits can be completed and undone directly from Today
- 2026-10-18 · IMP-121 · All form controls have programmatic labels; regression test added
- 2026-10-18 · IMP-122 · ProgressRing exposes progressbar semantics; Tabs follow WAI-ARIA with arrow-key navigation; weekday toggles expose pressed state
- 2026-10-18 · IMP-124 · Habit heatmap has a legend and per-day text; skip-to-content link and main landmark added
- 2026-10-18 · IMP-105 · Header CTAs stay on one line at 390px, digest time input no longer clips, boot failure names the local database
- 2026-10-18 · IMP-100 · Completion toggle and calendar day-add now have 44px hit areas; other tiny controls clear 24px
- 2026-10-18 · IMP-102 · What's next now prefers timed actionable items; truncated Today sections expose +N more
- 2026-10-18 · IMP-129 · New shopping list uses the app dialog; bulk delete/clear purchased undo is covered by tests
- 2026-10-18 · IMP-131 · Year view expands 3.3x faster; editor no longer recomputes analytics per keystroke
- 2026-10-18 · IMP-133 · Views load as separate precached chunks (entry 394->342 kB) with retry on chunk failure
- 2026-10-18 · IMP-134 · New Help dialog reachable from header, palette, shortcut sheet and Settings
- 2026-10-18 · IMP-118 · Coverage added for notification registration, reminder helpers and weekday labels
- 2026-10-18 · IMP-135 · Removed a 1-in-5 flaky test caused by partial liveQuery renders
- 2026-10-18 · IMP-040 · Editing a single non-recurring item's time/notes via occurrence path now persists
