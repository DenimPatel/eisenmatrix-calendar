# Discovery 4 — Follow-up Harvest

Scope: harvest the worthwhile, still-unfixed follow-ups recorded in the last ~100
`.improve/reports/discovered-IMP-*.md` / `verify*-IMP-*.md` files, verify each against
HEAD, merge duplicates, and drop anything already fixed or already owned by `FEATURES.md`.
Read-only on `src`; this report is the only file written.

Baseline: `260551c` (`test(habits,today): wait out stale shared item snapshots`), clean tree.
Method: read `.improve/FEATURES.md` statuses first (open TODOs are only IMP-091/106/108/109;
NEEDS-HUMAN 034/047/048/067/095/127/128; BLOCKED 017), then read the follow-up reports and
the current source for every candidate. Every item below was re-confirmed in the code at HEAD
with a `file:line` anchor; none re-proposes a DONE item or an open TODO. Pure nits, stale
verification notes (service-worker reset, raw-IDB/liveQuery), and test-isolation footguns were
dropped.

---

### F1 — Make a toast's Undo revert the action it labels, not the newest entry

- **Source:** `.improve/reports/discovered-IMP-129.md`
- **Area / files:** `src/store/useUiStore.ts:160-167` (`undo` pops `undoStack[stack.length-1]`);
  `src/domain/itemActions.ts:30-39` (`toastWithUndo`), `:156`, `:174`
- **Evidence at HEAD:** `toastWithUndo` pushes a toast whose `onAction` calls the global
  `undo()`, which always pops the stack top. Delete A (its toast shows Undo) → any later
  undoable action B (an edit, a snooze — see F14) pushes a newer entry → clicking A's toast
  Undo reverts B, not A. `deleteItems` also labels/counts `items.length` (top-level only) at
  `:171`/`:174` while `deleted` includes every descendant collected at `:163-169`.
- **Intent:** the Undo affordance on a toast must be scoped to the action that showed it;
  today it can silently revert a different change, which is user-visible data loss.
- **Acceptance criteria:**
  1. The toast's Undo invokes the undo entry created by that same action (by entry id), not
     whatever is on top of the stack.
  2. Delete A, perform undoable action B, click A's toast Undo → B stays applied and A is
     restored.
  3. `deleteItems` reports the number of rows actually deleted (selection + descendants) or
     uses an unambiguous wording.
  4. `⌘Z` still pops the newest entry.
- **Verification method:** Extend `src/domain/itemActions.test.ts` / a `useUiStore` test:
  seed the stack, delete, push another entry, invoke the toast `onAction`, assert the correct
  row is restored and B survives. Run the four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/4/4 (score 12) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-129 replaced `window.prompt` with the app Dialog; the toast
  Undo target and the descendant count were never itemized.

### F2 — Emit an honest RRULE for a count-limited split tail (count 0 and count+until)

- **Source:** `.improve/reports/discovered-IMP-113.md` (D1, D2)
- **Area / files:** `src/lib/ics.ts:83-88`; `src/domain/recurrence.ts:440` (`tailCount` may be
  `0`), `:283-285` (engine treats `count: 0` as "no occurrences")
- **Evidence at HEAD:** `recurrenceToRRule` gates COUNT on `else if (rule.count)` — a truthy
  test — so a stored `count: 0` tail (produced by `splitSeries` when the head consumed the
  whole count, `recurrence.ts:425,440`) exports with neither COUNT nor UNTIL and reads back as
  an unbounded series. A tail carrying both `count` and `until` (reachable only from an
  imported row) emits UNTIL alone, over-expanding when the count is the binding bound.
- **Intent:** exporting a split series must reproduce the same occurrence set on import.
- **Acceptance criteria:**
  1. A rule with `count: 0` exports no RRULE (or a form that expands to nothing), never an
     unbounded one.
  2. When both `count` and `until` are present and count is the tighter bound, the export is
     bounded to the count.
  3. The head's until-only export and all existing `src/lib/ics.test.ts` assertions are
     unchanged.
- **Verification method:** Extend `src/lib/ics.test.ts` with a `count: 0` tail and a
  `count + until` rule; assert the exact RRULE line / that re-expansion yields the same keys.
  Run the four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/3/4 (score 12) **Effort:** S **Risk:** med
- **Depends on:** none
- **Not covered because:** IMP-112 fixed the head's COUNT+UNTIL combination and IMP-113 the
  recurrence-rule edit; neither covers the exported tail's count semantics.

### F3 — Render an absolute (snooze) reminder as a timestamp in the editor

- **Source:** `.improve/reports/discovered-IMP-056.md` (D1)
- **Area / files:** `src/features/item/ReminderEditor.tsx:69-75`; `src/domain/reminders.ts`
  (`formatReminderLabel`)
- **Evidence at HEAD:** every non-all-day row renders
  `Select value={String(reminder.offsetMinutes ?? -10)}`. A snooze/absolute row has no
  `offsetMinutes`, so it displays "10 min before" while the adjacent label shows the real
  timestamp — self-contradictory. Editing that row calls `update(id,{offsetMinutes})`,
  persisting a contradictory offset (inert because `reminderFireTime` returns `absolute`
  first) and on an all-day item stripping an offset via `:62-64`.
- **Intent:** an absolute reminder must not masquerade as a relative offset, and editing it
  must not mutate a field it does not have.
- **Acceptance criteria:**
  1. A row whose reminder has `absolute` renders a timestamp (read-only text or a datetime
     control), never the offset `Select`.
  2. Editing that row cannot add or remove `offsetMinutes`.
  3. Offset rows keep their current behaviour.
- **Verification method:** jsdom test in `ReminderEditor` with an `absolute` reminder: assert
  no offset `Select` is rendered and `onChange` payloads never contain `offsetMinutes`. Run
  the four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/3/4 (score 12) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-056 pruned expired snoozes; how the editor *renders* a live
  absolute reminder was explicitly out of scope.

### F4 — Do not write a phantom occurrence for a habit not scheduled today

- **Source:** `.improve/reports/discovered-IMP-126.md` (F3)
- **Area / files:** `src/domain/itemActions.ts:295-298` (`toggleHabitOccurrence`); callers
  `src/features/today/TodayView.tsx:256`, `src/features/habits/HabitsView.tsx:144`
- **Evidence at HEAD:** `expandOccurrences(habit, today, today)[0]` is `[]` for a habit whose
  recurrence does not land on today, so the `?? todayKey()` fallback at `:297` persists
  `occurrences[today]` for an unscheduled day (e.g. a Monday-only habit toggled on Sunday)
  with no visible effect and a misleading stored status.
- **Intent:** a status write must only target a day the habit actually occurs.
- **Acceptance criteria:**
  1. Toggling a habit not scheduled today writes no occurrence row and shows no completion.
  2. A scheduled habit toggles exactly its today occurrence.
  3. Existing habit streak/undo tests still pass.
- **Verification method:** Unit test in `src/domain/itemActions.test.ts`: a weekly habit
  anchored to a non-today weekday; assert `occurrences` is unchanged after
  `toggleHabitOccurrence`. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-126 added the Today completion entry point but did not gate it
  on a today occurrence existing.

### F5 — Validate `lists` (and reject junk rows) in `parseBackup`

- **Source:** `.improve/reports/discovered-IMP-038.md` §1, `.improve/reports/discovered-IMP-020.md` §2
- **Area / files:** `src/lib/backup.ts:67` (`lists`), `:80` (`lists as List[]`); caller
  `src/features/settings/SettingsView.tsx` `importJSON`
- **Evidence at HEAD:** items run through `validateItem` (`:71`), but `lists` is a bare cast
  (`:80`) written straight to Dexie via `listRepo.createMany`. A payload such as
  `{"app":"eisenmatrix","version":2,"items":[],"lists":[null,42,"nope"]}` passes the
  identity/version/no-items guards and persists junk list rows the UI assumes are well-formed.
- **Intent:** a hostile or corrupt backup must not persist rows that break list rendering.
- **Acceptance criteria:**
  1. Non-object / id-less `lists` entries are dropped and counted as invalid.
  2. A valid `lists` array still imports unchanged.
  3. Existing backup round-trip tests pass.
- **Verification method:** Extend `src/lib/backup.test.ts` with
  `lists: [null, 42, 'nope', validList]`; assert only `validList` survives. Run the four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/2/4 (score 8) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-038 scoped shape validation to items; IMP-072 added the
  identity/no-items guard but left `lists` unvalidated.

### F6 — Give archived items an in-app restore path

- **Source:** `.improve/reports/discovered-IMP-055.md` §2
- **Area / files:** `src/domain/itemActions.ts:182-185` (`restoreItem`);
  `src/features/list/ListView.tsx:47` (`showArchived` filter), `:246-249`
- **Evidence at HEAD:** `restoreItem` has no non-test caller (grep finds only its definition).
  ListView can *list* archived items via the `showArchived` toggle, but no control un-archives
  them, so archive is one-way in-app — the only recovery is restoring a backup.
- **Intent:** archive must be reversible from the UI, like every other soft state.
- **Acceptance criteria:**
  1. An archived item listed in ListView offers a Restore action.
  2. Restoring clears `archivedAt` and removes it from the archived view.
  3. `restoreItem` keeps its history/undo behaviour.
- **Verification method:** Playwright: archive an item, enable Archived, Restore, assert it
  returns to the active list. Run the four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/2/4 (score 8) **Effort:** M **Risk:** low
- **Depends on:** none
- **Not covered because:** no item covers archive reversibility; IMP-055 was
  occurrence-scoped delete.

### F7 — Reap reminder failure rows when their item is deleted or archived

- **Source:** `.improve/reports/discovered-IMP-086.md` (D3)
- **Area / files:** `src/db/repository.ts:252-292` (`reminderFailureRepo`: only
  `clear(itemId,dedupeKey)`, `clearAll`, `pruneBefore`), `:107-108` (`removeMany`),
  `:126-155` (`removeWithChildren` / `setArchived`); consumer `src/pwa/ReminderRuntime.tsx:76-91`
- **Evidence at HEAD:** failure rows are removed only on successful delivery, "Clear all
  data", or the 30-day prune. Deleting or archiving an item leaves its rows, and
  `undeliveredCount` still counts them, so the "N reminders passed their time undelivered"
  toast can report reminders whose item no longer exists.
- **Intent:** the undelivered count must reflect reminders that still exist.
- **Acceptance criteria:**
  1. Deleting an item (single or bulk) removes its failure rows.
  2. Archiving an item removes or excludes them from the count.
  3. The pending count never includes rows for a missing item.
- **Verification method:** Repository test: record a failure for an item, `removeWithChildren`
  it, assert `reminderFailureRepo.count() === 0`. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/4 (score 8) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-086 introduced the failure rows; lifecycle cleanup on
  delete/archive was out of scope.

### F8 — Report a Dexie `blocked` upgrade as a storage failure

- **Source:** `.improve/reports/discovered-IMP-039.md` §1
- **Area / files:** `src/db/repository.ts:8-10` (`ensureDbOpen`), `src/db/schema.ts:45-79`
  (no `on('blocked')`); caller `src/App.tsx:103`
- **Evidence at HEAD:** `ensureDbOpen` only `await getDb().open()`. When another tab blocks a
  version upgrade Dexie emits `blocked` and the open promise stays **pending**, so the
  `App.tsx:103` catch never fires: the app renders fallback data with no storage warning until
  the blocking tab closes.
- **Intent:** a blocked upgrade is a storage failure the user should see (same class IMP-039
  already handles for a rejected open).
- **Acceptance criteria:**
  1. A `blocked` event surfaces the same storage-unavailable report/toast as a rejected open.
  2. It fires once, not per event.
  3. The DB layer stays UI-free (callback/return value, no toast import in `src/db/`).
- **Verification method:** Unit test stubbing the Dexie instance to emit `blocked`; assert the
  report callback is invoked exactly once. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/2/4 (score 8) **Effort:** M **Risk:** med
- **Depends on:** none
- **Not covered because:** IMP-039 handled a rejected `open()`; the pending `blocked` path was
  explicitly recorded as still open.

### F9 — Catch the Settings backup-count read rejection

- **Source:** `.improve/reports/discovered-IMP-039.md` §2
- **Area / files:** `src/features/settings/SettingsView.tsx:84-87`
- **Evidence at HEAD:** `void backupRepo.all().then((rows) => setBackupCount(rows.length))` has
  no `.catch`; on blocked/failed IndexedDB the promise rejects unhandled on the Settings route
  (the boot already reports storage once, but this rejection escapes).
- **Intent:** storage reads off the boot path must settle quietly like the others IMP-039/042/117
  already fixed.
- **Acceptance criteria:**
  1. The read is wrapped so a rejection does not escape.
  2. The backup count simply stays unchanged on failure.
  3. No duplicate error toast appears.
- **Verification method:** `SettingsView.test.tsx` mocking `backupRepo.all` to reject; assert no
  unhandled rejection and the view still renders. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/2/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-039/042/117 covered the boot and reminder paths; this Settings
  read was listed as a residual.

### F10 — Use the occurrence title in Bills "upcoming" and the drag overlay

- **Source:** `.improve/reports/discovered-IMP-085.md` (verifier findings)
- **Area / files:** `src/features/bills/BillsView.tsx:146`; `src/features/shell/AppShell.tsx:257`;
  `Occurrence.title` exists (added by IMP-085)
- **Evidence at HEAD:** the Bills upcoming row renders `{bill.title || bill.data.payee || 'Bill'}`
  and the `DragOverlay` renders `{activeDrag.item.title}`. An occurrence retitled via
  "This occurrence" is now persisted as `overrides[key].title` and rendered by cards/calendar,
  but these two paths still show the series title.
- **Intent:** every surface that renders an occurrence should show its resolved title.
- **Acceptance criteria:**
  1. Bills upcoming shows the occurrence's resolved title.
  2. The drag overlay shows the resolved occurrence title when an occurrence is dragged.
  3. Non-overridden items are unchanged.
- **Verification method:** Playwright: retitle one occurrence, check the Bills upcoming row and
  the drag overlay. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-085 scoped the visible fix to cards/calendar and left the
  Bills/drag-overlay paths as recorded follow-ups.

### F11 — Reconcile the default recurrence when the quick-add kind changes

- **Source:** `.improve/reports/discovered-IMP-054.md` (D1)
- **Area / files:** `src/features/quickadd/QuickAdd.tsx:44-51`; `src/domain/quickadd.ts`
  (habit default daily)
- **Evidence at HEAD:** `commit` replaces `item.kind`/`item.data` on a kind override but keeps
  `item.recurrence` from `quickAddToItem(parsed)`. `habit: meditate` switched to task keeps a
  daily recurrence; a task switched to habit keeps `recurrence === null` (no series, no streak).
- **Intent:** the committed item's recurrence must match the kind the user actually chose.
- **Acceptance criteria:**
  1. Switching away from habit removes the habit-defaulted daily rule (unless explicitly parsed).
  2. Switching to habit yields the daily default.
  3. An explicitly parsed rule is preserved for any kind.
- **Verification method:** Unit test on the commit logic or an extracted helper. Run the four
  gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/4 (score 8) **Effort:** M **Risk:** med
- **Depends on:** none
- **Not covered because:** IMP-054 preserved parsed *data* on a kind change but did not
  reconcile the recurrence.

### F12 — Show an honest empty state in the archived Lists view

- **Source:** `.improve/reports/discovered-IMP-101.md`
- **Area / files:** `src/features/list/ListView.tsx:135-139` (`hasActiveFilter` omits
  `showArchived`), `:423-458` (empty states), `:47`
- **Evidence at HEAD:** with `showArchived` on and no archived items, `filtered.length === 0`
  and `hasActiveFilter` is false, so the view shows "No items yet / Add your first task…" even
  though the database has active items and the user is explicitly filtering for archived ones.
- **Intent:** the empty state should describe the active archived filter, not a first run.
- **Acceptance criteria:**
  1. With Archived on and zero archived items the copy references archived items.
  2. With Archived off the first-run CTA is unchanged.
  3. Any CTA still performs the correct action.
- **Verification method:** Playwright: with no archived items, enable Archived and assert the
  empty-state text. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/2/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-101 scoped the first-run CTA only; the archived-only branch was
  logged as a follow-up.

### F13 — Make multi-count habits honest (target.count > 1 never completes)

- **Source:** `.improve/reports/discovered-IMP-126.md` (F2)
- **Area / files:** `src/features/today/TodayView.tsx:247-250`;
  `src/features/habits/HabitsView.tsx:137`; `src/domain/recurrence.ts` (one occurrence/day)
- **Evidence at HEAD:** `doneToday` is `doneCount >= Math.max(1, habit.data.target.count)`. A
  habit's recurrence expands at most one occurrence per day, so `doneCount` can never reach 2+.
  A 3×/day habit never shows complete, and a second click toggles the single occurrence back off.
- **Intent:** a completion gate the data model can never satisfy is a dead affordance that
  misleads users.
- **Acceptance criteria:**
  1. Either per-day progress is representable so the gate can be met, or the control reflects a
     single-occurrence completion.
  2. A `count: 3` habit can be marked complete for the day.
  3. Streak behaviour is unchanged.
- **Verification method:** Unit/Playwright with a `count: 3` habit; assert completion is
  reachable. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/2/4 (score 8) **Effort:** M **Risk:** med
- **Depends on:** none
- **Not covered because:** IMP-126 added the Today toggle but not multi-count semantics; no
  item covers `target.count > 1`.

### F14 — Stop a notification snooze from pushing an undo entry

- **Source:** `.improve/reports/discovered-IMP-056.md` (D3)
- **Area / files:** `src/pwa/ReminderRuntime.tsx:196-200`; `src/domain/itemActions.ts:123-127`;
  `src/store/useUiStore.ts:155-158`
- **Evidence at HEAD:** the snooze handler calls
  `patchItem(..., { silent: true, trackHistory: false })` without `trackUndo: false`, so
  `patchItem` pushes `Change "<title>"` (`itemActions.ts:123-127`). The stack is capped at 25
  (`useUiStore.ts:157`, `slice(-24)`), so a run of snoozes evicts the user's own edits from `⌘Z`.
- **Intent:** a system notification action must not displace user undo history.
- **Acceptance criteria:**
  1. Snoozing pushes no undo entry.
  2. `⌘Z` after snoozes still reverts the user's last edit.
  3. The snooze reminder is still persisted.
- **Verification method:** Unit test: exercise the snooze path (or `patchItem` with the same
  options) and assert the undo-stack depth is unchanged. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/2/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-056 was the prune pass; the snooze write's undo side effect was
  noted but never itemized.

### F15 — Add a rejection handler to `sendSkipWaiting`

- **Source:** `.improve/reports/discovered-IMP-118.md` §2
- **Area / files:** `src/pwa/notifications.ts:60-65`
- **Evidence at HEAD:** `void navigator.serviceWorker.getRegistration().then(...)` has no
  `.catch`; a rejected `getRegistration()` (corrupt registration / storage failure) becomes an
  unhandled rejection on the SW-update path — the same class IMP-117 fixed for the delivery tick.
- **Intent:** no user-triggered path should leak an unhandled rejection.
- **Acceptance criteria:**
  1. A rejected `getRegistration` settles without an unhandled rejection.
  2. `SKIP_WAITING` is still posted when a waiting worker exists.
  3. The failure is routed through the existing failure helper (or deliberately ignored with a
     trace), never a silent unhandled rejection.
- **Verification method:** Unit test with a stubbed `navigator.serviceWorker.getRegistration`
  that rejects; assert no unhandled rejection and no throw. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/2/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-118 tested the notification/SW boundary but explicitly recorded
  this call as untested and unfixed.

---

## Summary

| # | Title | Sev | I/R/C | Score | Effort |
|---|-------|-----|-------|-------|--------|
| F1 | Toast Undo targets the newest entry, not its action | S2 | 3/4/4 | 12 | S |
| F2 | Honest RRULE for count-0 / count+until split tails | S2 | 3/3/4 | 12 | S |
| F3 | Absolute (snooze) reminder rendered as a relative offset | S2 | 3/3/4 | 12 | S |
| F4 | Phantom occurrence for a habit not scheduled today | S3 | 2/3/5 | 10 | S |
| F5 | `lists` unvalidated in `parseBackup` | S2 | 3/2/4 | 8 | S |
| F6 | No in-app restore for archived items | S2 | 3/2/4 | 8 | M |
| F7 | Failure rows not reaped on item delete/archive | S3 | 2/3/4 | 8 | S |
| F8 | Dexie `blocked` upgrade reports nothing | S3 | 2/2/4 | 8 | M |
| F9 | Uncaught Settings backup-count read | S3 | 2/2/5 | 10 | S |
| F10 | Bills upcoming + drag overlay use the series title | S3 | 2/3/5 | 10 | S |
| F11 | Kind change does not reconcile the default recurrence | S3 | 2/3/4 | 8 | M |
| F12 | Archived-only Lists shows "No items yet" | S3 | 2/2/5 | 10 | S |
| F13 | `target.count > 1` habits can never complete | S3 | 2/2/4 | 8 | M |
| F14 | Snooze pushes an undo entry that evicts user edits | S3 | 2/2/5 | 10 | S |
| F15 | `sendSkipWaiting` has no rejection handler | S3 | 2/2/5 | 10 | S |

No S0/S1 defects found. The strongest, most objectively verifiable are **F1** (wrong-action
undo, reproducible with a stack fixture), **F2** (falsy `count` test at `ics.ts:86`) and **F3**
(a live absolute reminder rendered through the offset `Select`). Dropped as already fixed:
occurrence title in reminder notifications (`ReminderRuntime.tsx:119`), ICS CR escaping /
multi-day DTEND, `parseBackup` no-items guard, `rerunMigration` catch, `parentId` duplicate
remap, scroll-lock refcount, mobile nav strip, GoalsView progress track.
