# FEATURES.md — Prioritized Improvement Backlog

Repo: `eisenmatrix-calendar` · Baseline SHA: `b9d23246b948187c0239e8c95373e3e1f27cc43f`
Generated: 2026-10-04 · Reviewed 2026-10-04 (backlog critic) against the recon reports and the actual source.

This backlog is ordered by **priority score descending** (ties broken by impact, then lower effort).
Every item is independently verifiable and cites real files. `Depends on` is respected: an item's
dependencies appear earlier in the file. Items needing human judgment/design/legal input are marked
**Status: NEEDS-HUMAN** and placed at their score position. There are **4 NEEDS-HUMAN items**
(IMP-034, IMP-047, IMP-048, IMP-067); no other item depends on them.

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
- **Status:** DONE
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
- **Notes:** DONE. ci.yml (pull_request + push main) runs npm ci -> typecheck -> lint -> test -> build on Node 20 w/ cache; deploy.yml uses npm ci and `deploy needs [build, gate]`. Verified PASS. Follow-up (needs repo settings, human): branch-protect main; gate currently also runs on push main (duplicate).

### IMP-006 — Add unit tests for `stats.ts` goal progress and completion
- **Status:** DONE
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
- **Notes:** DONE. Added 31 cases to src/domain/stats.test.ts (goalProgress metric types, completionStats rounding/zero-total, itemCompletionStats window, activeDayStreak, overallCompletion); non-overlapping with IMP-001; tests-only, no production change. 93 tests green; TZ-independent.

### IMP-049 — Make the calendar honor the `weekStartsOn` setting
- **Status:** DONE
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
- **Notes:** DONE. Added pure `weekdayLabels(weekStartsOn)` in src/lib/labels.ts; CalendarView reads weekStartsOn for week/month bounds + header. Unit-tested + Playwright-verified Sun-first (2026-09-27) and Mon-first (2026-09-28); 100 tests green; default unchanged. Follow-ups logged: HabitsView.tsx:29 still hardcodes 1.

### IMP-007 — Stop note quick-add truncating long first lines
- **Status:** DONE
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
- **Notes:** DONE. Added pure `splitNoteDraft`/`NOTE_TITLE_MAX` in src/domain/quickadd.ts; title caps at 80 chars and the overflow becomes the body (no character loss). 7 unit + 3 jsdom/Dexie tests; 110 tests green; fuzz/property suite clean; mutation-checked.

### IMP-008 — Memoize `useItems` to stop array-identity churn
- **Status:** DONE
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
- **Notes:** DONE. useMemo'd both hooks with a shared EMPTY_ITEMS live-query default; filter predicates byte-identical. New useData.test.tsx (8 tests) asserts identity stability + new array on data/flag change. 118 tests green; mutation-checked (2 identity tests fail without memo). Also reduces year-view recomputation in CalendarView.

### IMP-009 — Focus the primary input in overlays, not the Close button
- **Status:** DONE
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
- **Notes:** DONE. Added initialFocusRef option to useFocusTrap, threaded via Sheet/Dialog; QuickAdd/CommandPalette/ItemEditorSheet now focus their primary input (dropped autoFocus, fixes focus restore). 10 jsdom tests; 128 tests green; Playwright-verified activeElement at 1280/390, Escape restores focus, Tab wraps.

### IMP-010 — Parse a lone weekday in quick add ("gym fri")
- **Status:** DONE
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
- **Notes:** DONE. Lone weekday consumed and resolved via nextWeekday (today not counted); multi-weekday/next/every paths byte-identical. 131 tests green; mutation-checked. Caveat: bare `wed`/`sat`/`sun` used as ordinary words are now consumed (see discovered-IMP-010.md §3b); lone `fri` yields "Untitled".

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
- **Notes:** DONE. New `nextMonthDay` helper (month-end clamped via clampDayOfMonth); "on the <N>" consumed only when applied (monthly -> byMonthDay, else next matching day-of-month); retained when an explicit date/weekday wins. 134 tests green; 400-case A/B vs HEAD shows no change outside `on the <N>` inputs; mutation-checked. Advisories: month-day now outranks relative dates; `on the 32nd` accepted.

### IMP-012 — Show the occurrence time on item cards, not the series start
- **Status:** DONE
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
- **Notes:** DONE. Added pure `resolveCardTime` in src/features/item/cardTime.ts; ItemCard takes an optional `start?: string`; Today + Calendar AgendaList pass occ.start, Matrix falls back. 140 tests green; Playwright-verified 16:30 override on Today/Calendar vs 09:00 Matrix, 1280/390, zero console errors. Follow-up: caller wiring itself is not unit-covered.

### IMP-013 — Suppress global shortcuts while overlays are open
- **Status:** DONE
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
- **Notes:** DONE. Added pure `isOverlayOpen(state)` selector to useUiStore and a single guard in useKeyboardShortcuts placed after the ⌘K/⌘Z branches; ? / / / c / n / 1-9 no longer fire behind an overlay while undo still does. 16 new tests; 156 tests green; mutation-checked; Playwright-verified 13 keys inert + ⌘Z undo + ? sheet reopen.

### IMP-014 — Emit RFC-5545-valid `UNTIL` for all-day (DATE) recurrence
- **Status:** DONE
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
- **Notes:** DONE. recurrenceToRRule takes `dateOnlyStart` and emits bare UNTIL=YYYYMMDD when DTSTART is VALUE=DATE; itemsToICS passes the same `!timed` boolean that chose DTSTART so they cannot disagree. Timed output byte-identical; local dates only (no UTC shift); TZ -11..+14 verified. 160 tests green; mutation-checked. Footgun logged: default `false` arg.

### IMP-015 — Handle CSV import errors and surface feedback
- **Status:** DONE
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
- **Notes:** DONE (attempt 2). importCSV wraps parse/pick/persist in try/catch and pushes the same `Import failed:` toast as importJSON via a `describeError(unknown)` helper that tolerates non-Error rejections; success toast/report unchanged. New SettingsView.test.tsx (deterministic: IS_REACT_ACT_ENVIRONMENT, drain() in afterEach before restoreAllMocks, vi.waitFor). 170 tests green over 9 full-suite runs incl. 3 shuffled seeds; 3 mutations caught. NOTE: the spec's verification recipe (malformed .csv) is unreachable because csvToItems never throws.

### IMP-050 — Habit completion must record undo/history and use fresh state
- **Status:** DONE
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
- **Notes:** DONE. toggleDone re-reads the row via itemRepo.get after setStatus, computes habitStreak from persisted state, and persists via patchItem (history recorded) with a new `trackUndo` option so the derived streak write shares the occurrence write's single undo entry; write stays silent (no toast). 173 tests green; 3 mutations (re-read/patchItem/trackUndo) each caught; Playwright-verified toggle -> 1 day streak -> Cmd+Z -> 0 with history restored, zero console errors.

### IMP-051 — Remap `parentId` when duplicating imported items
- **Status:** DONE
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
- **Notes:** DONE. mergeImportedItems pre-builds an original→new id map for `duplicate` and rewrites each duplicate's parentId to the parent's new id; parents outside the incoming set keep the original. skip/overwrite untouched (60k-case differential fuzz byte+identity identical). 180 tests green; 3 mutations caught.

### IMP-057 — Give the remaining overlays an initial focus target
- **Status:** DONE
- **Category:** accessibility
- **Type:** improvement
- **Area / files:** `src/features/shell/ShortcutSheet.tsx` (`:19`); `src/components/ui/Dialog.tsx` (`ConfirmDialog` `:101-121`); `src/features/settings/SettingsView.tsx` (`:292`, `:307`); trap fallback `src/hooks/useFocusTrap.ts` (`:17-23`)
- **Intent:** IMP-009 gave QuickAdd, CommandPalette and ItemEditorSheet an `initialFocusRef`, but `ShortcutSheet`, `ConfirmDialog` and both SettingsView dialogs pass none, so `useFocusTrap` falls back to the first focusable node — the "Close dialog" X button rendered at `Dialog.tsx:79`, which precedes the body and footer in DOM order. A keyboard user opening the shortcut sheet or a destructive confirm starts on Close and must Tab forward past the header every time.
- **Acceptance criteria:**
  1. `ShortcutSheet` opens with focus on a stable in-dialog target (its heading with `tabIndex={-1}`, or the dialog container), not the Close button.
  2. `ConfirmDialog` focuses the **Cancel** button (safe default) rather than Close, so Enter cannot trigger a destructive confirm by accident.
  3. Both SettingsView dialogs (`:292`, `:307`) focus a meaningful target: the first field for the import dialog, Cancel for the confirm.
  4. Focus still returns to the opener on close; Escape handling and the Tab loop are unchanged.
  5. No visual change.
- **Verification method:** Playwright at preview: press `?` and assert `document.activeElement` is not the Close button; open Settings → reset/import confirm and assert `activeElement` is Cancel. Add jsdom assertions in a new `src/components/ui/Dialog.test.tsx` or extend `src/hooks/useFocusTrap.test.tsx`. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-009
- **Priority score:** 15
- **Notes:** DONE. Reused IMP-009's initialFocusRef: Dialog gained `titleRef` (heading tabIndex=-1), ShortcutSheet focuses its heading, ConfirmDialog focuses Cancel (safe default; destructive action is last in DOM), SettingsView import dialog focuses Done. 188 tests green (8 new, 7/8 mutation-caught); Playwright-verified focus targets, opener restore, Tab loop intact, layout pixel-identical at 1280/390. Note: the global :focus-visible ring still paints on the focused heading (index.css:64) — outline-none does not suppress it; cosmetic only.

### IMP-058 — Make the Habits view honor the `weekStartsOn` setting
- **Status:** DONE
- **Category:** correctness / configuration
- **Type:** bug-fix
- **Area / files:** `src/features/habits/HabitsView.tsx` (`:29`); shared helper `weekdayLabels` in `src/lib/labels.ts` (added by IMP-049)
- **Intent:** IMP-049 made `CalendarView` honor `weekStartsOn`, but `HabitsView` still hardcodes `startOfWeek(addDays(new Date(), -(DAYS - 1)), 1)`, so the habit grid is always Monday-first. A Sunday-start user sees two different week layouts in one app. The gap was logged in IMP-049's notes and re-confirmed during IMP-007; it is still open.
- **Acceptance criteria:**
  1. `HabitsView` reads `weekStartsOn` from `useSetting<AppSettings>('app', DEFAULT_SETTINGS)` and uses it for `windowStart` (`:29`).
  2. The grid's weekday header/column order is derived from `weekStartsOn` (0 → Sun…Sat, 1 → Mon…Sun) via the shared `weekdayLabels` helper — no second local copy of the label order.
  3. The window still spans the same number of days (`DAYS`) and the default (Monday) rendering is unchanged.
- **Verification method:** Playwright at preview: set Settings → "Week starts on" = Sunday, open Habits, assert the first header cell is "Sun" and the first grid date is a Sunday; repeat with Monday. Add a unit test if the ordering is extracted. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-049
- **Priority score:** 15
- **Notes:** DONE. HabitsView reads weekStartsOn via useSetting for windowStart and renders the legend from the shared weekdayLabels helper (no second label-order copy; exactly one startOfWeek definition). 192 tests green; Playwright-verified Sun-first 2026-07-12 vs Mon-first 2026-07-13 at 1280/390, zero console errors. Follow-ups logged: legend is aria-hidden so weekday order is never announced; pre-existing `--elevated:255 255 255` makes empty heatmap cells white-on-white in light theme.

### IMP-016 — Fix "This occurrence" edits leaking to the whole series
- **Status:** DONE
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
- **Notes:** DONE (attempt 2). Scope `occurrence` now writes only `recurrence.overrides` — the base series no longer re-anchors. Attempt 1 failed verification and its 3 issues were fixed: (1) occurrence status now lives solely in `item.occurrences` (one resolver shared by toggleDone/ItemCard; legacy `overrides[key].status` still honored) so the card checkbox is no longer dead; (2) `occurrenceEnd` derives from the resolved start/allDay and can no longer produce an inverted range; (3) series-only fields (urgency/importance/tags/reminders) are disabled and labelled "Applies to the whole series" under this scope, with an honest "Nothing to update" toast. 218 tests green; 23 mutations caught; Playwright-verified with 0 console errors. Minor known gaps: editor draft is the series row (an occurrence's own start/allDay overrides are not shown), the `future`-scope unit test was dropped, and `title`/`notes` overrides are still unrendered.

### IMP-017 — Strip trailing prepositions from parsed quick-add titles
- **Status:** BLOCKED
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
- **Notes:** BLOCKED after MAX_ATTEMPTS=3 (2026-10-05). The spec sample and most cases were solved, but every approach regressed REAL titles by deleting phrasal particles — attempt 1 was ungated ("Log in"->"Log"); attempt 3's `TIME_OR_DATE_PREP` still mutated 96 inputs ("Something to look at 3pm"->"Something to look", "Stand by 3pm"->"Stand"), which is WORSE than HEAD. Files restored to HEAD; IMP-007/010/011 work in quickadd.ts preserved; 218 tests green; nothing committed. Full evidence in `.improve/reports/verify-IMP-017.md`. ROOT CAUSE for a future attempt: consume the introducing preposition WITH the matched time/date expression, and suppress the trailing trim when the candidate word is a phrasal particle (PARTICLE_TAIL guard: sign/log/check/look/stand/follow/turn/put/pick/fill/hand/break/come/go + in/on/by/at). Prefer leaving a harmless dangling preposition over eating a real word.

### IMP-018 — Make quick-added habits recurring (default daily)
- **Status:** DONE
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
- **Notes:** DONE. quickAddToItem falls back to baseRule('daily') (interval 1) when the kind is habit and no recurrence was parsed; explicit rules (every 3 days, mon/wed/fri) still win and non-habits stay null. 222 tests green (+4); Playwright-verified the habit shows on Today/Habits with a streak control and expands Oct 5–Nov 1, zero console errors. Verified no IMP-017 trace reintroduced. Follow-ups logged by the verifier: HabitsView heatmap window ends yesterday so today's completion shows no filled cell (pre-existing); quick-add preview omits the Daily default; Today lists the habit twice.

### IMP-019 — Only mark a reminder fired when it was actually delivered
- **Status:** DONE
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
- **Notes:** DONE. Extracted React-free `src/pwa/delivery.ts` (`deliver`/`deliverDigest`); reminderLog is recorded only when a notification was shown OR the document was visible at toast time, otherwise it is left unrecorded for the next tick (bounded by the unchanged 24h LOOKBACK_MS, no new timers). 231 tests green (+9); mutation-checked; simulations show 1440 hidden ticks -> 0 records/0 toasts and 500 flapping ticks -> exactly 1 toast/1 row (no storm); Playwright-verified live delivery with no duplicate on the next tick, zero console errors. Pre-existing follow-ups logged: concurrent ticks can still double-deliver (reminderLog key is a non-unique index — see IMP-036), and raw IndexedDB writes do not reach useLiveQuery.

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

### IMP-059 — Focus overlays in the mount commit, not 20 ms later
- **Status:** TODO
- **Category:** accessibility / robustness
- **Type:** improvement
- **Area / files:** `src/hooks/useFocusTrap.ts` (`:17-24` `focusInitial`, `:24` `window.setTimeout(focusInitial, 20)`, `:45` cleanup)
- **Intent:** Initial focus is deferred behind a 20 ms timer, so for the first frames after an overlay mounts `document.activeElement` is still `<body>`. A fast typist's first keystrokes can land outside the dialog, and any check that asserts focus in the same tick as the open reports a false failure. IMP-009 made the window user-visible by removing the overlays' `autoFocus` fallback.
- **Acceptance criteria:**
  1. Initial focus is applied in the same commit that mounts the overlay (`useLayoutEffect`, or a frame callback that cannot lose a keystroke) — `document.activeElement` is the target immediately after mount, with no timer.
  2. No timer survives unmount: the `clearTimeout` cleanup (`:45`) is removed or adapted so a late callback cannot steal focus after close.
  3. Focus restore on close and the Tab loop are unchanged; existing `useFocusTrap` tests pass (advance a frame if a case needs one).
- **Verification method:** Add a test in `src/hooks/useFocusTrap.test.tsx` asserting the initial target is focused with no timer advance or `vi.advanceTimersByTime`. Playwright at preview: open QuickAdd with `c`, assert `document.activeElement` is the textbox immediately and that the first typed character appears in it. Run the four gates.
- **Effort:** S    **Risk:** med
- **Depends on:** IMP-009
- **Priority score:** 12
- **Notes:** Source: `discovered-IMP-009.md` D3. Risk is med only because existing tests assert the 20 ms timing; confidence 4 because the right primitive (layout effect vs. `requestAnimationFrame`) is a small design choice.

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

### IMP-061 — `deleteItems([])` must be a no-op
- **Status:** TODO
- **Category:** correctness / undo integrity
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`deleteItems`, `:115-130`; `pushUndo` `:126`, toast `:129`); caller `src/features/shopping/ShoppingView.tsx` (`clearPurchased` `:87-92`)
- **Intent:** With an empty selection the function still runs a write transaction, pushes a `"Delete 0 items"` undo entry, and fires a `"Deleted 0 items"` toast. That clobbers the user's one level of undo safety for an unrelated prior action and reports a deletion that never happened. `clearPurchased` is the natural caller with a possibly-empty array.
- **Acceptance criteria:**
  1. `deleteItems` returns early (`if (!items.length) return;`) before any repository call, undo push, or toast.
  2. With `[]`, `useUiStore`'s undo stack is unchanged (previous undo entry still on top) and no toast is pushed.
  3. Non-empty behavior — descendant cascade, undo restore of selection + descendants, toast count — is unchanged.
- **Verification method:** Add a test in `src/domain/itemActions.test.ts`: push a real undo entry, call `deleteItems([])`, assert the top undo label is still the previous one and the toast list did not grow. Run `npm run test`, then the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-004
- **Priority score:** 10
- **Notes:** Source: `discovered-IMP-004.md` §1. Honest scope: both current call sites already guard it — `ShoppingView`'s button is `disabled={!purchasedCount}` (`:138`) and `ListView` only renders the bulk bar when `selection.size > 0` (`:236`) — so this is a latent API hazard, hence the modest score. The "Delete N items" copy counting only selected rows (not cascaded descendants) stays out of scope as cosmetic.

### IMP-062 — Normalize CRLF in quick-add line splitting
- **Status:** TODO
- **Category:** correctness / data hygiene
- **Type:** bug-fix
- **Area / files:** `src/domain/quickadd.ts` (`splitNoteDraft`, `:352-357`; line split at `:353`)
- **Intent:** `text.split('\n')` leaves a trailing `\r` on every line for CRLF input (text pasted on Windows/Outlook), so a note's stored `title` and each `notes` line end with `\r`. It is invisible in the app but breaks exact string comparison, search, and CSV round-trips. IMP-007 added this helper and left the CRLF case alone.
- **Acceptance criteria:**
  1. Line splitting normalizes `\r\n` and a lone trailing `\r` to `\n` before the first line is taken, so no stored `title` or `notes` value contains `\r`.
  2. A two-line CRLF note yields exactly the same `{ title, notes }` as its LF equivalent.
  3. The 80-char `NOTE_TITLE_MAX` split (IMP-007) still loses no characters.
- **Verification method:** Extend `src/domain/quickadd.test.ts` with `"Buy milk\r\nCall mum\r\n"` asserting `title === 'Buy milk'`, no `\r` in `notes`, and equality with the LF input's result. Run `npm run test`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-007
- **Priority score:** 10
- **Notes:** Source: `discovered-IMP-007.md` §4. Normalize inside `splitNoteDraft` only; the other kind parsers' behavior is pinned by existing tests and must not change.

### IMP-063 — Add CI concurrency groups and stop running the gate twice on `main`
- **Status:** TODO
- **Category:** CI / automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml` (triggers `:3-8`); `.github/workflows/deploy.yml` (`gate` job `:14-15`)
- **Intent:** (a) Neither workflow declares a `concurrency` group, so every push to a PR re-runs the full gate with no cancellation and superseded runs are never dropped. (b) `ci.yml` triggers on `push: [main]` **and** `deploy.yml` calls it via `uses: ./.github/workflows/ci.yml`, so one push to `main` runs typecheck + lint + the full test suite + build twice.
- **Acceptance criteria:**
  1. Both workflows declare a `concurrency` group keyed per ref (e.g. `group: ${{ github.workflow }}-${{ github.ref }}`) with `cancel-in-progress: true`.
  2. Exactly one gate run happens per push to `main`: either the `push: [main]` trigger is removed from `ci.yml` (the `workflow_call` gate in `deploy.yml` still covers `main`), or the `gate` job in `deploy.yml` is removed and `ci.yml` keeps the push trigger — with the chosen option recorded in the commit message.
  3. `deploy.yml` still cannot deploy when the gate fails (`deploy needs: [build, gate]`), and `pull_request` gating is unchanged.
- **Verification method:** `npx prettier --check .github/workflows/ci.yml .github/workflows/deploy.yml`; grep both files for `concurrency:` and count the gate invocations; run `actionlint .github/workflows/*.yml` if available. No source change.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-005
- **Priority score:** 10
- **Notes:** Source: `discovered-IMP-005.md` §1–2. IMP-005's AC1 asked for both triggers, so option (b) may be rejected on that basis — (a) alone still fixes the wasted runs. Actions stay on major tags; SHA pinning belongs to IMP-022/IMP-048.

### IMP-064 — Enforce Prettier in CI and format the drifted source files
- **Status:** TODO
- **Category:** tooling / consistency
- **Type:** tooling
- **Area / files:** `package.json` (`scripts`, `format` `:14`); `.github/workflows/ci.yml`; drifted tracked files `src/pwa/ReminderRuntime.tsx`, `src/db/repository.test.ts`, `src/domain/itemActions.test.ts`; `.prettierignore`
- **Intent:** `npm run format` exists but nothing checks it: `npx prettier --check .` fails at HEAD on 33 files, three of which are tracked source/test files, and `ci.yml` runs only typecheck/lint/test/build, so drift accumulates silently. A blind `npm run format` is also unsafe — it would rewrite generated content (`.kilo/worktrees/…`, `.kilo/kilo.jsonc`, `.improve/reports/*`).
- **Acceptance criteria:**
  1. `package.json` gains a `format:check` script running `prettier --check .`.
  2. The three drifted tracked source files are formatted with no behavioral change — the four gates stay green and the test count is unchanged.
  3. `.prettierignore` excludes the non-source trees so the check is meaningful: `.kilo/worktrees` at minimum, plus `.improve/reports` if generated reports are not meant to be enforced.
  4. `ci.yml` runs `npm run format:check` as a required step next to the existing ones.
  5. `npx prettier --check .` exits 0 when the change is complete.
- **Verification method:** `npx prettier --check .` and `npm run format:check` both exit 0; `npm run typecheck && npm run lint && npm run test && npm run build` all pass; `git diff --stat` shows formatting-only changes to the three files.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:** Source: `discovered-IMP-004.md` §4, confirmed by a fresh `npx prettier --check .` run (33 files, incl. `.improve/FEATURES.md`). `eslint-config-prettier` is already installed, so no lint conflict is expected. Do not reformat `.improve/` reports by hand.

### IMP-065 — Document the preview-build service-worker reset for Playwright verification
- **Status:** TODO
- **Category:** docs / verification process
- **Type:** docs
- **Area / files:** `AGENTS.md` (verification section); `.improve/REPO_PROFILE.md` (§4 "How to verify a change"); `src/pwa/register.ts`; `src/pwa/sw.ts`
- **Intent:** Two independent implementation runs hit the same false regression against `npm run preview`: after a rebuild the page keeps executing the previously precached bundle (workbox `workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/`) and shows vite-plugin-pwa's "A new version is available" prompt, and a `page.goto` to the same `#/…` URL does not reload, so the stale bundle survives. A second harness trap: a synthetic `keydown` dispatched on `document` never propagates down to the focus-trap container, so Tab-wrap checks must dispatch on `document.activeElement`. None of this is written down.
- **Acceptance criteria:**
  1. The verification docs contain a copy-pasteable reset snippet (unregister all service workers, delete all Cache Storage keys) plus a "navigate to `about:blank` and back" step, stated as a prerequisite for any Playwright check against a `preview` build.
  2. The docs note that vite-plugin-pwa's `devOptions` shortcut applies only to `npm run dev`, not `preview`.
  3. The docs record that a `keydown` must be dispatched on `document.activeElement` (not `document`) to reach a focus-trap container.
  4. No duplication of the existing "how to verify" sections; docs only, no source change.
- **Verification method:** Follow the documented steps verbatim in a fresh session against `npm run preview` and confirm a rebuilt change is visible on the first load; `npx prettier --check` on the edited markdown.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:** Source: `discovered-IMP-007.md` §1 and `discovered-IMP-009.md` D1 (the same trap, twice). This is a process note, not a product defect — the PWA caching is correct and must not be "fixed". IMP-046 may rename `agents.md` to `AGENTS.md`; keep the section findable by heading.

### IMP-066 — Cover the remaining `useData` hooks and drop the unreachable guards
- **Status:** TODO
- **Category:** test coverage / cleanup
- **Type:** test
- **Area / files:** `src/hooks/useData.ts` (`useLists` `:25-28`, `useChildren` `:30-37`, `useSetting` `:39-46`, `EMPTY_ITEMS` `:6`); `src/hooks/useData.test.tsx`
- **Intent:** IMP-008's new test file covers only `useItems`/`useArchivedItems`, and its `useLiveQuery` mock ignores the dependency argument entirely — so `useItem` re-reading on `id` change, `useSetting` re-reading on `key` change, and the `JSON.stringify(fallback)` dep (a deep serialize of the whole `DEFAULT_SETTINGS` object on every render of all `useSetting('app', …)` call sites) are unverified. The same file still carries three unreachable nullish guards and an unjustifiable `as T` cast.
- **Acceptance criteria:**
  1. The test harness's `useLiveQuery` mock captures `(querier, deps)` so dep-driven re-reads are assertable.
  2. Tests cover `useItem` (re-reads when `id` changes; `undefined` for a nullish id), `useLists`, `useChildren` (re-reads on `parentId` change), and `useSetting` (re-reads on `key` change; returns the stored value, else the fallback).
  3. `useSetting`'s per-render `JSON.stringify(fallback)` dep is replaced with a stable, non-re-serializing dep (module-level `WeakMap` cache or `useMemo`) without changing which values trigger a re-read.
  4. The unreachable `?? []` / `?? fallback` guards and the `as T` cast are removed, and `npm run typecheck` passes without a new cast.
  5. All four gates green.
- **Verification method:** `npm run test` reports the new cases in `src/hooks/useData.test.tsx`; then `npm run typecheck && npm run lint && npm run build`. Mutation-check the dep test: it must fail if the dep array is emptied.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-008
- **Priority score:** 10
- **Notes:** Source: `discovered-IMP-008.md` §1, §2, §5. `EMPTY_ITEMS` (`:6`) is one array shared by every caller on an empty DB — nothing mutates it today, so it is a latent aliasing hazard only; if this work touches it, prefer a getter over a module constant. IMP-043 (`no-explicit-any`) will reject a reintroduced cast.

### IMP-067 — Make the CI gate a required status check on `main` (NEEDS-HUMAN)
- **Status:** NEEDS-HUMAN
- **Category:** CI / process
- **Type:** tooling
- **Area / files:** repository settings (branch protection / ruleset for `main`); check names from `.github/workflows/ci.yml` (`gate` → "Typecheck, lint, test, build")
- **Intent:** `deploy.yml` blocks deploying from a failed gate (`deploy needs: [build, gate]`), but nothing makes the gate **required to merge** — that lives in branch-protection rules, which are not versioned. A red PR can be merged and the failure surfaces only on the next `main` push, after the branch has landed.
- **Acceptance criteria:**
  1. `main` has a branch-protection/ruleset rule requiring the `CI / gate` check (and the Pages build check, if desired) before merge.
  2. Direct pushes to `main` are disallowed except through the protected path, or the rule documents the intended exception.
  3. The requirement is recorded in `README.md`/`AGENTS.md` so it survives repo re-creation.
- **Verification method:** Not verifiable in-repo — requires a human to configure the rule. Sanity check locally: no merge commit on `main` whose PR had a red gate after the rule is in place.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-005
- **Priority score:** 10
- **Notes:** NEEDS-HUMAN: branch-protection rules are not versioned — only the repo administrator can apply them, and the acceptance criteria cannot be checked in-repo. Scored 10 rather than higher precisely because it is unverifiable here. Already flagged as a follow-up in IMP-005's notes.

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

### IMP-060 — Share one items live query instead of one per component
- **Status:** TODO
- **Category:** performance / data flow
- **Type:** improvement
- **Area / files:** `src/hooks/useData.ts` (`useItems` `:8-14`, `useArchivedItems` `:16-19`); 12 call sites under `src/features/{bills,calendar,command,goals,habits,list,matrix,notes,settings,shopping,today}/` and `src/pwa/ReminderRuntime.tsx`
- **Intent:** Each of the 12 `useItems()` call sites builds its own `Dexie.liveQuery` observable over `itemRepo.all()`, so one write to `items` re-runs `toArray()` 12 times and re-renders 12 components — including views the write cannot affect (adding a shopping item re-renders `CalendarView`, `MatrixView`, `GoalsView`, `ReminderRuntime`, …). IMP-008 made each of those renders cheap but did not remove the fan-out.
- **Acceptance criteria:**
  1. A single shared items subscription (module-scope `Dexie.liveQuery` exposed through a subscription-counted store or a small `useSyncExternalStore` cache) backs both `useItems` and `useArchivedItems`.
  2. One write to the `items` table results in exactly **one** `itemRepo.all()` execution, and all call sites receive the same array instance for the same data.
  3. `useItems(includeArchived)` keeps its current filter semantics and its referential stability guarantee (IMP-008) when data and the flag are unchanged.
  4. No consumer call site needs to change; the shared empty array stays safe (never hand a shared array to a mutating consumer — see IMP-066's note on `EMPTY_ITEMS`).
- **Verification method:** Add a jsdom test in `src/hooks/useData.test.tsx` mounting two probe components over the mocked live query and asserting a single query execution plus identical array identity for both. Run the four gates; Playwright at preview: create one item and confirm every route still renders with no console errors.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-008
- **Priority score:** 7.5
- **Notes:** Source: `discovered-IMP-008.md` §4 — explicitly out of scope for IMP-008 because it restructures data flow across 12 files. 12 production call sites counted (not the 13 reported, which included the hook and its test). `useItems` is deliberately the only hook refactored; `useItem`/`useChildren` keep their per-site queries.

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

### IMP-068 — Eliminate the intermittent unhandled rejection in the boot smoke test
- **Status:** DONE
- **Category:** test reliability / error handling
- **Type:** bug-fix
- **Area / files:** `src/test/app.smoke.test.tsx`; `src/db/migrations/legacyTasks.ts` (`runLegacyMigration`, `:219`); boot path in `src/App.tsx`
- **Intent:** `runLegacyMigration` reads `localStorage` from a fire-and-forget promise chain started during boot. In some runs the read happens after the test environment tears down, producing an unhandled `storage.getItem` rejection. Vitest reports it as an error and it can intermittently fail the new CI gate (`npm run test` in `.github/workflows/ci.yml`), i.e. a flaky build caused by real boot code, not the test.
- **Acceptance criteria:**
  1. `npm run test` produces zero unhandled errors across at least 10 consecutive full-suite runs.
  2. The boot-time migration promise is either awaited/caught at the call site or otherwise cannot reject after the environment is gone.
  3. Migration still runs exactly once and its result is still observable (existing migration tests stay green).
  4. No behavior change for users: the migration still executes on boot and still records its settings flag.
- **Verification method:** Run `npm run test` 10+ times in a row and grep the output for "Unhandled"; all runs must exit 0 with no unhandled error. Also run with `--sequence.shuffle` a few times. Confirm `npm run typecheck && npm run lint` clean.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:** DONE. PREMISE CORRECTED: this was NOT a teardown race — Node 25 exposes `globalThis.localStorage` as a plain-object webstorage stub whose `getItem`/`setItem` are undefined, so the `typeof localStorage !== 'undefined'` guard passed and `storage.getItem` threw a TypeError into a void-ed boot promise on every mount; only Vitest's *reporting* was intermittent. Fixed at the source with an `ambientLegacyStorage()` capability probe (degrades to the existing "nothing to migrate" return) plus a catch+warn at the boot call site. No suppression, no console filtering, migration logic untouched. 175 tests green over 10 consecutive runs + 4 shuffled; browser path verified to still migrate (2 items, backups + flag written). Follow-up of the same class: `SettingsView.rerunMigration` remains unhardened (CI runs Node 20 and never hits this).

---

_End of backlog (64 items). Source findings not promoted to items (lower impact or duplicate): calendar `+N more` was promoted (IMP-053); still below the cut are ICS all-day `DTEND`, command-palette active-row scroll, ListView selection-vs-filter, bills paid-state vs occurrence-status coupling, goals checklist child-kind filtering, goals inline progress editing, keyboard drag path, loading skeleton before `useLiveQuery` resolves, overdue-window cap in TodayView, shopping `window.prompt`/row delete, `defaultView` dead setting, migration atomicity/re-run overwrite, body-scroll-lock refcount, `useFocusTrap` hidden-element filter, `Tabs` keyboard/`type=button`, `timestampedName` UTC day, notification-action no-op when no window, reminder-editor absolute-reminder display, `until`/`count` exception semantics, undo-stack cap and toast-timer leaks, and pure dead-code removal. Each remains a valid future follow-up._

_Second pass (absorbed from `.improve/reports/discovered-IMP-*.md`, promoted as IMP-057…IMP-067): overlay initial focus for the remaining dialogs, `HabitsView` week start, `useFocusTrap`'s 20 ms focus delay, the per-component duplicate `toArray()` subscription, the empty-selection undo clobber, CRLF quick-add lines, CI concurrency/duplicate runs, Prettier enforcement, the preview SW reset procedure, the remaining `useData` hook tests, and required branch protection. Left below the cut from the same reports: the per-selection descendant walk in bulk delete (N indexed queries, not worth it while selections are hand-picked), the "Delete N items" copy not counting cascaded rows, `goalProgress` appending `unit` to checklist labels and its differently shaped non-goal result (both label-only, and pinned by existing tests), the `binary`-metric `current` path that can report 100% while `status` is `todo` (unreachable — the editor never writes `current` for binary), the missing `maxLength` on the editor title field versus the 80-char quick-add cap (fixing it is a product decision — cap vs. truncate cards), SHA-pinning of GitHub Actions (rides with IMP-022/IMP-048), and the `pushToast` `setTimeout` left live under test (already noted in IMP-025's helper)._

_Rejected during critic review (not checkable / premise false / not a defect): the former history-blob item (`buildHistory` already skips `occurrences` at `itemActions.ts:32`), the former hardcoded-color item (badge classes in `labels.ts` already carry `dark:` variants; `bg-white` is a cosmetic knob only), and the former "reset all data" item (the confirm copy already enumerates exactly the tables it clears). The former standalone `npm ci` item was merged into IMP-005._
