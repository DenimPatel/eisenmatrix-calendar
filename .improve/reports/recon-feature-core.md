# Recon — Core Planning Features

Area: `src/features/{today,calendar,matrix,item,quickadd,command,shell}` +
`src/domain/{recurrence,reminders,quickadd,eisenhower,itemActions,itemFactory,stats}.ts` +
`src/hooks/{useOccurrences,useData}.ts` + `src/lib/date.ts`.
Read-only reconnaissance. No code changed.

---

1. **HIGH — Editing "This occurrence" corrupts the whole series.**
   `ItemEditorSheet.handleSave` (`src/features/item/ItemEditorSheet.tsx:82-105`) passes the
   full `patch` (including base `start`, `end`, `allDay`, `data`, `reminders`) to
   `updateRecurring`; the `occurrence` branch writes `overrides[occKey]` *and* calls
   `patchItem(item.id, { ...patch, recurrence })` (`src/domain/itemActions.ts:231-245`),
   re-anchoring the base series. Because the sheet clones the *base* item, `draft.start` is
   the series start, not the occurrence. Fix: for `occurrence` scope write only the override
   (start/title/notes/status) and never the base item; load the occurrence override into the draft.

2. **HIGH — "This and future" applies edits to past occurrences and loses undo.**
   `updateRecurring` `future` branch (`src/domain/itemActions.ts:252-264`) spreads `patch`
   into the tail but writes `head` from the already-patched `draft`, so past occurrences are
   edited too; it also never pushes undo, and `splitSeries` copies the original `count` onto
   both halves (`src/domain/recurrence.ts:294-307`). Fix: persist an unpatched head, adjust
   `count` for each half, and push an undo entry.

3. **HIGH — Habit "best streak" is wrong across missed periods.**
   `habitStreak` builds `keys` only from `doneByPeriod` (`src/domain/stats.ts:81-93`), so a
   period with zero completions is absent and `run` is never reset (done Jan 1 + Jan 3
   reports best 2). Current streak walks periods correctly; only `best` is broken. Fix:
   iterate every period in the tracked range and reset on incomplete/missing periods.

4. **HIGH — Item cards show the base start time, not the occurrence time.**
   `ItemCard` computes `time = formatTime(item.start)` (`src/features/item/ItemCard.tsx:48`)
   while the caller already has the resolved occurrence (`TodayView.tsx:162-170`,
   `CalendarView.tsx:262-269`). Moved/overridden occurrences display the wrong time.
   Fix: pass/derive `occurrence.start` into `ItemCard`.

5. **HIGH — Calendar ignores the `weekStartsOn` setting.**
   `CalendarView` uses `startOfWeek(currentDate, 1)`/`endOfWeek(..., 1)` and a hardcoded
   Mon–Sun header (`src/features/calendar/CalendarView.tsx:47-59,161`) while `RecurrenceEditor`
   honours `settings.weekStartsOn` (`ItemEditorSheet.tsx:455`). Fix: thread the setting in.

6. **HIGH — Undo of a deleted parent does not restore its children.**
   `deleteItem` calls `itemRepo.removeWithChildren` but pushes an undo that recreates only the
   parent (`src/domain/itemActions.ts:106-112`; repo `src/db/repository.ts:58-64`). Fix:
   capture and restore descendants in the undo closure.

7. **HIGH — `useItems` returns a fresh array every render, thrashing memoised consumers.**
   `const list = items ?? []; return ...list.filter(...)` (`src/hooks/useData.ts:5-9`) changes
   identity each render, so `useOccurrences` memo (`src/hooks/useOccurrences.ts:8-18`) and the
   `ReminderRuntime` effect keyed on `items` (`src/pwa/ReminderRuntime.tsx:167`) re-run on
   every render, resetting the 60s interval and re-expanding every item. Fix: `useMemo` the filter.

8. **HIGH — History bloat from occurrence toggles.**
   `buildHistory` stringifies object values (`src/domain/itemActions.ts:28-50`) and
   `setStatus` patches the entire `occurrences` map with history tracking on
   (`itemActions.ts:132-159`), so every completion stores a growing JSON blob. Fix: skip
   `occurrences`/`recurrence` in history or store diffs.

9. **MED — No error handling on save/delete flows.**
   `handleSave`/`handleDelete` await domain actions with no try/catch
   (`src/features/item/ItemEditorSheet.tsx:82-110`); a Dexie rejection leaves the sheet open
   with no feedback. Fix: wrap in try/catch and toast errors.

10. **MED — Quick-add silently drops "on the 5th" when not monthly.**
    `monthDayMatch` is always stripped from the title but only applied when
    `recurrence.freq === 'monthly'` (`src/domain/quickadd.ts:210-215`), so
    "party on the 5th" loses text and defaults to today. Fix: set the date to the next 5th
    even without recurrence, or don't strip.

11. **MED — Single weekday ("gym fri") is never parsed.**
    Weekday list is discarded unless >1 weekday or the input contains "every"
    (`src/domain/quickadd.ts:198-207`), so "fri" stays in the title. Fix: treat a lone
    weekday as the next occurrence of that day.

12. **MED — Quick-added habits aren't recurring.**
    `quickAddToItem` never sets `recurrence` for `habit` (`src/domain/quickadd.ts:345-384`)
    and habits are only "recurring kinds" by fiat (`src/domain/itemFactory.ts:83-85`); a
    quick-added habit exists on one day only, so streaks/done-today are wrong. Fix: default
    habits to daily.

13. **MED — Overdue window is capped at 45 days with no indication.**
    `TodayView` queries `addDays(todayStart,-45)` (`src/features/today/TodayView.tsx:57-59`);
    older overdue items silently vanish. Fix: surface a count/link for older items or
    lengthen the window.

14. **MED — Global shortcuts fire while dialogs/sheets are open.**
    `useKeyboardShortcuts` only guards typing targets (`src/hooks/useKeyboardShortcuts.ts:23-70`);
    pressing `1–9`, `n`, `c` while a Sheet has focus on a non-input navigates/opens behind it.
    Fix: bail out when `commandOpen/quickAddOpen/editor.open/shortcutsOpen`.

15. **MED — Drag-and-drop has no keyboard path.**
    Quadrant/day drops are plain divs (`src/features/matrix/MatrixView.tsx:57-104`,
    `# CalendarView` day cells) and `ItemCard` uses `useDraggable` without a SortableContext,
    so `KeyboardSensor`/`sortableKeyboardCoordinates` (`src/features/shell/AppShell.tsx:48-51`)
    can't move items. Fix: add droppable focus/keyboard handlers or a non-DnD priority control.

16. **MED — Truncated day/month lists are not expandable.**
    Month cells cap at 3 with a non-interactive "+N more" (`CalendarView.tsx:224-228`) and
    year cards cap at 5 (`CalendarView.tsx:342-344`). Fix: make the overflow clickable to open
    the day/agenda.

17. **MED — Command palette does not scroll the active row into view.**
    Arrow navigation updates `active` but never scrolls `listRef` (declared and unused at
    `src/features/command/CommandPalette.tsx:30,114-139`). Fix: `scrollIntoView({block:'nearest'})`.

18. **MED — Duplicate "Series split" toast.**
    `ItemEditorSheet.handleSave` pushes it (`ItemEditorSheet.tsx:97-100`) and
    `updateRecurring` pushes it again (`itemActions.ts:263`). Fix: keep one.

19. **MED — ReminderEditor cannot represent absolute/snoozed reminders.**
    Only `timeOfDay`/`offsetMinutes` are editable (`src/features/item/ReminderEditor.tsx:53-74`);
    a snoozed reminder (`absolute`, created at `ReminderRuntime.tsx:141-153`) renders with a
    default offset and is clobbered on edit. Fix: render absolute reminders read-only/with a
    dedicated control.

20. **MED — Habit streak write bypasses undo/history and uses stale data.**
    `toggleDone` re-reads nothing and writes `{ data: {...item.data, streak} }` from the stale
    prop via `itemRepo.update` (`src/domain/itemActions.ts:166-181`); concurrent toggles can
    compute a stale streak and the change isn't undoable. Fix: re-read the item after
    `setStatus` and route through `patchItem`.

21. **MED — `deleteItems` orphans children.**
    Bulk delete uses `removeMany` (`src/domain/itemActions.ts:114-120`), unlike `deleteItem`'s
    `removeWithChildren`. Fix: reuse the descendant-aware delete.

22. **MED — `splitSeries` keeps `count` on both halves.**
    `src/domain/recurrence.ts:294-307` copies the original `count` into head and tail, so the
    tail can generate more occurrences than remain. Fix: subtract the consumed count.

23. **MED — Deleting an item has no confirmation.**
    The destructive Delete is a single click (`ItemEditorSheet.tsx:107-110,151-153`). Fix: add
    a confirm dialog (recoverable only via undo).

24. **MED — Quick-add kind override discards parsed data.**
    Changing kind replaces `item.data` with `defaultDataFor` (`src/features/quickadd/QuickAdd.tsx:48-51`),
    losing parsed `amount`/`quantity`. Fix: carry over the compatible parsed fields.

25. **MED — Editor analytics recompute on every keystroke.**
    `useMemo(...,[draft])` expands 120 days of occurrences each time `draft` changes
    (`ItemEditorSheet.tsx:55-63`). Fix: key on the schedule-relevant fields only.

26. **MED — Legacy/edge recurrence helpers are untested and can throw.**
    No tests for `splitSeries`, `updateRecurring`, `nextOccurrence`, `isItemActiveOnDate`, or
    `stats.ts`; `splitSeries` uses `parseLocalDate(fromKey)!` (`recurrence.ts:293`) and
    `habitStreak` uses `parseLocalDate(item.start)!` (`stats.ts:47`), which throw on a malformed
    start. Fix: add tests and null-guard.

27. **LOW — Dead exports.**
    `withTime`/`setTimeOnDateString`/`stripTime` (`src/lib/date.ts:130-141`);
    `occurrenceKeyForDate`/`withOccurrenceState` (`src/domain/recurrence.ts:265-283`);
    `chipId`/`isValidParsedDate` (`src/domain/quickadd.ts:388-394`);
    `isScheduledKind`/`isRecurringKind` (`src/domain/itemFactory.ts:79-85`);
    `ITEM_KINDS`/`ITEM_STATUSES` (`src/types/item.ts:151-161`);
    `completionStats`/`activeDayStreak`/`overallCompletion`
    (`src/domain/stats.ts:19-23,127-148`); `priorityBadgeClasses`/`ITEM_KIND_PLURAL`
    (`src/lib/labels.ts`). Fix: remove or wire up.

28. **LOW — Dead code in editor.**
    `draft.kind === 'goal' ? 'task' : 'task'` (`src/features/item/ItemEditorSheet.tsx:128`);
    `editor.splitMode` is stored but never read (`src/store/useUiStore.ts:24,83,94-97`). Fix: delete.

29. **LOW — "Bills due soon" mislabelled window.**
    `weekAhead` spans today → today+8 days (`TodayView.tsx:60`) but the section says "this week"
    (`TodayView.tsx:222`). Fix: label or narrow the window.

30. **LOW — Year view does 12 full expansions per render.**
    Each `YearMonthCard` calls `useOccurrences` over all items
    (`src/features/calendar/CalendarView.tsx:310-323`), multiplied by the array-identity
    churn in finding 7. Fix: compute once for the year and bucket by month.

31. **LOW — `firstDayOfISOWeek` is only tested for week 1.**
    Documented "best effort" (`src/lib/date.ts:156-161`); boundary weeks 52/53 and
    `weekStartsOn=0` are unverified. Fix: add round-trip tests using `getISOWeek`.

32. **LOW — Inconsistent `endOfMonth`/`endOfYear` comparison in recurrence.**
    `until` is compared with `endOfDay` (`src/domain/recurrence.ts:221-228`), so a datetime
    `until` includes later occurrences on the same day. Fix: compare by date key or respect
    the time component.

33. **LOW — Recurrence `count` includes skipped exceptions.**
    `generated++` happens before the exception check (`src/domain/recurrence.ts:229-235`), so
    EXDATE occurrences still consume `count` (differs from RFC 5545). Fix: increment after the
    exception filter.

34. **LOW — Reminder editor leaves stale fields when `allDay` toggles.**
    Switching to all-day keeps `offsetMinutes` and vice-versa (`ReminderEditor.tsx:55-74`);
    `add` picks a default but existing reminders are not migrated. Fix: normalise reminder
    fields on toggle.

35. **LOW — Quick-add direct repository write.**
    `QuickAdd.tsx:59-75` creates lists via `listRepo.create` outside a domain action, so list
    creation isn't undoable/toasted. Fix: add a list action or accept as intentional.

---

## Coverage notes

- Tested: `recurrence`, `reminders`, `quickadd` parsers, `date`, plus db/lib tests.
- Untested in this area: `stats.ts` (streak bug), `eisenhower.ts`, `itemActions.ts`,
  `itemFactory` (beyond use), `useOccurrences`, and all feature components (Today, Calendar,
  Matrix, Item editor, QuickAdd, Command palette, shell/DnD).
- Most complete: `domain/recurrence.ts` (broad, pure, well-tested), `TodayView`,
  `ItemEditorSheet` (feature-rich but with the per-occurrence bug), `ItemCard`.
- Most neglected: `stats.ts` correctness, keyboard DnD in Matrix/Calendar, the recurring
  edit scopes, and error/empty-state handling in the shell.
