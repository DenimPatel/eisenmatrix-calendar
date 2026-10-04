# Recon — Tracking & Organization Features

Area: `src/features/{goals,habits,bills,shopping,notes,list,settings}` plus supporting
`domain/stats.ts`, `domain/itemActions.ts`, `lib/csv.ts`, `lib/backup.ts`, `lib/ics.ts`,
`lib/labels.ts`, `db/migrations/legacyTasks.ts`.

Each finding: severity, evidence (path:line), one-line suggested fix.

---

1. **HIGH — "This occurrence" edits leak to the whole recurring series.**
   `src/domain/itemActions.ts:231-244` (`updateRecurring` scope `occurrence`) writes
   `patchItem(item.id, { ...patch, recurrence })`, where `patch` (from
   `src/features/item/ItemEditorSheet.tsx:84-96`) carries `status`, `urgency`,
   `importance`, `tags`, `allDay`, `start`, `end`, `reminders`, `data`. Only
   start/title/notes go into the override, so every other field mutates the base item,
   changing all occurrences. Fix: build an explicit base patch `{ recurrence }` only and
   keep per-occurrence fields in `overrides[occKey]`.

2. **HIGH — Habit "best streak" ignores missed periods.**
   `src/domain/stats.ts:82-92`: `doneByPeriod` only has a key when a period has ≥1
   completed occurrence (`stats.ts:52-56`), so a fully-missed week/day is absent and the
   forward scan never resets `run`. A habit done in Jan, skipped all of Feb, done in Mar
   reports best=2. Fix: walk every consecutive period between first and last key and call
   `complete()` on each; reset on incomplete.

3. **HIGH — Note quick-add truncates long first lines and loses text.**
   `src/features/notes/NotesView.tsx:30-33`: `title: firstLine.slice(0, 80)` and
   `notes: restLines.join('\n')` — characters beyond 80 on a single-line note are dropped
   entirely. Fix: keep the full first line as the title, or spill the overflow into
   `notes`.

4. **MED — Bulk delete orphans child items.**
   `src/domain/itemActions.ts:114-120` (`deleteItems`) calls `itemRepo.removeMany` →
   `src/db/repository.ts:54-56`, which does not cascade, unlike `deleteItem`
   (`itemActions.ts:106-107` → `repository.ts:58-64`). Deleting a goal/task with
   milestones via ListView (`ListView.tsx:92-95`) leaves dangling children. Fix: cascade
   or reparent children in `deleteItems`.

5. **MED — CSV import has no error handling.**
   `src/features/settings/SettingsView.tsx:114-124` (`importCSV`) lacks the try/catch that
   `importJSON` has (`SettingsView.tsx:95-111`); a malformed file throws an unhandled
   rejection and no feedback. Fix: wrap in try/catch and toast the error.

6. **MED — Dead / misleading settings.**
   `defaultView` (`src/types/settings.ts:15,24`) is never read anywhere; it has no UI.
   `notificationsEnabled` (`settings.ts:14`) is written (`SettingsView.tsx:150`) but never
   read; `ReminderRuntime.tsx:67-85` delivers regardless of it (only
   `notifications.ts:30` checks the browser permission). Fix: wire both to real behavior
   or remove.

7. **MED — Goal progress has no inline editing.**
   `src/features/goals/GoalsView.tsx:149-156` renders a numeric bar but no control to
   increment `metric.current`; binary goals can only be completed via the editor; goals
   have no archive/delete in the view. Fix: add +/- / "mark done" / menu actions.

8. **MED — Checklist goal progress counts unrelated children.**
   `src/features/goals/GoalsView.tsx:29-38` groups *all* items sharing `parentId` by kind
   agnostic, and `src/domain/stats.ts:113-115` counts any child with
   `status === 'done' || completedAt`. A child of another kind inflates milestones.
   Fix: filter children by intended kind or persist milestones explicitly.

9. **MED — Bill payments bypass occurrence status, so paid bills read as incomplete.**
   `src/features/bills/BillsView.tsx:22-32` stores paid state in `data.payments`, while
   stats/digest/agenda use occurrence status
   (`src/domain/stats.ts:145-148`, `src/pwa/ReminderRuntime.tsx:99-107`,
   `src/features/today/TodayView.tsx:18-20`). Bills therefore never count as completed.
   Fix: set the occurrence `status:'done'` when marking paid (or exclude bills from
   completion metrics).

10. **MED — Monthly paid total recomputes from current amount.**
    `src/features/bills/BillsView.tsx:50-52` sums `bill.data.amount`, not
    `payments[occKey].amount`, so editing a bill's amount retroactively changes the "Paid"
    figure. Fix: sum the recorded payment amounts.

11. **MED — Deleting a single occurrence deletes the whole series.**
    `src/features/item/ItemEditorSheet.tsx:107-110` always calls `deleteItem`; there is no
    scope handling, and `skipOccurrence` (`src/domain/itemActions.ts:209-218`) is never
    wired to any UI. Fix: make Delete scope-aware and expose "Skip this occurrence".

12. **MED — Duplicate import breaks parent links.**
    `src/lib/backup.ts:84-86` gives duplicated items a new id but leaves `parentId`
    pointing at the old id; `SettingsView.tsx:98-104` also bulk-puts lists regardless of
    strategy. Orphaned milestones / dangling listIds. Fix: remap `parentId` for duplicated
    items and apply the conflict strategy to lists.

13. **MED — CSV round-trip loses list identity and can import invalid kinds.**
    `src/lib/csv.ts:82-113` exports no lists; only `listId` survives, so names are lost and
    ids dangle. `csvToItems` does not validate `kind`/`status`; an unknown kind makes
    `KIND_META[item.kind]` undefined in `src/features/item/ItemCard.tsx:47` and can crash
    rendering. Fix: include lists (or a list-name column) and validate/coerce kind with a
    fallback.

14. **LOW — Unused/dead code.**
    `src/domain/stats.ts:127-148` (`activeDayStreak`, `overallCompletion`);
    `src/domain/itemFactory.ts:79-85` (`isScheduledKind`, `isRecurringKind`);
    `src/hooks/useData.ts:11-14` (`useArchivedItems`);
    `src/domain/recurrence.ts:242-283` (`isItemActiveOnDate`, `nextOccurrence`,
    `occurrenceKeyForDate`, `withOccurrenceState`). Fix: remove or wire into UI.

15. **LOW — Habit streak label hardcodes "day" and stored streak is stale.**
    `src/features/habits/HabitsView.tsx:125-128` and `src/features/today/TodayView.tsx:209`
    always say "day streak" even for weekly/monthly habits; `data.streak` is only rewritten
    on toggle (`src/domain/itemActions.ts:166-181`) while views recompute live, so the
    persisted value drifts. Fix: label by `target.per` and drop or derive the stored
    streak.

16. **LOW — Shopping UX gaps.**
    `src/features/shopping/ShoppingView.tsx:94-110` uses a blocking `window.prompt`; rows
    (`ShoppingView.tsx:172-201`) have no delete button and no quantity +/- controls.
    Fix: use the Dialog/Sheet primitives, add delete and stepper controls.

17. **LOW — Shopping math treats quantity 0 as 1.**
    `src/features/shopping/ShoppingView.tsx:43-46` uses `data.quantity || 1`, so an
    explicit 0 still contributes `estPrice`; header counts use `.length` including
    purchased. Fix: use `?? 1` and consistent counts.

18. **LOW — "Reset all data" leaves snapshots and settings behind, and snapshots are
    unmanageable.** `src/features/settings/SettingsView.tsx:137-141` clears items/lists/
    reminderLog but not `backups` or `settings`; `createSnapshot`
    (`SettingsView.tsx:85-90`) stores full backups with no list/restore/delete UI. Fix:
    clear or clearly scope backups, and add snapshot management.

19. **LOW — Re-running legacy migration silently overwrites later edits.**
    `src/db/migrations/legacyTasks.ts:243-245` `bulkPut`s legacy items with their original
    ids, discarding any changes made since the first import; `rerunMigration`
    (`SettingsView.tsx:126-135`) does not warn. Fix: warn or merge by `updatedAt`.

20. **LOW — ICS fidelity issues.**
    `src/lib/ics.ts:65-68` collapses an all-day reminder's `timeOfDay` to `PT0M`
    (midnight), losing the intended time; `itemsToICS` (`ics.ts:79-117`) does not fold
    long lines per RFC 5545 and emits floating (no TZID/Z) times for timed items.
    Fix: emit the actual alarm date-time and fold lines.

21. **LOW — Accessibility gaps.**
    Theme segmented control (`SettingsView.tsx:159-175`), pin toggle (`NotesView.tsx:126-136`),
    bill paid toggle (`BillsView.tsx:121-133`) and habit mark-today button
    (`HabitsView.tsx:97-109`) lack `aria-pressed`/`radiogroup`; sortable headers lack
    `aria-sort` (`ListView.tsx:277-298`), and the "List" column header is the only
    unsortable one. Fix: add the appropriate ARIA state.

22. **LOW — ListView selection survives filter changes.**
    `src/features/list/ListView.tsx:30,80-95`: bulk actions operate on `selectedItems`
    drawn from all items, so changing filters can act on hidden items. Fix: clear the
    selection when filters change and act on `filtered`.

23. **LOW — ListView "Date" uses series start, not the next occurrence.**
    `src/features/list/ListView.tsx:54,354` sorts/prints raw `item.start`, which is the
    series anchor and can be in the past for recurring items. Fix: resolve the next
    occurrence for display/sort.

24. **LOW — Shopping default list selection.**
    `src/features/shopping/ShoppingView.tsx:60-85`: when `activeListId === 'all'`,
    `addItem` always targets `shoppingLists[0]`, and `ensureDefaultList` uses a possibly
    stale `lists.length` for `order`. Fix: target the active/inbox list deliberately and
    compute order from the live list.

25. **LOW — Exports include archived items and non-calendar kinds.**
    `SettingsView.tsx:63-83` passes `items` from `useItems(true)` (archived included) to
    CSV/ICS; `src/lib/ics.ts:88-89` skips only notes/shopping, so habits/goals/bills are
    emitted as VEVENTs. Fix: offer an export scope and filter kinds for ICS.

26. **LOW — Redundant/dead expressions.**
    `src/features/item/ItemEditorSheet.tsx:128` `draft.kind === 'goal' ? 'task' : 'task'`
    is always `'task'`; `src/features/bills/BillsView.tsx:54` wraps `markBillPaid` in a
    no-op `markPaid` indirection. Fix: simplify.

---

## Completeness summary

- **Most complete:** Settings (import/export/migration flows, tests), ListView (filters,
  sort, bulk bar, DnD targets), Legacy migration (idempotent, backed up, tested),
  CSV/backup/ICS libraries (unit-tested round-trips).
- **Least complete:** Goals (display-only numeric progress, no inline editing or
  lifecycle actions), Notes (no search/sort/filter, destructive truncation, no delete in
  view), Shopping (no per-row delete, prompt-based list creation), Bills (payment state
  decoupled from occurrence status/analytics).
- **Suspected correctness bugs (highest confidence):** `updateRecurring` occurrence scope
  leaking edits series-wide (itemActions.ts:231-244); `habitStreak` best-streak gap
  over-count (stats.ts:82-92); note first-line truncation data loss
  (NotesView.tsx:30-33); `deleteItems` orphaned children (itemActions.ts:114-120).
