# FEATURES.md — Prioritized Improvement Backlog

Repo: `eisenmatrix-calendar` · Baseline SHA: `b9d23246b948187c0239e8c95373e3e1f27cc43f`
Generated: 2026-10-04 · Reviewed 2026-10-04 (backlog critic) against the recon reports and the actual source.

This backlog is ordered by **priority score descending** (ties broken by impact, then lower effort).
Every item is independently verifiable and cites real files. `Depends on` is respected: an item's
dependencies appear earlier in the file. Items needing human judgment/design/legal input are marked
**Status: NEEDS-HUMAN** and placed at their score position. There are **3 NEEDS-HUMAN items**
(IMP-034, IMP-047, IMP-048); no other item depends on them.

## Legend

- **Score** = impact (1–5) × confidence (1–5) ÷ effort (S=1, M=2, L=3).
- **Type** ∈ new-feature | feature-improvement | improvement | bug-fix | docs | test | tooling.
- **Effort** ∈ S | M | L. **Risk** ∈ low | med | high.
- **Verification**: run `npm run typecheck && npm run lint && npm run test && npm run build` for every
  code change; Playwright steps use `npm run preview` → `http://localhost:4173/eisenmatrix-calendar/`.
- **Status** is TODO unless marked NEEDS-HUMAN.

---

### IMP-001 — Fix habit best streak across missed periods
- **Status:** DONE
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/stats.ts` (`habitStreak`, `:81-93`)
- **Intent:** `best` is computed only from `doneByPeriod` keys, so fully-missed periods are absent and the run never resets; a habit done in Jan and Mar with nothing in Feb reports best=2. Users see inflated "best streak" and lose trust in habit analytics.
- **Acceptance criteria:**
  1. `habitStreak` computes `best` by iterating every consecutive period (day/week/month per `target.per`) between the earliest and latest tracked period, resetting `run` on any period that is absent or below `target.count`.
  2. A habit completed in Jan, missed all of Feb, and completed in Mar reports `best === 1` (not 2).
  3. Two consecutive completed periods still report the correct consecutive run (no regression).
  4. `current` streak behavior for an in-progress current period is unchanged.
- **Verification method:** Add `src/domain/stats.test.ts` with pure item fixtures; assert `habitStreak` for the Jan/Feb/Mar scenario and an adjacent-completion scenario. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** DONE. best now iterates consecutive periods and resets on missed/below-count. Added src/domain/stats.test.ts. Verified PASS (typecheck/lint/54 tests). Commit 2c19bf8+. IMP-006 adds non-streak stats cases; keep cases non-overlapping.

### IMP-002 — Delete deep descendants, not just direct children
- **Status:** DONE
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/db/repository.ts` (`itemRepo.removeWithChildren`, `:58-64`)
- **Intent:** `removeWithChildren` filters only `i.parentId === id` once, so nested subtasks/milestones of a grandchild are orphaned and keep rendering with no parent. Deleting a task whose subtasks themselves have children leaves dangling rows.
- **Acceptance criteria:**
  1. `removeWithChildren(id)` deletes the item and **all** transitive descendants (BFS/queue), not only immediate children.
  2. Grandchildren and deeper levels are removed for a 3-level fixture.
  3. Items sharing an unrelated `parentId` are untouched.
  4. The operation remains inside a single read-write transaction.
- **Verification method:** Extend `src/db/repository.test.ts` (fake-indexeddb) with a parent→child→grandchild fixture; call `removeWithChildren(parent)` and assert only unrelated items remain. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** DONE (attempt 2). `collectDescendantIds` BFS with visited set; cycle/self-parent safe. Reused by IMP-003/IMP-004. Verified PASS (typecheck/lint/57 tests).

### IMP-003 — Undo of a deleted parent must restore its descendants
- **Status:** DONE
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`deleteItem`, `:106-112`); `src/db/repository.ts`
- **Intent:** The undo closure recreates only the parent, so after undo the deleted subtasks are permanently lost even though the parent reappears. This makes undo partially destructive.
- **Acceptance criteria:**
  1. Before deletion, `deleteItem` captures the full descendant set (same walker as IMP-002).
  2. The pushed undo closure recreates the parent **and** every captured descendant via `createMany`.
  3. After delete → undo, the item count and parent/child relationships match the pre-delete state exactly.
- **Verification method:** Add `src/domain/itemActions.test.ts` (fake-indexeddb) seeding parent+child+grandchild; call `deleteItem`, invoke the pushed undo closure from `useUiStore`, assert all three exist. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-002
- **Priority score:** 20
- **Notes:** DONE. Captures descendant items pre-delete and restores parent+descendants via createMany. Added itemActions.test.ts. Verified PASS (typecheck/lint/59 tests).

### IMP-004 — Cascade delete in bulk `deleteItems`
- **Status:** DONE
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`deleteItems`, `:114-120`); `src/db/repository.ts` (`removeMany`, `:54-56`); `src/features/list/ListView.tsx`
- **Intent:** Bulk delete from ListView uses `removeMany`, which does not cascade, unlike single `deleteItem`. Deleting a goal via bulk selection leaves dangling milestones.
- **Acceptance criteria:**
  1. `deleteItems` deletes each selected item and all its transitive descendants.
  2. The undo closure restores every deleted item (selection + descendants).
  3. Non-selected sibling items are untouched.
- **Verification method:** Add a test in `src/domain/itemActions.test.ts` selecting a parent in a multi-item set; assert descendants removed and restored on undo. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-002
- **Priority score:** 20
- **Notes:** DONE. `deleteItems` collects descendants per selected item via `itemRepo.collectDescendants`, dedupes against the selection, deletes the union with one `removeMany`; undo restores selection + descendants. Verified PASS (typecheck/lint/build/62 tests).

### IMP-005 — Add a CI quality gate (typecheck + lint + test) and enforce `npm ci`
- **Status:** TODO
- **Category:** CI / automation
- **Type:** tooling
- **Area / files:** `.github/workflows/deploy.yml` (`:3-6,26-30`); new `.github/workflows/ci.yml`
- **Intent:** CI only runs `npm run build` on push to `main` and has no `pull_request` trigger, so lint/test failures can merge and deploy; the documented "all gates pass" invariant is enforced nowhere. It also runs `npm install`, which can drift from the committed lockfile.
- **Acceptance criteria:**
  1. A workflow triggers on `pull_request` and on push to `main`.
  2. It runs, in order, `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, all required to succeed, using `actions/setup-node` pinned to Node 20 with npm cache enabled.
  3. `deploy.yml` installs with `npm ci`, and its deploy job cannot run when the gate fails (add a gate job with `deploy needs: [build, gate]`, or an equivalent required check).
  4. No workflow uses `npm install`.
- **Verification method:** `npm ci --dry-run` exits 0; `npx prettier --check .github/workflows/ci.yml .github/workflows/deploy.yml`; grep the workflows to confirm the `pull_request` trigger, each command step, `npm ci`, and the absence of `npm install`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20
- **Notes:** Push is disabled in this run; land the workflow without pushing. This item subsumes the former standalone `npm ci` item. Node pin aligns with IMP-029 (IMP-029 appears later; no dependency needed).

### IMP-006 — Add unit tests for `stats.ts` goal progress and completion
- **Status:** TODO
- **Category:** test coverage
- **Type:** test
- **Area / files:** new `src/domain/stats.test.ts`; target `src/domain/stats.ts`
- **Intent:** `goalProgress`, `completionStats`, and `itemCompletionStats` drive Goals/Today and the editor analytics but are untested. (`habitStreak` is covered by IMP-001.)
- **Acceptance criteria:**
  1. Tests cover `goalProgress` for `numeric`, `binary`, and `checklist` metric types, including the `checklist` `target = children.length || 1` case.
  2. Tests cover `completionStats` rate rounding and the zero-total case.
  3. Tests cover `itemCompletionStats` over a bounded window.
  4. All new tests pass via `npm run test`.
- **Verification method:** `npm run test` reports the new file and all assertions green.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20
- **Notes:** IMP-001 also adds cases to this file; keep the two sets non-overlapping.

### IMP-049 — Make the calendar honor the `weekStartsOn` setting
- **Status:** TODO
- **Category:** correctness / configuration
- **Type:** bug-fix
- **Area / files:** `src/features/calendar/CalendarView.tsx` (interval `:41-61`, weekday header `:161`)
- **Intent:** `CalendarView` hardcodes Monday (`startOfWeek(currentDate, 1)`, Mon–Sun header) while `weekStartsOn` is user-configurable and already honored by `RecurrenceEditor`. A Sunday-start user sees a misaligned calendar.
- **Acceptance criteria:**
  1. `CalendarView` reads `weekStartsOn` from `useSetting<AppSettings>('app', DEFAULT_SETTINGS)` and uses it for the week and month interval start/end.
  2. The weekday header order is derived from `weekStartsOn` (0 → Sun…Sat, 1 → Mon…Sun).
  3. With `weekStartsOn=0` the first day cell of the first week row is a Sunday; with `1` it is a Monday.
  4. Default (Monday) behavior is unchanged.
- **Verification method:** Playwright at preview: set Settings → "Week starts on" = Sunday, open Calendar week and month, assert the first header cell is "Sun" and the first date cell is a Sunday; repeat with Monday. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20
- **Notes:** Prefer a pure `weekdayLabels(weekStartsOn)` helper that can be unit-tested without mounting.

### IMP-007 — Stop note quick-add truncating long first lines
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/features/notes/NotesView.tsx` (`addNote`, `:27-35`)
- **Intent:** `firstLine.slice(0, 80)` silently drops everything after character 80 of a single-line note, causing permanent data loss with no warning. Long notes must never lose text.
- **Acceptance criteria:**
  1. A single-line note longer than 80 characters is stored in full (full title or split so no characters are dropped).
  2. Multi-line notes still map the first line to `title` and remaining lines to `notes`.
  3. Creating a note with a 200-character single line and re-reading it from Dexie returns all characters across `title` + `notes`.
- **Verification method:** Extract the split into a pure helper and unit-test it on a 200-char string asserting `title + notes` preserves every character; or Playwright: paste a 200-char note, add, open editor, assert full text. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:**

### IMP-008 — Memoize `useItems` to stop array-identity churn
- **Status:** TODO
- **Category:** performance
- **Type:** improvement
- **Area / files:** `src/hooks/useData.ts` (`useItems`, `:5-9`); consumers `src/hooks/useOccurrences.ts`, `src/pwa/ReminderRuntime.tsx` (`:167`)
- **Intent:** `useItems` returns `list.filter(...)`, a fresh array every render. `useOccurrences`'s `useMemo` and `ReminderRuntime`'s effect depend on `items`, so they re-expand occurrences and reset the 60s interval on every render.
- **Acceptance criteria:**
  1. `useItems()` returns a referentially stable array when underlying data and `includeArchived` are unchanged (wrap filter in `useMemo`).
  2. `useArchivedItems` is memoized consistently.
  3. Archived filtering behavior is unchanged.
- **Verification method:** Add `src/hooks/useData.test.tsx` (renderHook with fixed live-query data) asserting stable array identity across re-renders. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Also reduces year-view recomputation in `CalendarView`.

### IMP-009 — Focus the primary input in overlays, not the Close button
- **Status:** TODO
- **Category:** accessibility
- **Type:** improvement
- **Area / files:** `src/components/ui/Sheet.tsx`, `src/components/ui/Dialog.tsx`, `src/hooks/useFocusTrap.ts` (`:14-24`); overlays `src/features/quickadd/QuickAdd.tsx`, `src/features/command/CommandPalette.tsx`, `src/features/item/ItemEditorSheet.tsx`
- **Intent:** `useFocusTrap.focusFirst` selects the first focusable element, the "Close" button, so keyboard users must Shift+Tab backwards to type. Overlays should focus their primary input.
- **Acceptance criteria:**
  1. QuickAdd focuses its textbox on open.
  2. CommandPalette focuses its combobox/input on open.
  3. ItemEditorSheet focuses the Title input on open.
  4. Escape/Tab trapping still works; focus returns to the opener on close.
- **Verification method:** Playwright: open each overlay via `c`, `⌘K`, and clicking an item; assert `document.activeElement` is the expected input (not a Close button) at desktop and 390px.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Add an `initialFocusRef`/selector option to the trap rather than reordering DOM.

### IMP-010 — Parse a lone weekday in quick add ("gym fri")
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/quickadd.ts` (`:191-207`)
- **Intent:** A single weekday is discarded unless the input also says "every", so "gym fri" keeps "fri" in the title and schedules today. Users expect the next Friday.
- **Acceptance criteria:**
  1. A lone weekday token is consumed from the title and sets `dateKey` to the next occurrence of that weekday (same convention as `nextWeekday`, which does not count today).
  2. Two or more weekdays still produce a weekly recurrence with `byWeekday`.
  3. The title no longer contains the weekday token.
- **Verification method:** Extend `src/domain/quickadd.test.ts` with `"gym fri"`, `"call mon"`, and a multi-weekday case; assert `title`, `start`, `recurrence`. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Reuse `nextWeekday` used for "next <weekday>".

### IMP-011 — Keep "on the 5th" when not monthly (or don't strip it)
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/quickadd.ts` (`monthDayMatch`, `:209-215`)
- **Intent:** `on the 5th` is always stripped from the title but only applied when recurrence is monthly, so "party on the 5th" loses text and defaults to today.
- **Acceptance criteria:**
  1. If the month day is parsed and no recurrence is present, the item's `start` is the next date whose day-of-month equals that number.
  2. If recurrence is monthly, `byMonthDay` is set.
  3. The token is removed from the title only when it was actually applied.
- **Verification method:** Extend `src/domain/quickadd.test.ts` with `"party on the 5th"` (no recurrence) and `"pay rent every month on the 5th"`; assert the next-5th date and the monthly rule. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:**

### IMP-012 — Show the occurrence time on item cards, not the series start
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/features/item/ItemCard.tsx` (`:48`); callers `src/features/today/TodayView.tsx`, `src/features/calendar/CalendarView.tsx`
- **Intent:** `ItemCard` prints `formatTime(item.start)` (series anchor) while callers already hold the resolved occurrence. Moved/overridden occurrences display the wrong time.
- **Acceptance criteria:**
  1. `ItemCard` renders the time from the resolved occurrence start when supplied; falls back to `item.start` otherwise.
  2. A recurring item moved via `updateOccurrence` shows the moved time on Today and Calendar.
  3. No visual regression for non-recurring items.
- **Verification method:** Unit-assert the derived time string (extract a pure helper) and Playwright: create a weekly item, override one occurrence's time, confirm the card shows the overridden time. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Prefer a `start?: string` prop over prop-drilling the whole occurrence.

### IMP-013 — Suppress global shortcuts while overlays are open
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/hooks/useKeyboardShortcuts.ts` (`:23-70`); `src/store/useUiStore.ts`
- **Intent:** The handler only bails on typing targets, so pressing `1–9`, `n`, or `c` while a Sheet has focus on a non-input navigates or opens another overlay behind it.
- **Acceptance criteria:**
  1. When any of `editor.open`, `quickAddOpen`, `commandOpen`, `shortcutsOpen` is true, navigation/create/theme shortcuts do not fire.
  2. `⌘/Ctrl+Z` undo still works from within an open overlay when the event target is not a typing field.
  3. The shortcut sheet still opens with `?` when no overlay is open.
- **Verification method:** Playwright: open the editor, press `1`–`9`/`n`/`c`, assert the route and overlay state are unchanged and no new overlay opens; press `⌘+Z` and assert undo runs. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Expose an `isOverlayOpen` selector from the UI store.

### IMP-014 — Emit RFC-5545-valid `UNTIL` for all-day (DATE) recurrence
- **Status:** TODO
- **Category:** correctness / interoperability
- **Type:** bug-fix
- **Area / files:** `src/lib/ics.ts` (`recurrenceToRRule`, `:44-48`)
- **Intent:** `UNTIL` is always emitted as `YYYYMMDDT235959Z` while all-day events use `DTSTART;VALUE=DATE`. RFC 5545 requires `UNTIL` to match the `DTSTART` value type, and tagging local fields `Z` can shift the day; importers may reject or misread it.
- **Acceptance criteria:**
  1. For an all-day/date-only start, `UNTIL` is emitted as a bare `YYYYMMDD` matching `DTSTART`.
  2. For timed events, `UNTIL` remains a UTC date-time.
  3. Existing output for rules without `until` is unchanged.
- **Verification method:** Extend `src/lib/ics.test.ts` with all-day and timed rules having `until`; assert the exact `RRULE` line. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** May require passing the `DTSTART` value type into `recurrenceToRRule`.

### IMP-015 — Handle CSV import errors and surface feedback
- **Status:** TODO
- **Category:** error handling
- **Type:** bug-fix
- **Area / files:** `src/features/settings/SettingsView.tsx` (`importCSV`, `:114-124`)
- **Intent:** `importCSV` lacks the try/catch `importJSON` has, so a malformed file or Dexie rejection becomes an unhandled rejection with no user feedback.
- **Acceptance criteria:**
  1. `importCSV` wraps parse + persist in try/catch and pushes an error toast on failure, mirroring `importJSON`.
  2. On failure no success toast appears.
  3. On success the existing report/toast still appears.
- **Verification method:** Playwright: import a malformed `.csv` (binary/empty) and assert an error toast appears and no uncaught rejection is logged. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:**

### IMP-050 — Habit completion must record undo/history and use fresh state
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`toggleDone`, `:161-181`)
- **Intent:** Toggling a habit writes the recomputed streak with `itemRepo.update` directly, so there is no history entry and no undo; and the streak is computed from the stale `item` prop, so concurrent toggles can compute a stale streak.
- **Acceptance criteria:**
  1. After `setStatus`, `toggleDone` re-reads the item (`itemRepo.get`) and computes `habitStreak` from the persisted post-toggle occurrence state.
  2. The streak update is persisted through `patchItem` (records history and pushes an undo entry), not a raw `itemRepo.update`.
  3. Toggle a habit, then undo: both the occurrence status and `data.streak` return to their pre-toggle values.
- **Verification method:** Add to `src/domain/itemActions.test.ts` (fake-indexeddb): toggle a daily habit done, assert a history entry was recorded for `data.streak`, then invoke the pushed undo and assert the previous status/streak are restored. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Keep the write silent (no duplicate toast).

### IMP-051 — Remap `parentId` when duplicating imported items
- **Status:** TODO
- **Category:** correctness / data integrity
- **Type:** bug-fix
- **Area / files:** `src/lib/backup.ts` (`mergeImportedItems`, `:62-92`, duplicate branch `:84-86`); caller `src/features/settings/SettingsView.tsx:98-104`
- **Intent:** The `duplicate` import strategy assigns a new `id` but leaves `parentId` pointing at the original parent, so a duplicated subtask/milestone is orphaned or re-attaches to the live original.
- **Acceptance criteria:**
  1. For strategy `duplicate`, an id map (original → new) is built and every duplicated item's `parentId` is rewritten to the new id when its parent is also in the incoming set.
  2. Duplicated items whose parent is not in the incoming set keep the original `parentId`.
  3. `skip`/`overwrite` behavior is unchanged.
- **Verification method:** Extend `src/lib/backup.test.ts` with an incoming parent+child that both collide with existing ids; assert the duplicated child's `parentId` equals the duplicated parent's new id and both ids differ from the originals. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Only `parentId` cross-references ids today; checklist/history ids are self-contained.

### IMP-016 — Fix "This occurrence" edits leaking to the whole series
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`updateRecurring` occurrence branch, `:231-245`); `src/features/item/ItemEditorSheet.tsx` (`handleSave`, `:82-105`)
- **Intent:** For scope `occurrence`, the code writes `overrides[occKey]` **and** calls `patchItem(item.id, { ...patch, recurrence })`, re-anchoring the base series, so urgency/importance/status/tags/allDay/start/end/reminders/data changes apply to every occurrence. This is the highest-impact scheduling correctness bug.
- **Acceptance criteria:**
  1. For scope `occurrence`, only `overrides[occKey]` is written; the base item's `start`, `end`, `allDay`, `status`, `urgency`, `importance`, `tags`, `reminders`, and `data` are unchanged.
  2. The override captures the fields a single occurrence may change (at minimum `start`, `title`, `notes`, `allDay`, and per-occurrence status).
  3. Editing one occurrence does not change displayed values of any other occurrence of the same series.
- **Verification method:** Unit test `updateRecurring(item, 'occurrence', key, patch)` asserting the base item deep-equals the original except `recurrence.overrides`, plus `patchItem` history. Playwright: create a weekly task, edit one occurrence's urgency, reopen another occurrence and assert it is unchanged. Run `npm run test`.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.5
- **Notes:** Mirror the recon-recommended explicit base patch `{ recurrence }`.

### IMP-017 — Strip trailing prepositions from parsed quick-add titles
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/quickadd.ts` (`titleRaw` cleanup, `:302-305`)
- **Intent:** Removing "3pm" leaves a dangling "at", so `"Call dentist tomorrow at 3pm !urgent #health"` yields title `"Call dentist at"`, visible in the stored item and toast.
- **Acceptance criteria:**
  1. A trailing preposition/article left by date/time/day extraction (`at`, `on`, `in`, `by`, `the`) is trimmed from the title.
  2. Interior prepositions are preserved ("Call about the dentist").
  3. Existing quickadd tests still pass.
- **Verification method:** Extend `src/domain/quickadd.test.ts` with the exact sample asserting title `"Call dentist"`; add a control case. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:**

### IMP-018 — Make quick-added habits recurring (default daily)
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/quickadd.ts` (`quickAddToItem`, `:345-384`)
- **Intent:** Quick-added habits get no `recurrence`, so they exist on one day only; streaks and "done today" are wrong.
- **Acceptance criteria:**
  1. When the resolved kind is `habit` and no recurrence was parsed, `quickAddToItem` sets a daily recurrence with `interval: 1`.
  2. An explicit recurrence in the input is preserved.
  3. The created habit shows today and expands for the coming week.
- **Verification method:** Extend `src/domain/quickadd.test.ts` asserting `recurrence.freq === 'daily'` for a habit quick-add; Playwright: quick-add a habit and confirm it appears on Today and Habits with a streak control. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:**

### IMP-019 — Only mark a reminder fired when it was actually delivered
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/pwa/ReminderRuntime.tsx` (`deliver`, `:16-47`)
- **Intent:** `deliver` records the reminder log unconditionally even when only an in-app toast is shown (permission denied/background tab). If the user does not see the toast, dedupe permanently suppresses the reminder.
- **Acceptance criteria:**
  1. A reminder is recorded as fired only when a notification was shown **or** the document was visible when the toast appeared.
  2. If neither holds, the reminder is retried next tick (not recorded).
  3. Digest delivery follows the same rule.
- **Verification method:** Unit-test an extracted `deliver` by injecting a `showAppNotification` stub returning false with `document.hidden = true`; assert `reminderLogRepo.wasFired` remains false. Run `npm run test`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 12
- **Notes:** Extract `deliver` so it is testable without mounting React.

### IMP-020 — Validate backup identity/version before import
- **Status:** TODO
- **Category:** correctness / data integrity
- **Type:** improvement
- **Area / files:** `src/lib/backup.ts` (`parseBackup`, `:35-50`); caller `src/features/settings/SettingsView.tsx` (`importJSON`, `:92-112`)
- **Intent:** `parseBackup` never checks `app === 'eisenmatrix'` or the version, and the `if (!Array.isArray(items))` check at `:43` is unreachable (items is already coerced to an array at `:37-41`). Any JSON file is accepted as a backup.
- **Acceptance criteria:**
  1. A payload whose `app` is present but not `'eisenmatrix'` throws a clear error.
  2. A too-new `version` is rejected (or explicitly downgraded with a warning) rather than silently accepted.
  3. The dead `!Array.isArray(items)` branch is removed.
  4. Existing `src/lib/backup.test.ts` round-trip still passes.
- **Verification method:** Extend `src/lib/backup.test.ts` asserting throws for `{app:'other'}` and a too-new version, and success for a valid payload. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:**

### IMP-021 — Gate notification delivery on the `notificationsEnabled` setting
- **Status:** TODO
- **Category:** configuration / defaults
- **Type:** improvement
- **Area / files:** `src/types/settings.ts` (`:14,23`); `src/pwa/ReminderRuntime.tsx`; `src/features/settings/SettingsView.tsx` (`:150,192-203`)
- **Intent:** The "Device notifications" toggle writes `notificationsEnabled` but nothing reads it; delivery depends only on raw browser permission, so the toggle has no effect.
- **Acceptance criteria:**
  1. When `notificationsEnabled` is false, `ReminderRuntime` does not call `showAppNotification` (in-app toasts still work).
  2. When true and permission is granted, behavior is unchanged.
  3. Settings copy matches actual behavior.
- **Verification method:** Set the setting false, unit-test `deliver` with the setting false, assert no notification call and a toast fallback. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:** Chosen behavior is gating (keep the toggle); document it in the copy.

### IMP-022 — Add Dependabot and an `npm audit` CI step
- **Status:** TODO
- **Category:** security / CI automation
- **Type:** tooling
- **Area / files:** new `.github/dependabot.yml`; `.github/workflows/ci.yml` (from IMP-005)
- **Intent:** `npm audit` reports 12 dev/build advisories (9 high) with no automated tracking. Dev-toolchain advisories still affect contributors and CI. The runtime bundle is unaffected.
- **Acceptance criteria:**
  1. `.github/dependabot.yml` enables weekly npm updates and GitHub Actions updates.
  2. A non-blocking audit step reports advisories in CI (fails only on `critical`).
  3. The committed config validates as YAML.
- **Verification method:** `npx prettier --check .github/dependabot.yml`; run `npm audit --audit-level=critical` locally and confirm the current exit status matches the chosen policy. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-005
- **Priority score:** 12
- **Notes:** Do not auto-merge major bumps (see IMP-048, tailwind).

### IMP-023 — Correct `count` when splitting a recurring series
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/recurrence.ts` (`splitSeries`, `:286-308`)
- **Intent:** `splitSeries` copies the original `count` into both head and tail (`:296`, `:302`), so the tail can generate more occurrences than remain. A 10-count weekly series split after 3 yields up to 17 occurrences.
- **Acceptance criteria:**
  1. The head keeps only the occurrences up to the split; the tail's `count` is reduced by the number of occurrences consumed by the head (or set null if the original had no count).
  2. For a count-limited series, the total occurrences after a split equals the original `count`.
  3. `until`-bounded and unbounded splits are unchanged.
- **Verification method:** Extend `src/domain/recurrence.test.ts` with a count-limited series, split it, and assert the summed occurrence count equals the original count. Run `npm run test`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 12
- **Notes:** Also null-guard `parseLocalDate(fromKey)!` (see IMP-041).

### IMP-052 — Fold long ICS lines per RFC 5545
- **Status:** TODO
- **Category:** interoperability
- **Type:** bug-fix
- **Area / files:** `src/lib/ics.ts` (`itemsToICS`, `:79-117`)
- **Intent:** Content lines are joined raw, so long `SUMMARY`/`DESCRIPTION` values exceed 75 octets and are non-compliant; importers may reject or truncate them.
- **Acceptance criteria:**
  1. Every emitted content line is folded at 75 octets per RFC 5545 (continuation lines begin with a single space).
  2. Unfolding the output (removing CRLF + a single leading space) reconstructs the original property value byte-for-byte.
  3. Lines of 75 octets or fewer are not folded.
  4. Existing `src/lib/ics.test.ts` assertions still pass.
- **Verification method:** Extend `src/lib/ics.test.ts` with a 200-character title; assert no output line exceeds 75 octets and unfolding the `SUMMARY` line equals the full title. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:** Fold on octets, not characters, to be safe with non-ASCII; use a pure `foldLine` helper.

### IMP-053 — Make the calendar "+N more" affordance open the full list
- **Status:** TODO
- **Category:** UX / completeness
- **Type:** feature-improvement
- **Area / files:** `src/features/calendar/CalendarView.tsx` (month cell `:224-228`, year card `:342-344`)
- **Intent:** Month cells cap at 3 and year cards at 5 with a non-interactive `+N more`, so hidden items cannot be reached from those views.
- **Acceptance criteria:**
  1. The month `+N more` control is a button that reveals all occurrences for that day (expanding in place or opening a popover/dialog).
  2. The year-card `+N more` control does the same for that month.
  3. With 6 items on a day, activating `+3 more` makes all 6 titles reachable.
  4. The default (≤3 / ≤5) rendering is unchanged.
- **Verification method:** Playwright: add 6 items to one day; month view shows `+3 more`; click it and assert all 6 titles are present. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:** Reuse `openEditor`/agenda patterns; keep it keyboard reachable.

### IMP-054 — Preserve parsed quick-add data when the kind is changed
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/features/quickadd/QuickAdd.tsx` (kind override, `:48-51`); `src/domain/quickadd.ts`
- **Intent:** Changing the kind replaces `item.data` with `defaultDataFor`, so `"buy milk 2L"` parsed as shopping loses its quantity/unit if the user switches kind (and switching back does not restore it).
- **Acceptance criteria:**
  1. Changing kind carries over parsed fields compatible with the new kind (at minimum `quantity`/`unit` for shopping, `amount`/`currency` for bill).
  2. Fields that do not apply to the new kind are dropped.
  3. Switching kind back to the parsed kind restores the parsed values.
- **Verification method:** Add a pure-helper test asserting the data payload for `buy milk 2L` after a kind round-trip retains `quantity === 2`; Playwright: parse, change kind, change back, commit, and assert the stored item keeps quantity. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:** Extract the kind-switch data merge into a pure helper for testability.

### IMP-055 — Occurrence-scoped Delete should skip, not delete the series
- **Status:** TODO
- **Category:** correctness / data loss
- **Type:** bug-fix
- **Area / files:** `src/features/item/ItemEditorSheet.tsx` (`handleDelete`, `:107-110`, scope state `:40,165-192`); `src/domain/itemActions.ts` (`skipOccurrence`, `:209-218`)
- **Intent:** Deleting while an occurrence is open always calls `deleteItem`, destroying the entire series; `skipOccurrence` exists but is never wired to any control, so per-occurrence removal is unreachable.
- **Acceptance criteria:**
  1. When the editor was opened for a recurring item with an occurrence key and scope is `occurrence`, the destructive control is labelled "Skip this occurrence" and calls `skipOccurrence(item, occKey)` (adds the occurrence to `recurrence.exceptions`), not `deleteItem`.
  2. Whole-series deletion remains available in the `all` scope and for non-occurrence edits.
  3. In `future` scope the delete behavior is explicit and documented, and does not silently delete the whole series.
- **Verification method:** Playwright: create a weekly item, open one occurrence, activate "Skip this occurrence", and assert only that occurrence disappears while the others remain; unit-assert `skipOccurrence` adds the key to `exceptions`. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:** `ItemEditorSheet.handleSave` already branches on `scope`; mirror it for delete.

### IMP-056 — Prune expired snooze reminders
- **Status:** TODO
- **Category:** correctness / data health
- **Type:** bug-fix
- **Area / files:** `src/pwa/ReminderRuntime.tsx` (snooze branch, `:141-153`); `src/features/item/ReminderEditor.tsx`
- **Intent:** Every snooze appends a new `{ absolute }` reminder and nothing removes it, so `item.reminders` grows without bound and stale snoozes show up in the editor.
- **Acceptance criteria:**
  1. Absolute reminders whose `absolute` timestamp is in the past are removed on load (a prune pass), so repeated snoozes do not grow `item.reminders` indefinitely.
  2. After N snoozes, at most one future absolute reminder remains pending.
  3. Relative (`offsetMinutes`/`timeOfDay`) reminders are never pruned.
- **Verification method:** Unit-test an extracted `pruneExpiredAbsolute(reminders, now)` pure helper with past/future/relative fixtures; assert only future absolutes survive. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:** Run the prune alongside the existing `reminderLogRepo.pruneBefore` boot effect in `ReminderRuntime`.

### IMP-024 — Make all mobile bottom-nav destinations reachable at 390px
- **Status:** TODO
- **Category:** responsiveness / UX
- **Type:** bug-fix
- **Area / files:** `src/features/shell/AppShell.tsx` (mobile nav, `:213-230`)
- **Intent:** At 390px the bottom nav is `564px` wide with `overflow-x: auto`; Shopping, Notes and Settings are off-screen behind an undiscoverable horizontal swipe with no fade/arrow hint.
- **Acceptance criteria:**
  1. At 390px all 10 destinations are reachable without an unmarked horizontal scroll (e.g. an explicit overflow/"More" affordance, scroll fade, or a reduced nav set + More menu).
  2. If horizontal scroll is kept, a visible scroll cue is present and the nav is keyboard/AT reachable.
  3. Desktop (`≥640px`) nav layout is unchanged.
- **Verification method:** Playwright at 1280×800 and 390×844: screenshot/inspect nav, assert every nav destination can be activated and a visible affordance (or non-scrolling layout) exists. Run at both themes.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:** Pair with the mobile bottom-padding fix (not promoted below).

### IMP-025 — Add tests for the `itemActions` write path
- **Status:** TODO
- **Category:** test coverage
- **Type:** test
- **Area / files:** new `src/domain/itemActions.test.ts`; target `src/domain/itemActions.ts`
- **Intent:** Every mutation (`saveItem`, `patchItem`, `toggleDone`, `updateRecurring`, `deleteItem`) records history and pushes undo, and none of it is tested; the series bugs (IMP-016, IMP-037, IMP-050) live here.
- **Acceptance criteria:**
  1. Tests cover `saveItem` create + edit history accumulation and the undo closure.
  2. Tests cover `toggleDone` for a plain item and an occurrence.
  3. Tests cover `deleteItem` / `deleteItems` descendant restoration (IMP-003/004).
  4. Tests cover `updateRecurring` for `occurrence`, `future`, and `all` scopes.
  5. All pass via `npm run test`.
- **Verification method:** `npm run test` reports the new file green under fake-indexeddb.
- **Effort:** M    **Risk:** low
- **Depends on:** IMP-002, IMP-003
- **Priority score:** 10
- **Notes:** Undo closures require draining `useUiStore`; add a small test helper. IMP-050 may extend this file.

### IMP-026 — Add unit tests for `eisenhower.ts`
- **Status:** TODO
- **Category:** test coverage
- **Type:** test
- **Area / files:** new `src/domain/eisenhower.test.ts`; target `src/domain/eisenhower.ts`
- **Intent:** Quadrant mapping and `priorityScore` drive the Matrix view and drag-to-reprioritise, and are completely untested.
- **Acceptance criteria:**
  1. Tests cover `quadrantOf` for all four urgency/importance combinations, including ties/defaults.
  2. Tests cover `priorityScore` ordering and monotonicity.
  3. Tests cover `itemsInQuadrant` partitioning.
  4. All pass via `npm run test`.
- **Verification method:** `npm run test` reports the new file green.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:**

### IMP-027 — Give Sheet and Dialog an accessible name
- **Status:** TODO
- **Category:** accessibility
- **Type:** improvement
- **Area / files:** `src/components/ui/Sheet.tsx` (`:50-59`), `src/components/ui/Dialog.tsx` (`:63`)
- **Intent:** `Sheet` uses `role="dialog" aria-modal` with no accessible name; `Dialog` passes `aria-label={title}` which is `undefined` when only `description`/children exist. Screen readers announce an unnamed dialog.
- **Acceptance criteria:**
  1. Both primitives render a real title node referenced by `aria-labelledby`, or fall back to a non-empty `aria-label`.
  2. When `description` is provided it is referenced by `aria-describedby`.
  3. No visual change.
- **Verification method:** Playwright `browser_snapshot` of an open Sheet and Dialog; assert the dialog node exposes a non-empty accessible name. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:**

### IMP-029 — Pin the Node version (engines + .nvmrc)
- **Status:** TODO
- **Category:** configuration / packaging
- **Type:** tooling
- **Area / files:** `package.json`, new `.nvmrc`
- **Intent:** README requires Node 20+ but there is no `engines` field or version pin; contributors and CI can silently use different Node majors (the recon used v25).
- **Acceptance criteria:**
  1. `package.json` declares `engines.node` consistent with README (e.g. `>=20`).
  2. A `.nvmrc` (or `.node-version`) pins the same major used in CI (20).
  3. `npm run build` still passes.
- **Verification method:** `node -e "const p=require('./package.json'); if(!p.engines||!p.engines.node) process.exit(1)"`; read `.nvmrc`; run `npm run build`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:** Align the value with IMP-005's setup-node.

### IMP-031 — Fix CSV parsing of a quote appearing mid-field
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/lib/csv.ts` (`parseCSV`, `:54-58`)
- **Intent:** A `"` is treated as opening a quoted field anywhere in a field, so `abc"def` mis-parses. Quotes should only open at field start.
- **Acceptance criteria:**
  1. A quote is only treated as a field delimiter when the current field is empty.
  2. Embedded/mid-field quotes are preserved as literal characters.
  3. RFC-4180 round-trip tests (quotes, commas, newlines) still pass.
- **Verification method:** Extend `src/lib/csv.test.ts` with `abc"def` and a mid-field quote; assert exact round-trip. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:**

### IMP-032 — Sum recorded bill payments for the "Paid" total
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/features/bills/BillsView.tsx` (`:50-52`)
- **Intent:** The monthly "Paid" figure sums `bill.data.amount` (current) rather than `payments[occKey].amount`, so editing a bill's amount retroactively rewrites history.
- **Acceptance criteria:**
  1. The Paid total sums the per-payment recorded amounts for the visible month.
  2. Editing the current `amount` does not change previously recorded payments' contribution.
  3. Bills with no recorded payments contribute 0.
- **Verification method:** Unit-test the total helper with two payments of different amounts; Playwright: mark a bill paid, change its amount, confirm the Paid total is unchanged. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:**

### IMP-033 — Add missing ARIA state/roles to toggles and sortable headers
- **Status:** TODO
- **Category:** accessibility
- **Type:** improvement
- **Area / files:** `src/features/settings/SettingsView.tsx` (`:159-175`), `src/features/notes/NotesView.tsx` (`:126-136`), `src/features/bills/BillsView.tsx` (`:121-133`), `src/features/habits/HabitsView.tsx` (`:97-109`), `src/features/list/ListView.tsx` (`:277-298`)
- **Intent:** Theme segmented control, pin toggle, bill paid toggle, and habit mark-today lack `aria-pressed`/`radiogroup`; sortable ListView headers lack `aria-sort`. AT users cannot tell state or sort direction.
- **Acceptance criteria:**
  1. Theme control exposes a proper `radiogroup`/`radio` (or `aria-pressed`) with the selected option.
  2. Pin, bill-paid, and habit controls expose `aria-pressed` reflecting state.
  3. Sortable ListView headers expose `aria-sort` = `ascending`/`descending` and the active column.
  4. No visual change.
- **Verification method:** Playwright `browser_snapshot` of each view asserting the ARIA attributes; toggle and re-snapshot to confirm state changes. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:** The "List" column header is the only unsortable one; give it an explicit non-sort state or make it sortable.

### IMP-034 — Add a LICENSE file matching the README (NEEDS-HUMAN)
- **Status:** NEEDS-HUMAN
- **Category:** documentation / packaging
- **Type:** docs
- **Area / files:** new `LICENSE`; `README.md`
- **Intent:** README declares the MIT License but no `LICENSE` file exists. A copyright holder name and year are required, which the improver must not invent.
- **Acceptance criteria:**
  1. A `LICENSE` file exists containing the MIT text with the correct copyright holder and year.
  2. README's license section points to it.
- **Verification method:** Confirm `LICENSE` exists and matches MIT; README link resolves. Requires the human to supply the holder name/year.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:** NEEDS-HUMAN: legal identity of the copyright holder.

### IMP-035 — Fix settings read-modify-write races between theme and Settings
- **Status:** TODO
- **Category:** correctness / concurrency
- **Type:** bug-fix
- **Area / files:** `src/hooks/useTheme.ts` (`:30-35`); `src/features/settings/SettingsView.tsx` (`persist`, `:59-61`)
- **Intent:** Both writers read the single `app` row and `put` a whole merged object. A theme change concurrent with a digest/notification change can drop one side, silently losing a setting.
- **Acceptance criteria:**
  1. Settings writes merge only the changed keys (Dexie `table.update`/`modify` or per-key rows) instead of writing a stale whole-object snapshot.
  2. A theme toggle concurrent with a digest change preserves both values.
  3. `useSetting('app')` still returns a merged `AppSettings` object.
- **Verification method:** Unit-test the persistence helper: simulate two interleaved `persist` calls with different keys and assert both survive. Run `npm run test`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 8
- **Notes:** Keep the public `settingsRepo.get('app')` shape for existing readers.

### IMP-036 — Make reminder dedupe race-safe
- **Status:** TODO
- **Category:** correctness / concurrency
- **Type:** bug-fix
- **Area / files:** `src/db/repository.ts` (`reminderLogRepo.wasFired`/`record`, `:147-157`); `src/db/schema.ts` (`:36`); `src/pwa/ReminderRuntime.tsx`
- **Intent:** `record` uses `add` against a non-unique `[itemId+occKey]` index and `wasFired` is a separate read. Overlapping ticks or React StrictMode double-invocation can both see "not fired" and double-deliver.
- **Acceptance criteria:**
  1. The compound index is unique, or delivery uses an atomic insert-then-catch (`Dexie.ConstraintError`) to decide the winner.
  2. Two concurrent `record` calls for the same key result in exactly one successful insert.
  3. A `ticking` in-flight guard prevents overlapping ticks.
  4. Existing reminder dedupe tests still pass.
- **Verification method:** Extend `src/db/repository.test.ts`: fire two concurrent `record` calls and assert one succeeds and one is detected as duplicate. If the index changes, add a schema-version migration. Run `npm run test`.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 8
- **Notes:** Schema change requires bumping the Dexie version (high-blast-radius; include a migration).

### IMP-037 — Fix "This and future" editing past occurrences + add undo
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`updateRecurring` future branch, `:252-264`); `src/domain/recurrence.ts` (`splitSeries`)
- **Intent:** `updateRecurring` is called with the edited `draft`, and `splitSeries(draft, …)` builds `head` from it, so past occurrences receive the patch; the branch also never pushes an undo entry, so a split cannot be undone.
- **Acceptance criteria:**
  1. The head is built from the **persisted original** item (unpatched); only the tail receives the patch.
  2. A single undo entry is pushed that restores the original item and removes the created tail.
  3. Past occurrences before `occKey` are unchanged after the split.
  4. `count` handling follows IMP-023.
- **Verification method:** Extend `src/domain/itemActions.test.ts`: split a series with a title patch, assert the head title is unchanged and the tail title changed; invoke undo and assert the item set matches pre-split. Run `npm run test`.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-023
- **Priority score:** 8
- **Notes:** `ItemEditorSheet.handleSave` also pushes its own "Series split" toast; consolidate to one.

### IMP-038 — Validate imported JSON/CSV item shape before persisting
- **Status:** TODO
- **Category:** security / data integrity
- **Type:** improvement
- **Area / files:** `src/lib/backup.ts` (`:35-50`), `src/lib/csv.ts` (`csvToItems`, `:124-165`), `src/domain/itemFactory.ts` (`normalizeItem`, `:88-121`)
- **Intent:** Imported data is persisted with no schema validation and downstream code assumes array/object shapes (`item.reminders.length`, `rule.exceptions.includes`, `KIND_META[item.kind]`). A corrupt/hostile file can crash rendering or persist junk.
- **Acceptance criteria:**
  1. `normalizeItem` (or a new validator) coerces/validates `kind` against `ITEM_KINDS`, `status` against `ITEM_STATUSES`, and ensures `reminders`/`tags`/`checklist`/`occurrences` are the expected types.
  2. Unknown/invalid `kind` falls back to `task` (and is dropped or flagged) instead of producing `KIND_META[undefined]`.
  3. `csvToItems` and `parseBackup` route through the validator, and an item failing validation is reported in the import summary rather than crashing.
  4. Existing backup/csv/normalize tests still pass.
- **Verification method:** Extend `src/lib/csv.test.ts` and `src/lib/backup.test.ts` with invalid kinds and non-array `reminders`; assert either a safe fallback or a counted rejection, never a throw. Run `npm run test`.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-020
- **Priority score:** 8
- **Notes:** Keep validation pure and in `domain`/`lib`, not in the UI.

### IMP-039 — Add a top-level error boundary and handle boot failures
- **Status:** TODO
- **Category:** error handling
- **Type:** improvement
- **Area / files:** `src/main.tsx`, `src/App.tsx` (`:27-31`)
- **Intent:** `runLegacyMigration()` and `setupPWA()` are fired with `void` and no `.catch`, and there is no error boundary. Blocked storage (Safari private mode), quota exhaustion, or a corrupt DB crash boot to a blank screen.
- **Acceptance criteria:**
  1. A top-level error boundary catches render errors and shows a recoverable message (not a blank page).
  2. Migration/PWA boot promises have catch handlers that surface a toast or a persisted "storage unavailable" state.
  3. A Dexie open/upgrade failure does not leave the app blank.
- **Verification method:** Add a unit test rendering a component that throws inside the boundary and assert the fallback renders; Playwright: navigate the app and confirm the boundary is mounted on the boot path. Run `npm run test`.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 8
- **Notes:** Keep the fallback token-styled and offer a reload.

### IMP-040 — Apply all supported fields in `updateOccurrence` for non-recurring items
- **Status:** TODO
- **Category:** correctness / bug-fix
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`updateOccurrence`, `:192-207`)
- **Intent:** For non-recurring items only `start` is applied, silently dropping `end`, `status`, and `notes`. Drag-to-day on a non-recurring item with an end time loses the end.
- **Acceptance criteria:**
  1. For non-recurring items, all provided patch fields (`start`, `end`, `status`, `notes`) are persisted.
  2. `undefined` fields remain unchanged.
  3. Recurring behavior is unchanged.
- **Verification method:** Add a unit test in `src/domain/itemActions.test.ts` calling `updateOccurrence` on a non-recurring item with `end`/`notes` and asserting they persist. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8
- **Notes:**

### IMP-041 — Null-guard `parseLocalDate` non-null assertions
- **Status:** TODO
- **Category:** correctness / robustness
- **Type:** bug-fix
- **Area / files:** `src/domain/recurrence.ts` (`:293`), `src/domain/stats.ts` (`:47`)
- **Intent:** `parseLocalDate(fromKey)!` and `parseLocalDate(item.start)!` throw on a malformed/missing start; legacy or user-entered bad data can crash a view.
- **Acceptance criteria:**
  1. `splitSeries` returns the item unchanged (or a safe no-op) when `fromKey` is not a valid date, instead of throwing.
  2. `habitStreak` falls back to a sensible default window when `item.start` is malformed.
  3. No remaining `!` assertions on `parseLocalDate` results in these two modules.
- **Verification method:** Extend `src/domain/recurrence.test.ts` and `src/domain/stats.test.ts` with a malformed date input asserting no throw. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8
- **Notes:**

### IMP-042 — Surface swallowed errors instead of failing silently
- **Status:** TODO
- **Category:** observability / error handling
- **Type:** improvement
- **Area / files:** `src/pwa/notifications.ts` (`:49`), `src/lib/csv.ts` (`safeJSON`, `:115-122`), `src/db/migrations/legacyTasks.ts` (`parseLegacyTasks`, `:194-202`)
- **Intent:** Several empty catch blocks swallow every failure with no trace, so the hardest bugs (notification delivery, migration parse, CSV decode) leave no diagnostic. A minimal, dev-visible signal is needed.
- **Acceptance criteria:**
  1. `showAppNotification`, `safeJSON`, and legacy-task parsing emit a `console.warn`/`console.debug` with context on failure (no secrets or full payloads).
  2. User-facing behavior is unchanged (still a silent/normal fallback).
  3. No new console noise on the happy path.
- **Verification method:** Unit-test the helpers with malformed input asserting the warn is called and the fallback returned; Playwright confirm zero unexpected console warnings on a clean boot. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8
- **Notes:** Keep messages short and PII-free.

### IMP-043 — Re-enable the `no-explicit-any` lint rule
- **Status:** TODO
- **Category:** tooling / type safety
- **Type:** tooling
- **Area / files:** `eslint.config.js` (`:31`); `src/**/*.ts(x)`
- **Intent:** `@typescript-eslint/no-explicit-any` is disabled, so a future `any` would not be caught despite the otherwise-strict typing.
- **Acceptance criteria:**
  1. `no-explicit-any` is enabled (error, or warn if the codebase has none).
  2. `npm run lint` passes with the rule enabled (the recon verified there is currently no `any` in `src/`).
  3. If any legitimate `any` exists, it carries an inline, justified disable comment.
- **Verification method:** `npm run lint` exits 0 with the rule on; grep `: any` in `src/` returns nothing un-annotated.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8
- **Notes:**

### IMP-046 — Rename the agent guide to `AGENTS.md` and fix the README link
- **Status:** TODO
- **Category:** documentation / interop
- **Type:** docs
- **Area / files:** `agents.md` (tracked, lowercase), `README.md` (`:106`)
- **Intent:** Only lowercase `agents.md` is tracked; common tooling and case-sensitive filesystems expect uppercase `AGENTS.md`, so an uppercase lookup misses it on Linux CI.
- **Acceptance criteria:**
  1. The tracked file is renamed from `agents.md` to `AGENTS.md` (content unchanged).
  2. `README.md` links to `./AGENTS.md`; no case-sensitive reference to `agents.md` remains.
  3. No other doc references the old name.
- **Verification method:** `git ls-files | grep -x AGENTS.md` succeeds and `git ls-files | grep -x agents.md` returns nothing; case-sensitive `grep -r "agents.md" .` (excluding `.git`) returns nothing. No build step.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 4
- **Notes:** There is no byte-identical duplicate; the "two canonical docs" finding was a case-insensitive-filesystem artifact (only one file is tracked).

### IMP-047 — Ship PNG PWA icons for installers that ignore SVG (NEEDS-HUMAN)
- **Status:** NEEDS-HUMAN
- **Category:** packaging / PWA
- **Type:** improvement
- **Area / files:** `public/` icons, `vite.config.ts` PWA manifest (`icons`)
- **Intent:** The manifest references SVG-only 192/512 icons; some installers (notably iOS) ignore SVG and show a broken/blank icon. Correct PNG assets require a design decision/authoring.
- **Acceptance criteria:**
  1. 192×192 and 512×512 PNG icons exist and are referenced by the manifest, plus an `apple-touch-icon`.
  2. `npm run build` still generates `dist/sw.js` and a valid manifest.
  3. Installing on iOS shows the app icon.
- **Verification method:** `npm run build`; inspect `dist/manifest.webmanifest` for PNG entries; preview and check the install prompt. Requires human-provided/approved artwork.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 4
- **Notes:** NEEDS-HUMAN: brand artwork must be supplied/approved.

### IMP-048 — Plan the Tailwind v4 major migration to clear audit advisories (NEEDS-HUMAN)
- **Status:** NEEDS-HUMAN
- **Category:** security / dependency health
- **Type:** tooling
- **Area / files:** `package.json` (`tailwindcss@^3.4.19`), `postcss.config.js`, `tailwind.config.ts`, `src/styles/index.css`
- **Intent:** The Tailwind dependency chain (chokidar/fast-glob/picomatch/braces) carries high advisories whose only fix is a **major** bump to v4, a breaking config/PostCSS change. This is a scoped, higher-risk migration needing a maintainer decision.
- **Acceptance criteria:**
  1. Decision recorded: migrate to Tailwind v4 or accept/waive the dev-only advisories.
  2. If migrating: `npm run build`, `typecheck`, `lint`, and `test` pass, and all views match the pre-migration screenshots in light and dark themes.
  3. `npm audit` no longer reports the Tailwind chain advisories (if migrated).
- **Verification method:** If migrated, run all four gates plus Playwright screenshot comparison across the 10 views in both themes; otherwise record the waiver. Requires a human decision on scope/risk.
- **Effort:** L    **Risk:** high
- **Depends on:** none
- **Priority score:** 3
- **Notes:** NEEDS-HUMAN: breaking-dependency upgrade decision; do not auto-merge.

---

_End of backlog (52 items). Source findings not promoted to items (lower impact or duplicate): calendar `+N more` was promoted (IMP-053); still below the cut are ICS all-day `DTEND`, command-palette active-row scroll, ListView selection-vs-filter, bills paid-state vs occurrence-status coupling, goals checklist child-kind filtering, goals inline progress editing, keyboard drag path, loading skeleton before `useLiveQuery` resolves, overdue-window cap in TodayView, shopping `window.prompt`/row delete, `defaultView` dead setting, migration atomicity/re-run overwrite, body-scroll-lock refcount, `useFocusTrap` hidden-element filter, `Tabs` keyboard/`type=button`, `timestampedName` UTC day, notification-action no-op when no window, reminder-editor absolute-reminder display, `until`/`count` exception semantics, undo-stack cap and toast-timer leaks, and pure dead-code removal. Each remains a valid future follow-up._

_Rejected during critic review (not checkable / premise false / not a defect): the former history-blob item (`buildHistory` already skips `occurrences` at `itemActions.ts:32`), the former hardcoded-color item (badge classes in `labels.ts` already carry `dark:` variants; `bg-white` is a cosmetic knob only), and the former "reset all data" item (the confirm copy already enumerates exactly the tables it clears). The former standalone `npm ci` item was merged into IMP-005._
