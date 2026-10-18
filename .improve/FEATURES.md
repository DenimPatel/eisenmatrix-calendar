# FEATURES.md — Prioritized Improvement Backlog

Repo: `eisenmatrix-calendar` · Baseline SHA: `b9d23246b948187c0239e8c95373e3e1f27cc43f`
Generated: 2026-10-04 · Reviewed 2026-10-04 (backlog critic) and 2026-10-05 (discovery absorption) against the recon reports, the 27 `.improve/reports/discovered-IMP-*.md` files and the actual source.

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
- **Status:** DONE
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
  2. For timed events, `UNTIL` is a floating date-time with no `Z`, matching the floating `DTSTART` (amended by IMP-074).
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

### IMP-069 — Make editor-created items undoable
- **Status:** DONE
- **Category:** correctness / undo integrity
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`saveItem`, `:76-92`; create branch `:82-84`, undo pushed only for edits `:85-89`); contrast `createItemPersisted` `:59-64`; caller `src/features/item/ItemEditorSheet.tsx:193`
- **Intent:** `saveItem` pushes an undo entry only when the row already exists, so a task created from the editor (`N` → title → Save) is **not** undoable while a quick-added one is. `⌘Z` after creating silently does nothing — the undo stack is empty, not the shortcut broken — so the user has to find and delete the item by hand.
- **Acceptance criteria:**
  1. The create branch of `saveItem` pushes an undo entry with the same `Create "<title>"` shape `createItemPersisted` uses (`:59-64`), whose closure removes the new row.
  2. After creating a task in the editor and invoking the top undo entry, the row is gone from IndexedDB and the undo stack is back to its previous depth.
  3. The edit branch keeps its existing `Edit "<title>"` entry, and `options.silent` still suppresses only the toast — never the undo entry.
  4. Saving an existing item does not push two entries.
- **Verification method:** Add a case in `src/domain/itemActions.test.ts` (fake-indexeddb): call `saveItem(createItem({ kind: 'task', title: 'New task' }))`, drain `useUiStore`'s undo stack, invoke the top closure, assert the row is gone and the previous entry is on top again. Playwright at preview: press `N`, save a title, press `⌘+Z`, assert the card disappears. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Source: `discovered-IMP-013.md` §3. `itemRepo.create` is a `put` (`src/db/repository.ts:43-46`), so the edit branch's restore-by-`create` is safe; only the missing create entry is in scope. IMP-025's undo helper is the natural home for the test. DONE 2026-10-17: create branch pushes `Create "<title>"` closure; verified PASS (332 tests, preview undo removes row, one entry per edit). Commit pending.

### IMP-070 — Habits created outside quick add must still get the daily default
- **Status:** DONE
- **Category:** correctness / feature gap
- **Type:** bug-fix
- **Area / files:** `src/domain/itemFactory.ts` (`createItem`, `:60` hardcodes `recurrence: null`); `src/features/habits/HabitsView.tsx:75` and `:90` (`createItem({ kind: 'habit', start: today })`); the quick-add copy of the default `src/domain/quickadd.ts:432-433`
- **Intent:** IMP-018 defaulted quick-added habits to daily, but `createItem` still hardcodes `recurrence: null`, so both "New habit" buttons and the editor produce a habit that exists on its start day only — exactly the symptom IMP-018 fixed (no expansion, wrong "done today", no streak). Two code paths now disagree about what a habit is.
- **Acceptance criteria:**
  1. `createItem({ kind: 'habit' })` with no caller-supplied rule yields a daily `interval: 1` recurrence; a caller-supplied `recurrence` always wins.
  2. "New habit" in `HabitsView` (`:75`, `:90`) produces a habit that expands for the next 7 days, not just its start day.
  3. `quickAddToItem` keeps its explicit default (`:433`) and its output is unchanged; no other kind gains a default rule.
  4. Pre-existing single-occurrence habits are **not** rewritten — this item adds no migration.
- **Verification method:** Unit-test `createItem` for `habit` (default rule, explicit rule preserved) plus a non-habit control in `src/domain/itemFactory.test.ts` or an existing domain test; Playwright at preview: click "New habit", save, and assert the Habits grid shows filled cells for the next 7 days. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Source: `discovered-IMP-018.md` §2 — the sibling of IMP-018, which applied the same default to the quick-add path only. It is not a hard dependency: the two changes touch disjoint code (`createItem` vs. `quickAddToItem`), which is also why they must be done together for the behavior to be consistent. IMP-018's §3 (a one-time backfill for habits already stored without a rule) is deliberately excluded: rewriting stored series is high blast radius and belongs in Settings → Data behind a confirmation. DONE 2026-10-17: createItem defaults habits to daily, explicit rules win, no migration; verified PASS (337 tests, preview stores daily rule, rule-less habit untouched). Commit pending.

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
- **Status:** DONE
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
- **Notes:** DONE. parseBackup rejects a present-but-foreign `app` and a `version > BACKUP_VERSION` before any Dexie write (SettingsView importJSON already surfaces the message via the IMP-015 toast); the dead `!Array.isArray(items)` branch was removed after proving it fired on 0/13 payload shapes. Back-compat preserved and probed: older version with marker, missing `app`, legacy `tasks` array, non-array `items`, and a real export->import round-trip all still import. 236 tests green; each guard mutation caught.

### IMP-021 — Gate notification delivery on the `notificationsEnabled` setting
- **Status:** DONE
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
- **Notes:** Chosen behavior is gating (keep the toggle); document it in the copy. `deliver()` gains a fail-closed `notifyEnabled` option so only the device-notification arm is gated (in-app toasts and the digest fallback are untouched), and `ReminderRuntime` reads the setting through the live query with it in the effect deps so a flip applies without a reload. Back-compat: `src/db/migrations/notificationGate.ts` seeds `notificationsEnabled` to true exactly once for installations that already held browser permission, so no existing user silently loses device notifications; it never overrides an explicit stored value and leaves a permission-less install unmarked. Settings exposes a single switch (the duplicate Enable button was removed) and the copy no longer claims in-app banners "always" appear. 258 tests green; all gate mutations caught.

### IMP-022 — Add Dependabot and an `npm audit` CI step
- **Status:** DONE
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
- **Notes:** DONE. Added .github/dependabot.yml (weekly `npm` at `/` and `github-actions`) and a `npm audit --audit-level=critical` step in ci.yml ordered after `npm ci`; no continue-on-error, no auto-merge, no dependency or lockfile changes. Verified: current 12 advisories (9 high, 0 critical) exit 0 at critical and exit 1 at high, matching the intended policy; both YAMLs parse and pass prettier; 258 tests green. Staging must stay explicit (never `git add -A` — it would sweep `.kilo/`).

### IMP-023 — Correct `count` when splitting a recurring series
- **Status:** DONE
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
- **Notes:** DONE (attempt 2). splitSeries now materialises the implied byWeekday/byMonthDay/byMonth from the PRE-split anchor so no later occurrence drifts, gives the tail `count - consumed`, clamps the head's until, and both expansion loops cap on `count !== undefined` so a fully consumed series yields an empty tail. Also null-guards `parseLocalDate(fromKey)` and stops updateRecurring's future branch overwriting the tail anchor. Attempt 1 was rejected for date drift on implicit monthly (Oct 31 -> Oct 30) and a `count:0` tail exploding to 27,757 occurrences; both fixed. 279 tests green; property sweep of 113,100 splits over 20,244 series shows head∪tail == unsplit keys with 0 defects; 4 mutations caught. Disclosed: the tail now persists the implied rule fields (correct); head exception copying (D4) still open.

### IMP-052 — Fold long ICS lines per RFC 5545
- **Status:** DONE
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
- **Notes:** DONE. Added a pure exported `foldLine` (TextEncoder, octet-based, code-point-safe, 75-octet cap, space-prefixed continuations) and folded every emitted line via `lines.flatMap(foldLine).join('\r\n')`. 282 tests green (+3: 200-char title, multi-byte round-trip, exact 75/76-octet boundary); 5 mutations caught. Independently validated with a strict byte-level unfold parser over 12,974 lines (max physical line exactly 75 octets, strict UTF-8 per line) and a 408-export fuzz proving the unfolded output is byte-identical to the pre-change exporter. Pre-existing gaps disclosed: raw CR in content is not escaped and the export lacks a final CRLF.

### IMP-053 — Make the calendar "+N more" affordance open the full list
- **Status:** DONE
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
- **Notes:** DONE. Month and year `+N more` affordances are now real `aria-expanded` toggle buttons that expand in place, so every capped occurrence is reachable and editable; default (<=3 month / <=5 year) rendering unchanged. 287 tests green (+5, mutation-checked); Playwright-verified 6 items -> `+3 more` -> all 6 open the editor and toggle done, occurrence status survives expand/collapse, focus stays on the toggle, both views, zero console errors. Follow-ups logged: only one month cell expands at a time, the year toggle lacks month context in its accessible name, `expandedDay` is not cleared on month navigation, and the 390px month cell is 52px so the label truncates (pre-existing grid issue).

### IMP-054 — Preserve parsed quick-add data when the kind is changed
- **Status:** DONE
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
- **Notes:** Extract the kind-switch data merge into a pure helper for testability. DONE 2026-10-17: `quickAddDataFor` rebuilds new-kind defaults plus compatible parsed fields; round-trip and commit-while-bill tests added after a verifier caught a vacuous first test. Verified PASS (342 tests, browser round-trip, zero console errors). Commit pending.

### IMP-055 — Occurrence-scoped Delete should skip, not delete the series
- **Status:** DONE
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
- **Notes:** DONE. Occurrence-scoped Delete now skips only that occurrence (control reads "Skip this occurrence", wired to the previously-unused `skipOccurrence`, idempotent and reading the persisted row) instead of destroying the series; confirmation copy is scope-specific; `future`-scope Delete is disabled with explanatory copy pending IMP-037. Series-scoped Delete still removes the series plus descendants with undo, and IMP-016 is unregressed. 310 tests green (+8, 4 domain + 4 editor jsdom); 3 mutations caught; Playwright-verified live (one row survives, `exceptions:["2026-10-19"]`) and a skipped occurrence is excluded from reminders. Follow-ups logged: the hint copy still says "Delete skips" while the button says "Skip this occurrence"; `handleDelete` lacks a programmatic `deleteUnavailable` guard; the skip toast has no Undo (delete does); the alert dialog lacks a focus trap/Escape; a hardcoded rose token.

### IMP-056 — Prune expired snooze reminders
- **Status:** DONE
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
- **Notes:** Run the prune alongside the existing `reminderLogRepo.pruneBefore` boot effect in `ReminderRuntime`. DONE (commit to follow). 3 implement→verify cycles: attempt 1 ranked the soonest absolute above a `now - LOOKBACK_MS` cutoff, which let an already-delivered snooze delete a pending one (data loss); attempt 2 shipped the correct classification but introduced a duplicate-delivery regression (the prune's `items` write rebuilt the tick effect mid-flight). Final: `pruneExpiredAbsolute` deletes only rows strictly outside the delivery window (`absolute <= now - lookbackMs`), `withSnooze` replaces instead of appends, and a boot tick-gate keeps the prune off the boot tick's trigger path so delivery stays exactly-once. Files: `src/domain/reminders.ts`, `src/domain/itemActions.ts`, `src/pwa/ReminderRuntime.tsx`, plus `src/pwa/ReminderRuntime.delivery.test.tsx`. Verified PASS by an independent reviewer (32 files / 329 tests, 6 consecutive green runs; gate-removal mutation fails 12/12; browser cold-reload exactly-once 3/3). Left open and picked up as items: IMP-036 (atomic dedupe) unchanged. Discoveries D1–D5 in `reports/discovered-IMP-056.md`.

### IMP-059 — Focus overlays in the mount commit, not 20 ms later
- **Status:** DONE
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
- **Notes:** Source: `discovered-IMP-009.md` D3. Risk is med only because existing tests assert the 20 ms timing; confidence 4 because the right primitive (layout effect vs. `requestAnimationFrame`) is a small design choice. DONE 2026-10-17: useLayoutEffect focuses in the mount commit; timer and cleanup removed; Tab loop/restore verified. Verified PASS (343 tests, preview `c` focuses immediately, 390px, zero console errors). Commit pending.

### IMP-071 — Backfill `data` so a row without it cannot crash the editor
- **Status:** DONE
- **Category:** correctness / robustness
- **Type:** bug-fix
- **Area / files:** `src/features/item/KindFields.tsx:20` (`item.data.estimateMinutes` and ~30 sibling unguarded reads); `src/domain/itemFactory.ts:120` (`normalizeItem`'s `data: { ...base.data, ... }`); `src/lib/ics.ts:100` (`item.data.location`)
- **Intent:** every kind field reads `item.data.X` unguarded, so opening the editor for a row that bypassed `createItem`/`normalizeItem` (a hand-written legacy row, an import edge case) throws `TypeError: Cannot read properties of undefined` and takes down the whole React tree — a blank screen, not a dialog error.
- **Acceptance criteria:**
  1. `normalizeItem` backfills a missing or `null` `data` with `defaultDataFor(kind)` (the spread at `:120` covers a partial payload; a wholly absent `data` must not survive), and `csvToItems`/`parseBackup` keep producing a full row.
  2. Opening the editor for an item stored with no `data` renders the Details tab with that kind's default fields instead of throwing.
  3. No `TypeError` from `KindFields` or `itemsToICS` for an item whose `data` is `undefined`.
- **Verification method:** Extend `src/lib/backup.test.ts` (or `csv.test.ts`) with a payload item lacking `data` and assert `normalizeItem` returns the kind defaults; Playwright: seed such a row, open the editor, assert the dialog renders. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:** Source: `discovered-IMP-012.md` §2. Overlaps IMP-038's import validator — if that lands first it may already close the import path, but the reported repro was a hand-written row that never passes through an import, so both the `normalizeItem` backfill and the defensive reads are needed. DONE 2026-10-17: normalizeItem merges kind defaults over missing/null/partial data, KindFields normalizes its input, ICS guards location; verified PASS (355 tests, seeded no-data row opens editor, zero console errors). Follow-up IMP-088 covers residual view-level crashes. Commit pending.

### IMP-072 — Refuse an unrecognized import file instead of reporting success
- **Status:** DONE
- **Category:** correctness / data integrity
- **Type:** bug-fix
- **Area / files:** `src/lib/backup.ts:55-59` (`items` falls back to `[]`); `src/lib/csv.ts:124-127` (`records.length < 2 → return []`), `:137` (`title: get('title')`); callers `src/features/settings/SettingsView.tsx:102-118`, `:122-140`
- **Intent:** both importers are total functions, so picking the wrong file reports success. `parseBackup('{"hello":"world"}')` yields 0 items and Settings toasts "Backup imported · Imported 0 items"; a junk `.csv` containing commas or newlines parses its first junk line as the header and imports N **untitled blank** items into the database with no warning.
- **Acceptance criteria:**
  1. `csvToItems` rejects a payload whose header row contains none of the exported `CSV_COLUMNS` keys, and rows whose resolved `title` is empty are skipped and counted, never persisted as blanks.
  2. `parseBackup` throws a clear error when the payload carries neither `items` nor `tasks`; a legacy `{ version: 1 }` payload that does carry `items: []` still imports.
  3. Both failures surface as the existing `Import failed:` error toast, no success toast appears, and no row reaches Dexie.
  4. Real exports still round-trip: `exportJSON → importJSON` and `exportCSV → importCSV` report the same counts as before.
- **Verification method:** Extend `src/lib/csv.test.ts` with a junk payload asserting a throw and no blank items, and `src/lib/backup.test.ts` with `{"hello":"world"}` asserting a throw; keep the round-trip cases green. Playwright: import a junk `.csv` and assert an error toast and an unchanged item count. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-020
- **Priority score:** 12
- **Notes:** Source: `discovered-IMP-015.md` §1–2 and `discovered-IMP-020.md` §1. Complements IMP-020's identity/version guards, which cannot see a payload with no identity field at all. `parseBackup`'s unvalidated `lists` cast (`:60,62`) rides with IMP-038 rather than here. DONE 2026-10-17: header/identity validation before any write, blank-title rows skipped and counted, round-trips intact; verified PASS (360 tests, junk CSV/JSON show Import failed with unchanged count, zero console errors). Commit pending.

### IMP-073 — Consume every schedule token in quick add; stop eating ordinary words
- **Status:** DONE
- **Category:** correctness / input parsing
- **Type:** bug-fix
- **Area / files:** `src/domain/quickadd.ts:175-179` (the recurrence lexer only knows `every <n> <unit>` / `every <unit>`), `:210-229` (a single `weekdayListRe.exec`; a bare `every` is never consumed)
- **Intent:** three leaks of the same kind. (a) `'gym every fri'` leaves the title `Gym every` — a bare `every` matches no branch. (b) The weekday list is matched once, so a second weekday survives: `'sun the tomatoes fri'` → title `The tomatoes fri`. (c) A lone weekday is consumed wherever it appears, so `sun` used as a verb silently re-dates the item **and** deletes the word from the title (recorded as a caveat in IMP-010's notes).
- **Acceptance criteria:**
  1. A leftover bare `every` is consumed once a weekday or `every <unit>` recurrence has been established — `'gym every fri'` yields title `Gym` and a weekly rule with `byWeekday: [5]`.
  2. Every weekday group in the input is consumed (loop, not a single `exec`); `'sun the tomatoes fri'` leaves no weekday token in the title.
  3. A lone weekday is consumed as a date hint only when it ends the input or immediately follows `on|every|at|start`; otherwise it stays in the title and the item is **not** re-dated.
  4. IMP-010/IMP-011's verified cases are unchanged: `'gym fri'`, `'call mon'`, `'mon/wed/fri'`, `'next fri'` and every `'on the <N>'` case keep their current title and date.
- **Verification method:** Extend `src/domain/quickadd.test.ts` with the three repros above plus the AC4 control set; mutation-check that removing each gate fails a case. Run `npm run test`, then a differential sweep of the existing input corpus asserting byte-identical output outside the three new shapes. Run the four gates.
- **Effort:** S    **Risk:** med
- **Depends on:** IMP-010, IMP-011
- **Priority score:** 12
- **Notes:** Source: `discovered-IMP-010.md` §1 and §3. Deliberately **not** the IMP-017 approach: nothing here trims a preposition or a trailing particle from a title — it only decides whether a matched schedule token is consumed. AC4 is the regression guard IMP-017 lacked. DONE 2026-10-17: loops weekday groups, consumes bare `every`, gates lone weekdays by position; attempt 2 restored time/relative-date tails (`gym fri 7am`) and tagged `every week #tag fri`. AC2's "no weekday token" wording is subordinate to AC3 for a leading non-hint weekday (`sun the tomatoes` keeps `Sun`). Verified PASS (368 tests, preview, 80+ input differential vs HEAD, zero console errors). Commit pending.

### IMP-074 — Emit a floating `UNTIL` to match a floating `DTSTART` in ICS
- **Status:** DONE
- **Category:** interoperability / correctness
- **Type:** bug-fix
- **Area / files:** `src/lib/ics.ts:48` (`UNTIL=…T235959Z`), `:35` (`dateOnlyStart = false` default), `:104` (timed `DTSTART` is floating), `:110` (the call site)
- **Intent:** a timed event exports `DTSTART:20240506T090000` — floating, no `Z` and no `TZID` — alongside `UNTIL=20240630T235959Z`, even though `dateOnly(until)` was built from **local** `getFullYear/getMonth/getDate`. RFC 5545 §3.3.10 requires `UNTIL` to match the `DTSTART` value type, so the `Z` claims a UTC instant that was never computed; an importer in a negative-UTC-offset zone can resolve the bound to the previous day and drop the final occurrence — the same off-by-one IMP-014 fixed one clause down. The `dateOnlyStart = false` default separately lets a future caller that forgets the flag re-emit `Z` for a date-only series, which is precisely the bug IMP-014 fixed.
- **Acceptance criteria:**
  1. A timed series exports `UNTIL=YYYYMMDDT235959` with no `Z`, matching its floating `DTSTART`; the all-day branch keeps IMP-014's bare `YYYYMMDD` and never gains a time.
  2. `recurrenceToRRule`'s value-type argument is **required** (no default), so `itemsToICS` and the tests cannot disagree; `npm run typecheck` fails if a default is reintroduced.
  3. No local→UTC shift: the emitted calendar day equals the stored `until` day for `TZ` in `-11..+14`.
  4. Timed output for rules without `until` is byte-identical to HEAD.
- **Verification method:** Extend `src/lib/ics.test.ts` with a timed rule carrying `until` and assert the exact `RRULE` line; run the suite under `TZ=-11` and `TZ=+14`; confirm `npm run typecheck` errors if the parameter's default is restored. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-014
- **Priority score:** 12
- **Notes:** Source: `discovered-IMP-014.md` §1 and §4. This **amends IMP-014 AC2** ("for timed events `UNTIL` remains a UTC date-time"), which was written before the floating-`DTSTART` mismatch was found. The RFC clause is objective, so this is not a human decision, but the implementer must update that criterion's wording in the same change. DONE 2026-10-17: timed UNTIL is floating, all-day bare, value-type arg required, TZ -11/+14 preserve the day, no-until output byte-identical. Verified PASS (370 tests). Commit pending.

### IMP-075 — Export multi-day all-day items with an exclusive `DTEND`
- **Status:** DONE
- **Category:** interoperability / correctness
- **Type:** bug-fix
- **Area / files:** `src/lib/ics.ts:107-109` (the all-day branch emits `DTSTART;VALUE=DATE` and nothing else)
- **Intent:** RFC 5545 gives a `DATE` `DTSTART` an implicit one-day duration, so an all-day item with `start: '2024-05-06', end: '2024-05-09'` exports as a **single-day** event and the extra days are silently dropped in every importer.
- **Acceptance criteria:**
  1. An all-day item spanning more than one day emits `DTEND;VALUE=DATE:<end + 1 day>` (exclusive, RFC 5545 §3.6.1).
  2. A one-day all-day item emits no `DTEND` — byte-identical to HEAD.
  3. Timed items are untouched: `DTSTART`/`DTEND` keep the floating timed form.
  4. Month-end clamping holds (`2024-01-31` + 3 days → a valid February `DTEND`).
- **Verification method:** Extend `src/lib/ics.test.ts` with a 4-day all-day item and a one-day control, asserting the exact `DTSTART`/`DTEND` lines; run `npm run test` and the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12
- **Notes:** Source: `discovered-IMP-014.md` §2; previously named in this backlog's closing summary as a below-the-cut follow-up. Same file as IMP-052 (line folding) — do both in one pass if the file is already open. DONE 2026-10-17: multi-day all-day emits exclusive DTEND, one-day/timed byte-identical to HEAD, month/year rollover verified. Verified PASS (373 tests). Commit pending.

### IMP-076 — `setStatus` must merge into the persisted occurrence map
- **Status:** DONE
- **Category:** correctness / concurrency
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`occurrenceStateFor`, `:152-165`, spreads the caller's map; `setStatus`, `:183-198`); caller `src/features/habits/HabitsView.tsx:60-63` (`markToday` toggles with the render-time `item`)
- **Intent:** `occurrenceStateFor` spreads the **caller's** `item.occurrences` into the patch, so two writes for the same item that start from one render snapshot (two habit cards toggled in quick succession, or a double-fired `markToday`) each persist a whole map missing the other's entry — the second write silently drops the first toggle. IMP-050 made the *streak* authoritative but left the occurrence map itself a read-modify-write on a prop.
- **Acceptance criteria:**
  1. The occurrence merge is applied to the **persisted** map (re-read inside the action), so a write never drops a sibling occurrence written after the caller's snapshot.
  2. Calling `setStatus(item, 'done', k1)` then `setStatus(item, 'done', k2)` from the same stale `item` persists both `k1` and `k2`.
  3. `toggleDone`'s habit streak still derives from the persisted post-toggle state (IMP-050 AC1) and still shares the occurrence write's single undo entry.
  4. A genuinely no-op write (same status, same `completedAt`) still writes nothing and pushes no undo entry.
- **Verification method:** Add the stale-snapshot case to `src/domain/itemActions.test.ts` (fake-indexeddb): toggle two occurrences of one series from one captured `item`, assert both persisted, then invoke the pushed undo and assert both are restored. Run the four gates.
- **Effort:** S    **Risk:** med
- **Depends on:** IMP-050
- **Priority score:** 12
- **Notes:** Source: `discovered-IMP-050.md` D2. Fix shape mirrors IMP-050's re-read. The second read must happen inside the action: React batches the two clicks into one tick, so an effect-based reconciliation would not help. DONE 2026-10-17: setStatus re-reads and merges into the persisted occurrence map, no-op writes stay no-ops, one undo entry per streak write. Verified PASS (375 tests, sequential stale-snapshot reproduction, undo restores both). Follow-up IMP-089 covers truly concurrent unawaited calls. Commit 8b46ffa.

### IMP-024 — Make all mobile bottom-nav destinations reachable at 390px
- **Status:** DONE
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
- **Notes:** DONE (attempt 3; attempts 1-2 were rejected by verification). Replaced the 564px horizontal scroller with a `grid-cols-5` two-row layout so all 10 destinations are visible and tappable at 390px and 320px with no swipe, no clipping and no page scroll; the active cell is a solid `bg-accent` pill that highlights on first paint including deep links, targets are 73x44, and the 1280px rail is byte-identical. Attempt 1 kept the scroller and added a gradient cue (verifier: cue broke WCAG 1.4.3 contrast 6.96:1 -> 1.00:1 over the Bills/Lists labels and created a mis-tap); attempt 2's taller bar then let the toast `Undo` button overlap nav row 1 (destructive mis-tap) and lacked a safe-area inset. Final fix derives the toast and `main` offsets from the measured nav height via a published CSS variable plus a live `env(safe-area-inset-bottom)` term. 302 tests green (31 files); a 9,945-point hit test found 0 foreign elements over the bar and the item stayed deleted after every tap; clearance held at 15px across a 98->152px height change; 8 mutations caught. Residual nit: `publishMobileNavHeight` in src/lib/layout.ts does not guard a non-finite height (unreachable today).

### IMP-025 — Add tests for the `itemActions` write path
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). Extended `src/domain/itemActions.test.ts` with saveItem create/edit history + undo, plain and occurrence toggleDone, and confirmed existing descendant/updateRecurring coverage. Verified PASS (typecheck/lint, 33 files / 378 tests). Reports: `.improve/reports/impl-IMP-025.md`, `verify-IMP-025.md`.

### IMP-026 — Add unit tests for `eisenhower.ts`
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). New `eisenhower.test.ts` (15 tests) covers quadrant mapping incl. defaults, score ordering/monotonicity and partitioning. Verified PASS (typecheck/lint, 39 files / 419 tests, build). Reports: impl-IMP-026.md, verify-IMP-026.md.

### IMP-027 — Give Sheet and Dialog an accessible name
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). Sheet/Dialog use aria-labelledby with a non-empty aria-label fallback and wire aria-describedby; +3 jsdom tests, browser snapshot confirms names, no visual diff. Verified PASS (typecheck/lint, 34 files / 385 tests, build). Reports: impl-IMP-027.md, verify-IMP-027.md.

### IMP-029 — Pin the Node version (engines + .nvmrc)
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). `engines.node: ">=20"` and `.nvmrc` pin 20, matching both workflows and the README; lockfile untouched. Verified PASS (typecheck/lint, 386 tests, build). Reports: impl-IMP-029.md, verify-IMP-029.md.

### IMP-031 — Fix CSV parsing of a quote appearing mid-field
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). Quotes open only at field start; mid-field quotes are literal; RFC-4180 round-trips intact; +1 test (386). Verified PASS (typecheck/lint, build). Reports: impl-IMP-031.md, verify-IMP-031.md.

### IMP-032 — Sum recorded bill payments for the "Paid" total
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). New `sumRecordedPayments` helper sums recorded per-occurrence amounts for the visible month; editing the bill amount no longer rewrites history; unpaid bills contribute 0. +2 tests (404). Verified PASS (typecheck/lint, build, browser: Paid stayed 142 after amount edit). Reports: impl-IMP-032.md, verify-IMP-032.md.

### IMP-033 — Add missing ARIA state/roles to toggles and sortable headers
- **Status:** DONE
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
- **Notes:** DONE (attempt 2). Theme/pin/bill/habit expose aria-pressed; ListView uses real table semantics with aria-sort on columnheaders. Attempt 1 put aria-sort on buttons and failed AC3; retry fixed it. +5 tests (402). Verified PASS (typecheck/lint, build, browser snapshots, pixel-identical layouts). Reports: impl-IMP-033.md, verify-IMP-033.md.

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
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). Early return before repository/undo/toast; empty call preserves the prior undo entry and toasts. +1 test (420). Verified PASS (typecheck/lint, non-vacuous). Reports: impl-IMP-061.md, verify-IMP-061.md. Source: `discovered-IMP-004.md` §1. Honest scope: both current call sites already guard it — `ShoppingView`'s button is `disabled={!purchasedCount}` (`:138`) and `ListView` only renders the bulk bar when `selection.size > 0` (`:236`) — so this is a latent API hazard, hence the modest score. The "Delete N items" copy counting only selected rows (not cascaded descendants) stays out of scope as cosmetic.

### IMP-062 — Normalize CRLF in quick-add line splitting
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). splitNoteDraft normalizes CRLF/lone CR before splitting; CRLF output equals LF output; +2 tests (427). Verified PASS (typecheck/lint, build, non-vacuous). Reports: impl-IMP-062.md, verify-IMP-062.md. Source: `discovered-IMP-007.md` §4. Normalize inside `splitNoteDraft` only; the other kind parsers' behavior is pinned by existing tests and must not change.

### IMP-063 — Add CI concurrency groups and stop running the gate twice on `main`
- **Status:** DONE
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
- **Notes:** DONE (attempt 2). Removed CI push trigger so main runs the gate once via Deploy workflow_call; both workflows cancel superseded runs. Attempt 1 shared Deploy.s concurrency group and would self-cancel; retry uses a distinct -ci- group. Verified PASS (YAML/Prettier, 425 tests). Reports: impl-IMP-063.md, verify-IMP-063.md. Source: `discovered-IMP-005.md` §1–2. IMP-005's AC1 asked for both triggers, so option (b) may be rejected on that basis — (a) alone still fixes the wasted runs. Actions stay on major tags; SHA pinning belongs to IMP-022/IMP-048.

### IMP-064 — Enforce Prettier in CI and format the drifted source files
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). Added format:check + required CI step; formatted the five drifted tracked files (formatting-only); .prettierignore excludes generated trees. npx prettier --check . exits 0. Verified PASS (typecheck/lint, 425 tests, build). Reports: impl-IMP-064.md, verify-IMP-064.md. Source: `discovered-IMP-004.md` §4. `eslint-config-prettier` is already installed, so no lint conflict is expected. Do not reformat `.improve/` reports by hand.

### IMP-065 — Document the preview-build service-worker reset for Playwright verification
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). Documented in `agents.md` (the tracked canonical guide) with reset snippet, about:blank round-trip, devOptions scope and activeElement keydown note; executed the procedure against preview. Verified PASS (prettier/lint). Reports: impl-IMP-065.md, verify-IMP-065.md. Source: `discovered-IMP-007.md` §1 and `discovered-IMP-009.md` D1. This is a process note, not a product defect — the PWA caching is correct and must not be "fixed". IMP-046 may rename `agents.md` to `AGENTS.md`; keep the section findable by heading.

### IMP-066 — Cover the remaining `useData` hooks and drop the unreachable guards
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). Mock now captures deps; 9 tests cover useItem/useLists/useChildren/useSetting; useSetting dep is memo-stabilized; unreachable guards and cast removed. +9 tests (436). Verified PASS (typecheck/lint, build, mutation-checked). Reports: impl-IMP-066.md, verify-IMP-066.md. Source: `discovered-IMP-008.md` §1, §2, §5. `EMPTY_ITEMS` (`:6`) is one array shared by every caller on an empty DB — nothing mutates it today, so it is a latent aliasing hazard only; if this work touches it, prefer a getter over a module constant. IMP-043 (`no-explicit-any`) will reject a reintroduced cast.

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

### IMP-077 — Seed the editor's schedule fields from the resolved occurrence
- **Status:** DONE
- **Category:** correctness / scheduling
- **Type:** bug-fix
- **Area / files:** `src/features/item/ItemEditorSheet.tsx:118` (`setDraft(structuredClone(editor.item))`), `:84-95` (`occurrencePatch`), `:175-192` (`handleSave`); `src/domain/itemActions.ts:281-283` (the override `start` write)
- **Intent:** opening an occurrence seeds the draft from the **series** row, so (a) the Schedule tab shows the series start/time instead of that occurrence's — a moved occurrence looks un-moved — and (b) `occurrencePatch` then sends `start` = the *series date* with the edited time, so the persisted override is `2026-09-28T14:45` for occurrence `2026-10-04`: it resolves to the wrong calendar day even though it renders under the right `occKey`. IMP-016 made the write safe; this is where it is still wrong.
- **Acceptance criteria:**
  1. When the editor opens with an `occurrenceKey`, the occurrence-owned draft fields (`start`, `end`, `allDay`) are seeded from the resolved occurrence (that key's occurrence from `expandOccurrences`, merged with its override), not from `item.start`/`item.end`.
  2. Under scope `occurrence`, a changed time writes an override whose **date** is the occurrence's own date: editing occurrence `2026-10-04` to 14:45 stores `2026-10-04T14:45`, never the series' date.
  3. The seeded occurrence values never leak into an `all`-scope save: saving with scope `all` after opening an occurrence still patches the series with the series' own values.
  4. A non-recurring item's editor (no `occurrenceKey`) is unchanged.
- **Verification method:** Extend `src/domain/itemActions.test.ts` with an occurrence-scope save whose patch carries an edited time, asserting `overrides[key].start` keeps `key`'s date; Playwright: drag one occurrence to a new time, reopen it, assert the Schedule tab shows the moved time and that saving keeps it on that day. Run the four gates.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-016
- **Priority score:** 10
- **Notes:** DONE (attempt 2). Occurrence seeds merge the resolved occurrence + override; occurrence saves keep the occurrence date; all-scope resets to series; non-recurring items skip seeding after attempt 1 truncated a multi-day all-day end. +5 tests (441). Verified PASS (typecheck/lint, build, browser). Reports: impl-IMP-077.md, verify-IMP-077.md. Source: `discovered-IMP-012.md` §1 and `discovered-IMP-016.md` §3 — the "editor draft is the series row" gap IMP-016's notes left open. `updateOccurrence` (`src/domain/itemActions.ts:236-241`) writes a caller-supplied `start` and carries the same hazard; IMP-040 already works in that function.

### IMP-078 — Stop listing a daily habit twice on Today
- **Status:** DONE
- **Category:** UX / correctness
- **Type:** improvement
- **Area / files:** `src/features/today/TodayView.tsx:57-59` (Overdue already skips habits), `:162-176` (the agenda maps every occurrence), `:186-196` (the Habits panel)
- **Intent:** Overdue filters `kind !== 'habit'` but the agenda does not, so every daily habit renders twice on Today — once as an agenda card and once in the Habits panel directly below. Benign before IMP-018 (a habit had a single occurrence and the panel was the point of view); now every quick-added habit hits it.
- **Acceptance criteria:**
  1. A habit appears at most once on the Today route — either the agenda filters `kind !== 'habit'` like Overdue, or the Habits panel stops duplicating it.
  2. The agenda's `x/y done` label and progress ring count exactly the set the agenda renders.
  3. The Habits panel's streak text, per-day marks and "done today" ring are unchanged.
  4. Non-habit items' agenda rendering is unchanged.
- **Verification method:** Playwright at preview: quick-add `habit: journal`, open Today, assert exactly one visible "Journal" entry, toggle it and assert the Habits panel's ring updates. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-070
- **Priority score:** 10
- **Notes:** DONE (attempt 1). Habits excluded from the Today agenda and its counts; they remain once in the Habits panel. +2 tests (443). Verified PASS (typecheck/lint, build, browser). Reports: impl-IMP-078.md, verify-IMP-078.md. Source: `discovered-IMP-018.md` §4 (pre-existing for explicitly recurring habits, and logged as a verifier follow-up in IMP-018's notes). Which of the two sections keeps the habit is a UI call; either satisfies AC1.

### IMP-079 — One Escape must close only the topmost overlay
- **Status:** DONE
- **Category:** correctness / accessibility
- **Type:** bug-fix
- **Area / files:** `src/components/ui/Dialog.tsx:40-51` (per-instance `document` keydown listener); `src/hooks/useKeyboardShortcuts.ts:26-30` (the `⌘K` branch runs before the `isOverlayOpen` guard); `src/store/useUiStore.ts` (overlay state is a set of independent booleans)
- **Intent:** nothing makes the overlay set mutually exclusive and nothing clears one flag when another opens, so two dialogs can be stacked — the `⌘K` branch deliberately sits before the overlay guard so the palette stays reachable from the editor's title field. Each open `Dialog` registers its own document-level Escape listener, so **one** Escape closes both, and both focus traps are live at once.
- **Acceptance criteria:**
  1. With two overlays open, a single Escape closes exactly the topmost one; the other stays open and focus returns into it.
  2. With one overlay open, Escape still closes it (unchanged).
  3. The store gains a "most recently opened overlay" notion (an incrementing token or an explicit stack) instead of relying on independent booleans, so `Dialog` can decide whether it is on top.
  4. `⌘K` still opens the palette from a text field (IMP-013's intent preserved); stacking remains reachable, so AC1 is what must hold.
- **Verification method:** Playwright at preview: open the editor, focus the title, press `⌘K` (two dialogs on screen), press Escape once and assert only the palette closed and the editor is still open with focus back in its title field; press Escape again and assert the editor closes. Add jsdom cases in a new `src/components/ui/Dialog.test.tsx`. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10
- **Notes:** DONE (attempt 1). Shared overlay stack; Escape closes only the topmost layer and focus returns into the survivor; single-overlay and ⌘K behavior preserved. +2 tests (445). Verified PASS (typecheck/lint, build, format, browser; mutation-checked). Reports: impl-IMP-079.md, verify-IMP-079.md. Follow-up: scroll lock remains on the lower overlay (discovered-IMP-079.md). Source: `discovered-IMP-013.md` §1 and §4. Whether `⌘K` *should* be reachable while the editor is open is a product decision and is explicitly out of scope here (AC4 keeps it) — only the Escape semantics are fixed.

### IMP-080 — Catch a rejected `rerunMigration` in Settings
- **Status:** DONE
- **Category:** error handling
- **Type:** bug-fix
- **Area / files:** `src/features/settings/SettingsView.tsx:144-153` (`rerunMigration`, an `async` handler with no `try`/`catch`); the pattern to copy at `:118` and `:140`
- **Intent:** `rerunMigration` is an `async` click handler with no `try`/`catch`, so an IndexedDB failure (unavailable storage, blocked upgrade, quota) escapes as an unhandled rejection with **no** user feedback — exactly the gap IMP-015 closed for `importJSON`/`importCSV` in the same file. IMP-068 hardened the boot call site (`src/App.tsx:30-32`) and left this user-triggered twin behind.
- **Acceptance criteria:**
  1. The `settingsRepo.remove` + `runLegacyMigration` pair is wrapped in `try`/`catch` and pushes an error toast through the existing `describeError` helper.
  2. On failure the result toast does not appear, and the migration marker is not left deleted in a way that would re-run an already-completed import.
  3. On success the existing migrated/not-found toast is unchanged.
  4. No unhandled rejection reaches the console when `runLegacyMigration` rejects.
- **Verification method:** Add a case to `src/features/settings/SettingsView.test.tsx` (or IMP-015's existing file) stubbing `runLegacyMigration` to reject, click the re-run button and assert an error toast and no unhandled rejection; then run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-015
- **Priority score:** 10
- **Notes:** DONE (attempt 1). rerunMigration now catches failures, restores the prior marker, shows an error toast and never reports success; +2 tests (447). Verified PASS (typecheck/lint, build, format, non-vacuous). Reports: impl-IMP-080.md, verify-IMP-080.md. Source: `discovered-IMP-068.md` §1. Same class as IMP-039's boot-promise hardening but reachable by a single user click, so it is worth doing on its own. `discovered-IMP-015.md` §3 (a `pickFile` outside the `try`) is already resolved by IMP-015's implementation and needs nothing here.

### IMP-081 — Pin GitHub Actions to full commit SHAs
- **Status:** DONE
- **Category:** security / CI automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` (every `uses:` entry: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`); `.github/dependabot.yml` (added by IMP-022)
- **Intent:** every action is pinned to a mutable major tag, so a repointed tag runs unreviewed code with the repository's contents/Pages permissions. IMP-022 added Dependabot for `github-actions` but explicitly did not pin, and both IMP-005's and IMP-022's notes defer it to "IMP-022/IMP-048" — both of which are now resolved, so nothing owns it.
- **Acceptance criteria:**
  1. Each `uses:` is a 40-character commit SHA with the version kept in a trailing `# vX.Y.Z` comment.
  2. `.github/dependabot.yml` still declares the `github-actions` ecosystem, and its SHA updates remain enabled.
  3. `deploy.yml` still cannot deploy when the gate fails, and the check name referenced by IMP-067 AC1 is unchanged.
  4. No workflow references a third-party action by a moving tag.
- **Verification method:** `grep -n "uses:" .github/workflows/*.yml` shows only SHA pins; `npx prettier --check .github/workflows/*.yml` exits 0; run one PR-triggered CI run and confirm the gate and deploy jobs behave exactly as before. No source change.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-022
- **Priority score:** 10
- **Notes:** DONE (attempt 1). All six third-party uses: entries pinned to 40-hex SHAs with version comments; SHAs independently re-resolved against upstream tags. Verified PASS (workflow Prettier/lint; dependabot and deploy gate intact). Reports: impl-IMP-081.md, verify-IMP-081.md. Source: `discovered-IMP-005.md` §3 and `discovered-IMP-022.md` §1. Scored 10: cheap and standard supply-chain hardening, but no product impact for a single-user static site.

### IMP-035 — Fix settings read-modify-write races between theme and Settings
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). settingsRepo.merge does read+merge+put in one rw transaction; theme and Settings merge only changed keys; interleaved write test fails under old semantics. +3 tests (450). Verified PASS (typecheck/lint, build, format). Reports: impl-IMP-035.md, verify-IMP-035.md. Keep the public `settingsRepo.get("app")` shape.

### IMP-036 — Make reminder dedupe race-safe
- **Status:** DONE
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
- **Status:** DONE
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
- **Status:** DONE
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
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). Root ErrorBoundary with Reload/Try again and fixed secret-free copy; Dexie open/upgrade, migration, settings and PWA failures surface one persistent toast. +5 tests (425). Verified PASS (typecheck/lint, build, preview normal boot 0 errors, simulated storage failure recoverable). Reports: impl-IMP-039.md, verify-IMP-039.md. Non-blocking follow-up: ReminderRuntime prune rejection on blocked storage.

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
- **Status:** DONE
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

### IMP-082 — Guard the split tail against an empty series and an inverted range
- **Status:** DONE
- **Category:** correctness / recurrence
- **Type:** bug-fix
- **Area / files:** `src/domain/recurrence.ts` (`splitSeries`, `:373-416`, tail keeps `recurrence.until` at `:407`); `src/domain/itemActions.ts` (`updateRecurring`'s `future` branch, `:318-338`, tail field filter at `:325-327`)
- **Intent:** two ways "This and future" writes a broken row. (a) The tail inherits the original `until`, so splitting a series whose `until` has already passed persists a **recurring row that expands to zero occurrences** — a phantom series in every list. (b) The editor exposes `start` and `end` independently and the branch keeps the shifted `end` whenever the user edited only `start`, so `tail.end` can precede `tail.start` and the tail renders as a zero-length event.
- **Acceptance criteria:**
  1. Splitting at or past a key beyond the series' last occurrence writes no tail row (an explanatory toast is shown instead), and the head is left exactly as the unsplit series would render.
  2. A tail whose patched `end` precedes its patched `start` is normalized before the write (the `end` is dropped, or moved to follow the `start`); no persisted row has `end < start`.
  3. A normal mid-series split still yields head + tail with occurrence counts unchanged (IMP-023's invariants hold).
  4. The guard is a no-op for `count`-limited, unbounded and mid-range `until` splits.
- **Verification method:** Extend `src/domain/itemActions.test.ts` with a split past an existing `until` (assert no zero-occurrence recurring row is persisted) and a start-only edit (assert the tail's end is not before its start); re-run IMP-023's split property sweep in `src/domain/recurrence.test.ts`. Run the four gates.
- **Effort:** S    **Risk:** med
- **Depends on:** IMP-037
- **Priority score:** 8
- **Notes:** Source: `discovered-IMP-023.md` (the empty-tail and inverted-tail-range bullets). Both guards belong in the function IMP-037 already rewrites (persisted head + undo), so sequencing them after it saves a second pass over the highest-risk path in `domain`. The tail's wholesale copy of `exceptions`/`overrides` is a tidy-up and stays out of scope.

### IMP-083 — Make the boot smoke test observe boot effects and run the suite twice in CI
- **Status:** DONE
- **Category:** test coverage / CI reliability
- **Type:** test
- **Area / files:** `src/test/app.smoke.test.tsx:31-33`; `src/App.tsx:28-38` (the fire-and-forget boot promises); `.github/workflows/ci.yml` (the test step)
- **Intent:** the smoke test mounts `<App />` and asserts rendered text only, so both boot migrations are unobserved — IMP-068's defect survived ~10 commits precisely because nothing could see it, and the same blindness now covers `runNotificationGateMigration`. Separately, Vitest 4's unhandled-error **reporting** is timing-dependent (the rejection fired on every mount but was reported in only ~1 of 11 runs), so a single-run gate cannot detect this class of leak at all.
- **Acceptance criteria:**
  1. The smoke test awaits an observable handle for the boot migrations (an exported promise or a test-only hook) and asserts the outcome — the `migration.legacy` marker is written — after mount.
  2. The same assertion covers `runNotificationGateMigration`, or the item records why that one is not observable.
  3. `ci.yml`'s test step runs the suite twice (`vitest run && vitest run`), making a timing-dependent unhandled rejection deterministic.
  4. `npm run test` stays green locally; only the CI test step's runtime grows.
- **Verification method:** Break or stub `runLegacyMigration` to reject and confirm the smoke test fails; run `npm run test` 10 consecutive times and grep for "Unhandled" (0 matches, all exit 0); `npx prettier --check .github/workflows/ci.yml`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-005
- **Priority score:** 8
- **Notes:** DONE (attempt 1). App exposes an optional onBootEffects test hook; smoke test awaits both migrations and asserts markers; CI runs the suite twice in one Test step. 10 local runs zero Unhandled; reject mutations fail the test. Verified PASS (typecheck/lint, build, format). Reports: impl-IMP-083.md, verify-IMP-083.md. Source: `discovered-IMP-068.md` §2 and §3. The doubled run is the cheapest available detector for the failure IMP-068 actually had. No production code changes.

### IMP-084 — Remap `parentId` for every incoming item under the duplicate strategy
- **Status:** DONE
- **Category:** correctness / data integrity
- **Type:** bug-fix
- **Area / files:** `src/lib/backup.ts:88-96` (the `idMap` pre-pass covers colliding ids only), `:110-117` (the `parentId` rewrite, applied only inside the `duplicate` branch)
- **Intent:** under `duplicate`, only **colliding** ids get a new id, so an incoming child with a *fresh* id whose `parentId` points at a *colliding* parent is written verbatim and re-attaches to the live original parent instead of the freshly duplicated one. IMP-051 fixed the colliding-child case and left this residual gap, so an imported subtree is not self-consistent.
- **Acceptance criteria:**
  1. Under `duplicate`, `parentId` is rewritten for **every** incoming item whose `parentId` resolves in `idMap`, whether or not the child itself collided.
  2. A fresh-id child whose parent is not in the incoming set keeps its original `parentId` (IMP-051 AC2 unchanged).
  3. `skip` and `overwrite` behavior is byte-identical.
  4. A parent whose id appears twice in one incoming payload still resolves to a single canonical target (IMP-051's `!idMap.has` policy is preserved, not changed).
- **Verification method:** Extend `src/lib/backup.test.ts`: existing DB holds `p`; the incoming set is `p` plus a fresh-id `new-c` with `parentId: 'p'`; assert the written child's `parentId` equals the duplicated parent's new id and differs from `'p'`. Re-run the 60k-case differential fuzz IMP-051 used. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-051
- **Priority score:** 8
- **Notes:** Source: `discovered-IMP-051.md` D1. Low severity — it needs a mixed colliding/fresh import — but the fix widens an existing map lookup. D2 (two same-id incoming rows collapse to one) is left alone because the choice of winner is an import-semantics policy, and D3 (a dangling `parentId` is unvalidated) rides with IMP-038.

### IMP-060 — Share one items live query instead of one per component
- **Status:** DONE
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
- **Notes:** DONE (attempt 1). One ref-counted liveQuery backs useItems/useArchivedItems via useSyncExternalStore; all consumers share per-flag array instances; last unmount unsubscribes. +3 tests (453). Verified PASS (typecheck/lint, build, format, browser 10 routes). Reports: impl-IMP-060.md, verify-IMP-060.md. Source: `discovered-IMP-008.md` §4 — explicitly out of scope for IMP-008 because it restructures data flow across 12 files. 12 production call sites counted (not the 13 reported, which included the hook and its test). `useItems` is deliberately the only hook refactored; `useItem`/`useChildren` keep their per-site queries.

### IMP-085 — Render the occurrence-level `title` override
- **Status:** DONE
- **Category:** correctness / scheduling UI
- **Type:** bug-fix
- **Area / files:** `src/types/item.ts:136-149` (`Occurrence` has no resolved title); `src/domain/recurrence.ts:205-224` (`buildOccurrence`); `src/features/item/ItemCard.tsx:111` (renders `item.title`)
- **Intent:** IMP-016 correctly routes a "This occurrence" retitle into `recurrence.overrides[occKey].title`, but nothing resolves or renders it. Before IMP-016 the edit was visible on **every** occurrence (the leak); now it is visible **nowhere** — the user saves, sees "Occurrence updated", and observes no change anywhere.
- **Acceptance criteria:**
  1. An occurrence's effective title is resolved as `override?.title ?? item.title` — either a new `Occurrence.title` set in `buildOccurrence`, or one shared resolver that the engine and the card both call.
  2. `ItemCard` renders the resolved title, so Today, Matrix and Calendar (three call sites that already pass `occurrenceKey`) all show it.
  3. Retitling one occurrence of a weekly series leaves every other occurrence's title unchanged, in the UI and in the stored row.
  4. A non-recurring item and an occurrence with no title override render exactly as before.
- **Verification method:** Unit-test the resolver for the override and no-override cases in `src/domain/recurrence.test.ts`; Playwright: retitle one occurrence of a weekly task, assert the new title on that day's card and the old title on every other day. Run the four gates.
- **Effort:** M    **Risk:** low
- **Depends on:** IMP-016
- **Priority score:** 7.5
- **Notes:** Source: `discovered-IMP-016.md` §1. `notes` overrides are stored the same way but are not rendered on cards at all today, so `title` is the only user-visible half. Prefer engine-side resolution over teaching `ItemCard` about recurrence, since three call sites already carry an occurrence.

### IMP-086 — Never drop an undelivered reminder silently; stop rebuilding the digest every tick
- **Status:** DONE
- **Category:** reliability / reminders
- **Type:** improvement
- **Area / files:** `src/pwa/delivery.ts:78-92` (`deliver`), `:96-126` (`deliverDigest` re-expands every item before attempting delivery); `src/pwa/ReminderRuntime.tsx:37-51` and `:54-61` (both `deliver` return values ignored)
- **Intent:** a reminder that cannot be delivered — permission denied **and** the tab hidden — is retried once per 60 s tick until its `fireAt` leaves the 24 h `LOOKBACK_MS` window, then it is never delivered, never recorded, and nothing tells the user. IMP-019 fixed the "do not mark it fired" half; the outcome is still a silent loss. While that state lasts the digest's dedupe never trips, so every tick re-runs two full `expandOccurrences` sweeps over all items (~1440 times/day), and `deliver`'s meaningful boolean is dead information at both call sites.
- **Acceptance criteria:**
  1. A failed delivery attempt is persisted distinctly from a delivery (a timestamped attempt/failure row, never the `reminderLog` "fired" key), so an undelivered reminder remains discoverable after its `fireAt` has aged out.
  2. The user learns about it without a new route: a one-time toast (or a Settings row) reporting how many reminders passed their fire time undelivered — never on every tick.
  3. `deliverDigest` does not re-expand every item on a tick where it cannot deliver (cache the last attempted build, or short-circuit on permission/visibility before the sweeps), and the runtime consumes `deliver`'s return value to drive AC2.
  4. Dedupe invariants hold: a reminder that eventually delivers produces exactly one toast and one `reminderLog` row (500 flapping ticks → 1 toast/1 row), and repeated undeliverable ticks never append a second failure record for the same key.
- **Verification method:** Extend the `src/pwa/delivery.ts` unit tests with a rejecting `show` plus a hidden document: assert a failure row is written, a pending count is exposed, and a second tick performs no further `expandOccurrences` sweeps (spy on it). Playwright: deny notification permission, background the tab, assert no duplicate delivery. Run the four gates.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-019
- **Priority score:** 6
- **Notes:** Source: `discovered-IMP-019.md` §1–3. Scored 6 because the "surface it" half is a small product choice (toast vs. Settings row, left to the implementation) and the honest fix is mostly plumbing. IMP-056 prunes expired absolute reminders in the same component, so the two can share a pass.

### IMP-046 — Rename the agent guide to `AGENTS.md` and fix the README link
- **Status:** DONE
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

### IMP-087 — Undo of an editor-created parent must not leave pre-saved subtasks orphaned
- **Status:** DONE
- **Category:** correctness / undo integrity
- **Type:** bug-fix
- **Area / files:** `src/features/item/ItemEditorSheet.tsx` (subtask persistence before parent save), `src/domain/itemActions.ts` (`saveItem` create branch), `src/domain/itemActions.test.ts`
- **Intent:** The editor persists subtasks before the parent row, so the new create-undo entry (IMP-069) removes only the parent and leaves its children with a dangling `parentId`. The user sees ghost subtasks the undo was supposed to cancel.
- **Acceptance criteria:**
  1. Undoing an editor-created parent also removes the child rows that were created in the same editor session, without touching pre-existing children.
  2. If the editor cannot tell which children are new, the create path defers child persistence until the parent is saved so the undo closure can remove the whole tree.
  3. A unit test creates a parent plus child through `saveItem` and asserts no row with the removed `parentId` remains after undo.
- **Verification method:** Add the case to `src/domain/itemActions.test.ts`; run the four gates. Playwright: `N`, add a subtask, save, undo, confirm the subtask is gone.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-069
- **Priority score:** 8
- **Notes:** DONE (attempt 1). Create-undo snapshots the new parent.s descendants before writing and removes the whole tree in one entry; unrelated rows survive. +1 test (454). Verified PASS (typecheck/lint, build, format, browser). Reports: impl-IMP-087.md, verify-IMP-087.md. Found by the IMP-069 verifier (2026-10-17).

---

### IMP-088 — Normalize items on read so a malformed row cannot blank a view
- **Status:** DONE
- **Category:** correctness / robustness
- **Type:** bug-fix
- **Area / files:** `src/db/repository.ts` (itemRepo read methods), `src/hooks/useData.ts`, `src/domain/itemFactory.ts` (`normalizeItem`), `src/domain/stats.ts`, `src/features/habits/HabitsView.tsx`, `src/features/goals/GoalsView.tsx`, `src/features/bills/BillsView.tsx`
- **Intent:** IMP-071 made the editor and ICS safe, but Habits/Goals/Bills/Shopping/Notes and `stats.ts` still read `item.data.X` unguarded. A stored habit with no `data` crashes `#/habits` into a blank screen before the user can open the editor that would repair it.
- **Acceptance criteria:**
  1. Reading items through the repository/hook seam yields normalized `data` (or the views guard it), so a no-`data` habit renders `#/habits` instead of throwing.
  2. Habits, goals, bills, shopping, notes and stats render a no-`data` row with kind defaults.
  3. Normalization is read-only: the stored row is not rewritten unless the user saves it.
  4. A test seeds a no-`data` row for every kind and asserts each view/stat function renders/returns without throwing.
- **Verification method:** Vitest with fake-indexeddb for the read seam plus view mounts; Playwright preview: seed a raw no-`data` habit, reload, open `#/habits`, assert a rendered habit and zero console errors.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-071
- **Priority score:** 8
- **Notes:** DONE (attempt 1). All `itemRepo` reads normalize through `normalizeItem` (read-only, no write-back); stats guards missing target/metric; +11 tests across repository, stats and six view mounts; browser renders all views from seeded raw rows with zero console errors. Verified PASS (typecheck/lint, 35 files / 397 tests, build). Reports: impl-IMP-088.md, verify-IMP-088.md. Follow-up IMP-090 covers nested partial payloads.

---

### IMP-089 — Make occurrence writes atomic under concurrent setStatus calls
- **Status:** DONE
- **Category:** correctness / concurrency
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`setStatus` re-read then `patchItem`), `src/db/repository.ts` (`itemRepo.update`), `src/domain/itemActions.test.ts`
- **Intent:** IMP-076 merged into the persisted map for sequential writes, but an unawaited `Promise.all([setStatus(k1), setStatus(k2)])` can still read the same row twice and lose one key. The read and write are not atomic.
- **Acceptance criteria:**
  1. Two concurrent `setStatus` calls for different occurrence keys of one item both persist.
  2. The merge and write happen in one Dexie transaction (or an equivalent per-item serialization), not a read followed by a separate write.
  3. Undo still restores both keys exactly once, and a true no-op still writes nothing.
- **Verification method:** Add a fake-indexeddb test firing both calls with `Promise.all`; assert both keys and one undo per real change. Run the four gates.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-076
- **Priority score:** 6
- **Notes:** DONE (attempt 1). itemRepo.updateAtomic reads/merges/writes in one rw transaction; setStatus uses patchItemAtomic, so concurrent keys both persist with two undo entries and no-op writes nothing. +1 test (455). Verified PASS (typecheck/lint, build, format, focused test 10/10, non-vacuous). Reports: impl-IMP-089.md, verify-IMP-089.md. Found by the IMP-076 verifier (2026-10-17).

### IMP-090 — Deep-normalize nested kind payloads
- **Status:** DONE
- **Category:** correctness / robustness
- **Type:** bug-fix
- **Area / files:** `src/domain/itemFactory.ts` (`normalizeItem`), `src/domain/stats.ts`, `src/features/habits/HabitsView.tsx`, `src/features/goals/GoalsView.tsx`, `src/features/item/KindFields.tsx`
- **Intent:** IMP-088 makes a missing/null whole `data` object safe, but `normalizeItem` shallow-merges, so `{ target: null }`, `{ target: { count: 2 } }` (no `per`) and `{ metric: null }` still crash kind-specific reads in Habits/Goals/stats. A partially damaged row can blank a view the editor could repair.
- **Acceptance criteria:**
  1. Kind defaults are merged deeply enough that nested `target`/`metric` objects are complete after normalization.
  2. `{target:null}`, `{target:{count:2}}` and `{metric:null}` habits/goals render and stats do not throw.
  3. Normalization stays read-only; well-formed payloads are byte-identical.
- **Verification method:** Extend the IMP-088 no-`data` fixtures with nested partial payloads for habit and goal; assert repository read shape, view mounts and `habitStreak`/`goalProgress` do not throw. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-088
- **Priority score:** 8
- **Notes:** DONE (attempt 1). `mergeDefaults` recursively fills nested object defaults in `normalizeItem` (and `createItem`), so `{target:null}`, `{target:{count:2}}` and `{metric:null}` yield complete `target`/`streak`/`metric`; merge is pure and read-only. +7 tests across itemFactory, repository read shape, Habits/Goals mounts and stats. Gates: typecheck/lint/test (42 files / 471) / format:check all PASS. Reports: impl-IMP-090.md, discovered-IMP-090.md. Follow-up: `itemRepo` write-return values remain unnormalized.

### IMP-091 — Keep column context when the mobile List header is hidden
- **Status:** DONE
- **Category:** accessibility
- **Type:** improvement
- **Area / files:** `src/features/list/ListView.tsx` (header row, responsive classes), `src/features/list/ListView.test.tsx`
- **Intent:** Below `md` the table header row is hidden, so the accessibility tree has no `columnheader` nodes; mobile screen-reader users cannot tell what the row values mean or which sort is active.
- **Acceptance criteria:**
  1. At 390px the List still exposes column names to assistive tech (visually-hidden header row with `columnheader` cells, or equivalent per-cell labels).
  2. `aria-sort` remains exposed on the active sortable column at mobile width.
  3. Visual layout at 390px is unchanged (no visible header appears).
- **Verification method:** Playwright at 390×844 snapshot the Lists view and assert columnheader roles/names and the active aria-sort; compare screenshots to baseline. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-033
- **Priority score:** 6
- **Notes:** Found by the IMP-033 verifier (2026-10-17); non-blocking but a real mobile AT gap.

### IMP-092 — Catch ReminderRuntime prune rejections on blocked storage
- **Status:** DONE
- **Category:** error handling / reliability
- **Type:** bug-fix
- **Area / files:** `src/pwa/ReminderRuntime.tsx` (`:149-162`)
- **Intent:** On blocked storage the reminder prune promise can reject unhandled, logging an error on every tick even after IMP-039 makes boot recoverable.
- **Acceptance criteria:**
  1. The prune path catches rejections and does not throw an unhandled rejection.
  2. The failure does not spam a toast every tick; it degrades quietly (or reports once).
  3. Reminder delivery still works when storage is available.
- **Verification method:** Unit-test the prune failure path with a rejected repository call; run the four gates; preview with storage blocked and assert no unhandled rejection.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-039
- **Priority score:** 6
- **Notes:** Found by the IMP-039 verifier (2026-10-17).

### IMP-093 — Keep pre-switch schedule edits when scope changes to future
- **Status:** DONE
- **Category:** UX / correctness
- **Type:** bug-fix
- **Area / files:** `src/features/item/ItemEditorSheet.tsx` (`changeScope`), `src/features/item/ItemEditorSheet.test.tsx`
- **Intent:** Switching the edit scope to "This and future" resets the schedule fields to the series values, silently discarding time/day edits the user made before switching. Only "All occurrences" should restore the series schedule.
- **Acceptance criteria:**
  1. Switching to `future` preserves the current schedule edits; switching to `all` restores series values (existing IMP-077 behavior).
  2. A regression test covers edit → switch to future → save and asserts the edited schedule is applied from the occurrence onward.
  3. Occurrence-scope behavior is unchanged.
- **Verification method:** Extend the editor tests with the edit→future flow; run the four gates and a preview flow.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-077
- **Priority score:** 6
- **Notes:** Found by the IMP-077 verifier (2026-10-17); non-blocking but silently loses input.

### IMP-094 — Keep body scroll locked while any modal layer remains
- **Status:** DONE
- **Category:** UX / accessibility
- **Type:** bug-fix
- **Area / files:** `src/components/ui/Dialog.tsx`, `src/components/ui/Sheet.tsx`, `src/store/useUiStore.ts`, `src/hooks/useOverlayLayer.ts`
- **Intent:** Each modal sets and clears `document.body.style.overflow` in its own effect. With IMP-079's stack, closing the palette while the editor stays open unlocks body scroll behind the remaining modal; the sheet may also restore `''` when another modal had set `hidden`.
- **Acceptance criteria:**
  1. The scroll lock is reference-counted or derived from `overlayStack.length`, so closing one of two layers keeps the body locked.
  2. Closing the last layer restores the prior body overflow value.
  3. A test covers stacked open/close order and the final unlock.
- **Verification method:** jsdom test for two stacked overlays asserting body overflow after each close; preview editor+palette Escape once with a scroll attempt. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-079
- **Priority score:** 6
- **Notes:** Found by the IMP-079 verifier (2026-10-17). Also normalize the initial/restored value instead of always writing `''`.

### IMP-095 — Decide what cancelling an editor with draft subtasks should do (NEEDS-HUMAN)
- **Status:** NEEDS-HUMAN
- **Category:** UX / data hygiene
- **Type:** improvement
- **Area / files:** `src/features/item/ItemEditorSheet.tsx` (`addChild`, cancel/close path), `src/domain/itemActions.ts` (`saveItem` create branch)
- **Intent:** Subtasks are persisted immediately with the parent's generated id. If the user adds a subtask and then cancels the editor, the parent is never saved and the child rows remain orphaned (invisible but stored, included in counts/exports). IMP-087 makes undo safe; it does not address cancel.
- **Acceptance criteria (proposed):**
  1. A product decision records whether cancel should delete draft-added subtasks, keep them hidden until a parent exists, or warn the user.
  2. The chosen behavior is implemented with a test and no orphan rows.
- **Verification method:** To be defined after the decision.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-087
- **Priority score:** 6
- **Notes:** Found by the IMP-087 verifier (2026-10-17). Exact question for the human: "When a user adds subtasks in the editor and cancels without saving the parent, should those subtasks be discarded, kept as orphans, or should the app warn before closing?" Also noted: a subsumed child undo entry stays on the stack after IMP-087's whole-tree undo (no visible corruption).

### IMP-096 — Make habit streak derivation atomic with the occurrence toggle
- **Status:** DONE
- **Category:** correctness / concurrency
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`toggleDone` habit branch), `src/db/repository.ts` (`updateAtomic`)
- **Intent:** `setStatus` is atomic, but the habit branch then re-reads the row and writes the derived `data.streak` via a separate `patchItem`. Two unawaited habit toggles can compute streaks from different snapshots, so the persisted streak is last-writer-wins.
- **Acceptance criteria:**
  1. The occurrence status and derived streak are computed and written in one transaction (or per-item serialization).
  2. Concurrent habit toggles end with a streak consistent with the final occurrence state.
  3. Undo count is unaffected (`trackUndo: false`) and a no-op still writes nothing.
- **Verification method:** fake-indexeddb test firing two unawaited habit toggles and asserting the persisted streak matches the final state; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-089
- **Priority score:** 6
- **Notes:** Found by the IMP-089 verifier (2026-10-17); currently only reachable through rapid double activation.

### IMP-097 — Serialize the remaining occurrence edit writers
- **Status:** DONE
- **Category:** correctness / concurrency
- **Type:** bug-fix
- **Area / files:** `src/domain/itemActions.ts` (`updateRecurring`, `skipOccurrence`, `saveItem`, `patchItem`), `src/db/repository.ts`
- **Intent:** These paths still read a row and then call `patchItem`, which re-reads and writes separately, so concurrent calls could drop sibling edits as IMP-089 fixed for `setStatus`. No current UI path fires them concurrently, but the hazard is structural.
- **Acceptance criteria:**
  1. Each read-modify-write used by these paths is atomic or serialized per item.
  2. Concurrent occurrence edits preserve both changes in a test.
  3. Sequential behavior, history and undo are unchanged.
- **Verification method:** fake-indexeddb concurrency tests for two of the paths; run the four gates.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-089
- **Priority score:** 6
- **Notes:** Found by the IMP-089 verifier (2026-10-17); targeted follow-up, no reachable repro today.

---

_End of backlog (93 items). Source findings not promoted to items (lower impact or duplicate): calendar `+N more` was promoted (IMP-053); still below the cut are command-palette active-row scroll, ListView selection-vs-filter, bills paid-state vs occurrence-status coupling, goals checklist child-kind filtering, goals inline progress editing, keyboard drag path, loading skeleton before `useLiveQuery` resolves, overdue-window cap in TodayView, shopping `window.prompt`/row delete, `defaultView` dead setting, migration atomicity/re-run overwrite, body-scroll-lock refcount, `useFocusTrap` hidden-element filter, `Tabs` keyboard/`type=button`, `timestampedName` UTC day, notification-action no-op when no window, reminder-editor absolute-reminder display, `until`/`count` exception semantics, undo-stack cap and toast-timer leaks, and pure dead-code removal. Each remains a valid future follow-up._

_Second pass (absorbed from `.improve/reports/discovered-IMP-*.md`, promoted as IMP-057…IMP-067): overlay initial focus for the remaining dialogs, `HabitsView` week start, `useFocusTrap`'s 20 ms focus delay, the per-component duplicate `toArray()` subscription, the empty-selection undo clobber, CRLF quick-add lines, CI concurrency/duplicate runs, Prettier enforcement, the preview SW reset procedure, the remaining `useData` hook tests, and required branch protection. Left below the cut from the same reports: the per-selection descendant walk in bulk delete (N indexed queries, not worth it while selections are hand-picked), the "Delete N items" copy not counting cascaded rows, `goalProgress` appending `unit` to checklist labels and its differently shaped non-goal result (both label-only, and pinned by existing tests), the `binary`-metric `current` path that can report 100% while `status` is `todo` (unreachable — the editor never writes `current` for binary), the missing `maxLength` on the editor title field versus the 80-char quick-add cap (fixing it is a product decision — cap vs. truncate cards), SHA-pinning of GitHub Actions (promoted in the third pass as IMP-081, since both former owners are resolved), and the `pushToast` `setTimeout` left live under test (already noted in IMP-025's helper)._

_Third pass (2026-10-05, re-read of all 27 `discovered-IMP-*.md` reports against the current source; promoted as IMP-069…IMP-086, 18 items, no new NEEDS-HUMAN): editor-created items missing undo; habits created outside quick add still rule-less; a missing `data` payload crashing the editor; unrecognized JSON/CSV imports reporting success; leftover `every`/second weekday/eager lone-weekday consumption in quick add; floating-vs-UTC `UNTIL` and the `dateOnlyStart` default in ICS; multi-day all-day export without `DTEND`; `setStatus` read-modify-write on the caller's occurrence map; the editor seeding occurrence fields from the series row and writing the override with the series date; a daily habit listed twice on Today; one Escape closing every stacked overlay; the uncaught `rerunMigration` rejection; full-SHA pinning of GitHub Actions; empty/inverted split tails; a smoke test that cannot see boot effects plus a doubled CI test run; `parentId` remapping for non-colliding incoming children; the unrendered occurrence `title` override; and undelivered reminders being dropped silently while the digest re-expands each tick. Findings from those reports already fixed by DONE items were **not** re-proposed: the preview service-worker/hash-navigation trap (IMP-065), `pickFile` outside the `try` (fixed by IMP-015's implementation), the `overrides[key].status` shadowing the card checkbox (fixed by IMP-016's `withoutOverrideStatus`), the no-op "Occurrence updated" toast (fixed in `handleSave`), the already-noted "Nothing to update" path, the shared-SW observation of `data.streak` (an IMP-050 criterion), and IMP-017's phrasal-particle trimming, which stays BLOCKED and was not re-proposed in any form. Still below the cut from the same reports: the quick-add anchor/`dueAt` mismatch for `byWeekday`/`byMonthDay` rules (superseded by IMP-077's editor-display finding), `on the 0th`/`45th` tokens surviving in the title (IMP-011 AC3 makes that intended), the ambiguous month-day-plus-weekday input, `data.streak` as a write-only denormalized field (removing it would revert IMP-050 AC2), `buildHistory`'s whole-`data` diffs, the tail's wholesale copy of `exceptions`/`overrides`, same-id rows collapsing under `duplicate`, `lists` being unvalidated on import (IMP-038), a raw-IndexedDB write being invisible to `useLiveQuery` and Node 25's `localStorage` stub (both verification notes), the headless-Chromium `requestPermission` trap, and the one-frame settings default render seen by Sunday-start users (cosmetic, and the fix is architectural)._

_Rejected during critic review (not checkable / premise false / not a defect): the former history-blob item (`buildHistory` already skips `occurrences` at `itemActions.ts:32`), the former hardcoded-color item (badge classes in `labels.ts` already carry `dark:` variants; `bg-white` is a cosmetic knob only), and the former "reset all data" item (the confirm copy already enumerates exactly the tables it clears). The former standalone `npm ci` item was merged into IMP-005._

### IMP-098 — Give the Lists table a dedicated status/date column so neither wraps
- **Status:** TODO
- **Category:** visual / layout
- **Type:** bug-fix
- **Area / files:** `src/features/list/ListView.tsx` (header grid `:274`, row grid `:337`, status+date cell `:380-390`)
- **Intent:** The desktop header declares `grid-cols-[2rem_1fr_7rem_7rem_6rem]` with only four labelled columns, while every body row renders the status pill and the date together in the 96px fifth cell, so at 1280px "To Do" wraps to `To`/`Do`, the date wraps, and an "In Progress" pill overflows into the date.
- **Acceptance criteria:**
  1. Every header cell has a matching, equally wide body cell in the desktop table.
  2. The status pill and the date each own a grid track and neither wraps at 1280px, in light and dark.
  3. No cell's content exceeds its track width.
- **Verification method:** Playwright at 1280×800 on Lists with a seeded `doing` item; assert the row `gridTemplateColumns` matches the header and each cell's `scrollWidth <= clientWidth`; screenshot both themes. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (V1, S2, Impact 3/Reach 5/Confidence 5).

### IMP-099 — Make empty habit-heatmap cells visible in light mode
- **Status:** TODO
- **Category:** visual / contrast
- **Type:** bug-fix
- **Area / files:** `src/features/habits/HabitsView.tsx` (`:166` `intensity === 0 && 'bg-elevated'`, heatmap `:140-175`), `src/styles/index.css` (`--elevated`/`--surface`)
- **Intent:** In light mode `--elevated` and `--surface` are both `255 255 255`, so all 84 heatmap cells match the surrounding card and the 12-week grid is invisible on a habit with no completions.
- **Acceptance criteria:**
  1. In light mode an empty heatmap cell is visually distinguishable from the card background (measurably different computed background, or a border).
  2. The full 12×7 grid is visible in both themes for a habit with no completions.
  3. Dark-mode appearance is unchanged.
- **Verification method:** Playwright measure the computed `backgroundColor` of a cell versus the card in light and dark (or assert a border); screenshot both themes. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (V2, S2, Impact 4/Reach 3/Confidence 5).

### IMP-100 — Enlarge the item completion toggle and calendar day "add" to accessible tap targets
- **Status:** TODO
- **Category:** accessibility / UX
- **Type:** bug-fix
- **Area / files:** `src/features/item/ItemCard.tsx` (`:82` `h-4 w-4`), `src/features/calendar/CalendarView.tsx` (`:205-212`), `src/components/ui/Button.tsx` (`:24` `icon: 'h-9 w-9'`)
- **Intent:** At 390×844 the item-card completion toggle and the calendar day add both measure 16×16, below the WCAG 2.5.8 AA 24×24 minimum and far below the 44×44 guideline; header icons are 36×36 and the `Today`/segments are shorter still.
- **Acceptance criteria:**
  1. Every interactive control in the ten routes has a hit area ≥24×24 at 390px.
  2. The item-card completion toggle and the calendar day add each measure ≥44×44 including padding.
  3. A target-size probe reports no control under 24px.
- **Verification method:** Playwright target-size probe at 390×844 across routes; assert the minimums. Run the four gates.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (V3, S2, Impact 4/Reach 5/Confidence 5).

### IMP-101 — Show a first-run create CTA in the Lists empty state instead of "No items match"
- **Status:** TODO
- **Category:** UX / onboarding
- **Type:** bug-fix
- **Area / files:** `src/features/list/ListView.tsx` (`:395-418`)
- **Intent:** The single `filtered.length === 0` branch renders "No items match / Reset filters" even on a zero-data first run with no filters, where Reset does nothing; every other first-run view offers a create-first-item CTA.
- **Acceptance criteria:**
  1. With zero items and no active filter, Lists shows a first-run empty state whose primary action creates an item.
  2. "No items match / Reset filters" appears only when at least one filter is active.
  3. Both states are covered by a test.
- **Verification method:** Extend `ListView` tests for the zero-data and filtered-empty cases; Playwright on a fresh DB asserts the create CTA. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (U1, S2, Impact 4/Reach 4/Confidence 5).

### IMP-102 — Make "What's next" prefer timed, actionable occurrences
- **Status:** TODO
- **Category:** UX / correctness
- **Type:** bug-fix
- **Area / files:** `src/features/today/TodayView.tsx` (`:79-81`)
- **Intent:** `nextUp` sorts today's occurrences by `(a.start ?? a.occKey).localeCompare(...)`, so an all-day item (date-only) sorts before any timed item and a non-actionable note can win the banner while a 09:00 task sits in the agenda below.
- **Acceptance criteria:**
  1. The banner never promotes an untimed item while a timed occurrence is still pending today.
  2. Non-actionable kinds (`note`) are excluded or explicitly labelled.
  3. When only all-day items remain, the banner shows the item without implying a time.
- **Verification method:** Unit-test the `nextUp` selection with an all-day note plus a 09:00 task; Playwright with the same seeded data. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (U2, S2, Impact 4/Reach 4/Confidence 4).

### IMP-103 — Add a "+N more" affordance to truncated Today sidebar sections
- **Status:** TODO
- **Category:** UX / information loss
- **Type:** improvement
- **Area / files:** `src/features/today/TodayView.tsx` (`:75`, `:126`, `:248`)
- **Intent:** Sidebar sections slice to 6/6/4 rows with no "+N more" control, so the badge count (e.g. "Overdue 7") disagrees with the rendered rows (6); the calendar already solved this with IMP-053, so Today is inconsistent.
- **Acceptance criteria:**
  1. A section that hides rows shows a "+N more" control that reveals them or navigates to the full view.
  2. The badge count always equals the number of reachable items.
  3. Verified for Overdue, Bills due soon and Goal progress.
- **Verification method:** Playwright with more than the cap of seeded items; assert badge versus rows and the more-control. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-053
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (U3, S3, Impact 3/Reach 3/Confidence 5).

### IMP-104 — Widen the daily-digest time input so the AM/PM indicator is not clipped
- **Status:** TODO
- **Category:** visual / accessibility
- **Type:** bug-fix
- **Area / files:** `src/features/settings/SettingsView.tsx` (`:283-288` `className="input w-28"`)
- **Intent:** `w-28` leaves ~88px after `px-3` for a native `<input type="time">`, so Chromium renders `08:00 A` with the clock icon overlapping the truncated `M` at both 1280px and 390px.
- **Acceptance criteria:**
  1. The digest time input renders the full `HH:mm AM/PM` string with no clipping or icon overlap at 1280px and 390px, light and dark.
  2. The input has an explicit accessible label.
- **Verification method:** Playwright assert the input's `scrollWidth <= clientWidth` at both widths and its accessible name. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (V4, S3, Impact 2/Reach 3/Confidence 5). Overlaps IMP-121 for the label half.

### IMP-105 — Keep header CTAs on one line at 390px across Goals/Bills/Habits/Notes
- **Status:** TODO
- **Category:** visual / responsive
- **Type:** improvement
- **Area / files:** `src/features/goals/GoalsView.tsx` (`:49`); compare `src/features/today/TodayView.tsx` (`:88`)
- **Intent:** At 390px the long Goals subtitle squeezes the CTA so "New goal" wraps to two lines inside a 97×32 button; Today already guards this with `flex-wrap … gap-3`, and the same pattern is needed on the other list views.
- **Acceptance criteria:**
  1. At 390px the Goals CTA label stays on one line (no wrap or shrink below its content).
  2. The same guard is applied consistently to the Bills, Habits and Notes headers.
- **Verification method:** Playwright at 390px asserts a single-line CTA label on all four views. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (V5, S3, Impact 2/Reach 3/Confidence 5).

### IMP-106 — Stop Matrix quadrants reserving dead space that detaches the Add button
- **Status:** TODO
- **Category:** visual / spacing
- **Type:** improvement
- **Area / files:** `src/features/matrix/MatrixView.tsx` (`:65` `min-h-[16rem] flex-col`, `:81` `flex-1`)
- **Intent:** Each quadrant is `min-h-[16rem]` with a `flex-1` list, so with one item the `+ Add` button is pushed ~100px below the last card, leaving a large empty gap and inconsistent spacing between quadrants.
- **Acceptance criteria:**
  1. The Add control sits directly after the last item regardless of item count, or the reserved space is visually filled.
  2. Quadrant spacing is consistent across all four quadrants at 1280px and 390px.
- **Verification method:** Playwright measure the gap between the last card and the Add control in each quadrant at both widths. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (V6, S3, Impact 2/Reach 4/Confidence 4).

### IMP-107 — Name the local database, not "local storage", in the boot failure toast
- **Status:** TODO
- **Category:** UX / error copy
- **Type:** bug-fix
- **Area / files:** `src/App.tsx` (`:48-50`), `src/lib/bootFailure.ts` (`:5-6`)
- **Intent:** A database-open failure reuses `STORAGE_UNAVAILABLE_MESSAGE`, so a user with blocked/unavailable IndexedDB (private mode, storage partitioning) is told "Local storage is unavailable" and told to fix the wrong API.
- **Acceptance criteria:**
  1. A database-open failure produces a message that names the local database (not "local storage").
  2. The message is shown only when persistence is genuinely unavailable.
  3. The copy is asserted by a test on the `reportBootFailure` call sites.
- **Verification method:** Unit-test the boot-failure mapping; Playwright with IndexedDB unavailable but localStorage working asserts the toast text. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (U4, S3, Impact 2/Reach 3/Confidence 5).

### IMP-108 — Use the shared empty-state pattern in Today's sidebar sections
- **Status:** TODO
- **Category:** visual / consistency
- **Type:** improvement
- **Area / files:** `src/features/today/TodayView.tsx` (`:221`, `:241`, `:265`)
- **Intent:** First-run Today shows "No habits yet." / "No bills due this week." / "No goals yet." as bare `text-sm text-muted` paragraphs, while the same features use the shared `EmptyState` (icon + title + description + CTA) on their own routes.
- **Acceptance criteria:**
  1. The three Today sidebar sections use the same empty-state pattern as their feature routes (or a documented compact variant).
  2. At least the Habits and Goals empty states offer a create action.
- **Verification method:** Extend the Today tests; Playwright first-run screenshots compared against the feature routes. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 24
- **Notes:** Source: `.improve/reports/discover3-visual.md` (V7, S3, Impact 2/Reach 3/Confidence 4).

### IMP-109 — Enforce a documented minimum size for badges, pills and calendar chips
- **Status:** TODO
- **Category:** visual / legibility
- **Type:** improvement
- **Area / files:** `src/features/list/ListView.tsx` (`:361`, `:383`), `src/features/habits/HabitsView.tsx` (`:145`), `src/features/calendar/CalendarView.tsx` (`:222`, `:239`, `:354`, `:366`), `src/features/item/ItemCard.tsx` (`:129`, `:134`)
- **Intent:** Badges, status pills, weekday labels and calendar chips render at 10–11px with no documented minimum; combined with the cramped status column the pill is unreadable and month chips shrink to `Ov…`/`14:…` at 390px.
- **Acceptance criteria:**
  1. A documented minimum label size (≥11px, ideally ≥12px) is applied to kind badges, status pills, weekday labels and calendar chips.
  2. Status/kind labels remain on one line at 1280px.
  3. Contrast of the smallest text passes AA against its background.
- **Verification method:** Playwright measure computed font sizes and contrast ratios and assert the documented minimum. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-visual.md` (V8, S3, Impact 2/Reach 5/Confidence 4).

### IMP-110 — Evaluate a reminder's fire time outside the occurrence's own day window
- **Status:** DONE
- **Category:** correctness / reminders
- **Type:** bug-fix
- **Area / files:** `src/domain/reminders.ts` (`:48-68`, esp. `:56`, `:61`), `src/pwa/ReminderRuntime.tsx` (`:101-105`)
- **Intent:** `upcomingReminders` expands occurrences only inside the fire-time window `[from,to]` and `expandOccurrences` floors `from` to midnight, so a negative offset whose fire time lands on an earlier calendar day is never computed and is delivered at 00:00 of the occurrence day (the "1 day before" preset fires ~15h late).
- **Acceptance criteria:**
  1. A reminder's fire time is evaluated for every occurrence whose fire time falls in `[from,to]`, including fire times on days before the occurrence day.
  2. The `-1440` repro is returned by the window whose `to` is the fire time (Jan 4 09:00:30) and is not first returned at Jan 5 00:00.
  3. Same-day offsets and `timeOfDay` reminders keep their current timing; the returned list stays sorted by `fireAt`.
- **Verification method:** Add a fake-timer test using `LOOKBACK_MS` from `src/pwa/delivery.ts` asserting the `-1440`/`-600` repros and unchanged same-day cases. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#1, S2, Impact 3/Reach 3/Confidence 5).

### IMP-111 — Validate recurrence rules at the import/normalize seam
- **Status:** TODO
- **Category:** correctness / import
- **Type:** bug-fix
- **Area / files:** `src/domain/itemFactory.ts` (`:114-116`), `src/lib/itemValidation.ts` (`:46-58`), `src/domain/recurrence.ts` (`:42-43,57-68,96-119,195,267`), `src/lib/csv.ts` (`:168`), `src/lib/backup.ts` (`:76`)
- **Intent:** `normalizeRecurrence` is a passthrough, so an imported rule can throw (`rule.exceptions.includes`), silently expand to nothing (missing `weekStartsOn` → `NaN` plus a 200k-iteration burn), or fall through to yearly for an unknown `freq`.
- **Acceptance criteria:**
  1. A rule crossing the import/normalize seam is coerced to a complete `RecurrenceRule` (`freq` ∈ the four known values, numeric `interval ≥ 1`, `weekStartsOn ∈ {0,1}`, `exceptions: []`, `overrides: {}`), or the row is rejected/flagged like an invalid item.
  2. `expandOccurrences` does not throw for a rule lacking `exceptions`/`overrides`.
  3. A weekly rule without `weekStartsOn` expands using the default (Monday) instead of returning `[]`.
  4. An unknown `freq` never silently expands as yearly.
- **Verification method:** Unit tests importing malformed rules through `csvToItems`/`parseBackup`; assert the coerced shape, no throw, and no iteration burn. Run the four gates.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#2, S2, Impact 4/Reach 2/Confidence 5).

### IMP-112 — Never emit COUNT and UNTIL in the same RRULE after a "this and future" split
- **Status:** TODO
- **Category:** correctness / ICS
- **Type:** bug-fix
- **Area / files:** `src/lib/ics.ts` (`:74-79`), `src/domain/recurrence.ts` (`:424-428`)
- **Intent:** `splitSeries` stops the head with `until` while keeping the original `count`, so `recurrenceToRRule` writes `COUNT=5;UNTIL=…` into one RRULE, which RFC 5545 §3.3.10 forbids; importers reject or misread it, and a split is the normal "This and future" flow.
- **Acceptance criteria:**
  1. `recurrenceToRRule` never emits `COUNT` and `UNTIL` together (emit the tighter bound, or drop `UNTIL` when `count` is present).
  2. A split head's `count`/`until` combination survives the ICS round trip as one bound.
  3. A test asserts the head RRULE contains at most one of `COUNT=`/`UNTIL=`.
- **Verification method:** Unit-test `splitSeries` + `recurrenceToRRule` with a count-limited series; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#3, S2, Impact 3/Reach 3/Confidence 5).

### IMP-113 — Persist a recurrence-rule edit when scope is "This and future"
- **Status:** TODO
- **Category:** correctness / editor
- **Type:** bug-fix
- **Area / files:** `src/features/item/ItemEditorSheet.tsx` (`:67-84`, `:210-231`), `src/domain/itemActions.ts` (`:411-421`)
- **Intent:** `seriesPatch()` omits `recurrence`, so a rule edit made in the editor is dropped on both head and tail when scope is "This and future", while the toast still reports "Series split".
- **Acceptance criteria:**
  1. A rule edit is persisted when scope is "This and future" (the tail carries the edited rule; the head keeps the pre-split rule with its anchor fields).
  2. A rule edit made while scope is "This occurrence" still does not touch the series.
  3. A test covers an edited rule on "This and future" and asserts the persisted tail rule.
- **Verification method:** Extend the editor and `itemActions` tests with an edit→future flow asserting the stored tail rule. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#4, S2, Impact 4/Reach 2/Confidence 5); promoted from `discovered-IMP-037` #3.

### IMP-114 — Escape carriage returns in ICS text so CRLF notes do not corrupt content lines
- **Status:** TODO
- **Category:** correctness / ICS
- **Type:** bug-fix
- **Area / files:** `src/lib/ics.ts` (`:35-41` `escapeText`, used at `:105`, `:128-131`)
- **Intent:** `escapeText` escapes `\`, `;`, `,` and `\n` but not `\r`, so a note pasted from Windows leaves a raw CR inside a content line, which RFC 5545 §3.3.11/§3.1 forbids.
- **Acceptance criteria:**
  1. `escapeText` normalises `\r\n`/`\r` to a single escaped `\n` before escaping, so no raw CR can reach the output.
  2. A test exports an item whose `notes`/`title`/`location` contain CRLF and asserts the result has no CR other than the CRLF record separators.
  3. No long-line folding regression (IMP-052 stays green).
- **Verification method:** Unit-test `escapeText` and `itemsToICS` with CRLF payloads; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#5, S3, Impact 3/Reach 2/Confidence 5).

### IMP-115 — Never export a DTEND earlier than DTSTART for a timed item
- **Status:** TODO
- **Category:** correctness / ICS
- **Type:** bug-fix
- **Area / files:** `src/lib/ics.ts` (`:133-144`), `src/features/item/ItemEditorSheet.tsx` (`:642-655`), `src/domain/recurrence.ts` (`:122-128`)
- **Intent:** The End field is a free `datetime-local` input with no `> Start` validation and `itemsToICS` writes the stored end verbatim, so a VEVENT can carry `DTEND <= DTSTART` (RFC 5545 §3.8.2.2 violation) while the occurrence engine silently substitutes the start, so the card and the file disagree.
- **Acceptance criteria:**
  1. `itemsToICS` omits `DTEND` (or clamps it) when the resolved end is not later than the start, so no VEVENT has `DTEND <= DTSTART`.
  2. The editor prevents or flags an end earlier than the start for timed items (or the export is documented as the single source of truth).
  3. A test asserts every emitted `DTEND` is strictly after its `DTSTART`.
- **Verification method:** Unit-test `itemsToICS` with an inverted timed range; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 24
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#6, S3, Impact 3/Reach 2/Confidence 4).

### IMP-116 — Preserve a recurring item's wall-clock end across DST transitions
- **Status:** TODO
- **Category:** correctness / recurrence
- **Type:** bug-fix
- **Area / files:** `src/domain/recurrence.ts` (`:122-128` `durationMs`, `:159-167` `deriveOccurrenceEnd`)
- **Intent:** `durationMs` subtracts two local wall-clock instants (real elapsed time) and `deriveOccurrenceEnd` adds that elapsed time to a fresh local start, so a recurring timed item's wall-clock end shifts across a DST transition in both directions.
- **Acceptance criteria:**
  1. A recurring timed item's occurrence end preserves the series' wall-clock end time (start clock time plus the series' wall-clock length), including on DST transition days.
  2. Both repro cases (a weekly series crossing 2026-03-08, and a series starting on it) yield `end === '…T04:00'` for every occurrence.
  3. Non-DST days and all-day items are unchanged; existing recurrence tests stay green.
- **Verification method:** Add America/New_York recurrence tests with the two repro fixtures; run the four gates.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 8
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#7, S3, Impact 2/Reach 2/Confidence 4).

### IMP-117 — Catch rejections in the delivery tick on blocked storage
- **Status:** TODO
- **Category:** error handling / reliability
- **Type:** bug-fix
- **Area / files:** `src/pwa/ReminderRuntime.tsx` (`:150-152`, `:163`), `src/pwa/delivery.ts` (`:89`, `:92-93`, `:108-109`)
- **Intent:** The tick is fire-and-forget (`void tick().finally(...)` with no `catch`), so with a reminder due and storage unavailable the first `wasFired` rejection escapes as an unhandled rejection; the `notificationclick` message path has the same gap. IMP-092 hardened only the prune passes.
- **Acceptance criteria:**
  1. No `ReminderRuntime` async path can produce an unhandled rejection when IndexedDB is unavailable (tick, `deliver`, and the SW message handler each settle).
  2. The existing blocked-storage test is extended with a due reminder and asserts zero unhandled rejections.
  3. Happy-path delivery and the boot storage toast are unchanged.
- **Verification method:** Extend the blocked-storage test with a due reminder; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-092
- **Priority score:** 24
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#8, S3, Impact 3/Reach 2/Confidence 4); promoted from `discovered-IMP-092` D1. Kept separate from the IMP-118 test item.

### IMP-118 — Add tests for the notification and service-worker boundary
- **Status:** TODO
- **Category:** tests / tooling
- **Type:** test
- **Area / files:** `src/pwa/notifications.ts` (`:9-58`), `src/pwa/register.ts` (`:9-27`), `src/pwa/sw.ts` (`:6-40`)
- **Intent:** Coverage is `notifications.ts` 13.6% statements / 15.4% branches, `register.ts` 28.6%, `sw.ts` 0% — the exact boundary where the IMP-019/021/036/086/092 bug classes live, with no direct test.
- **Acceptance criteria:**
  1. `showAppNotification` is tested for: permission ≠ granted → `false` and no call; registration present → `registration.showNotification` with the payload; no registration → `new Notification`; a throwing API → `false` (never throws).
  2. `sendSkipWaiting` is tested for a missing `serviceWorker`, a registration without `waiting`, and a `waiting` worker (posts `SKIP_WAITING`).
  3. The `notificationclick` handler is exercised (client present → focus + `postMessage`; no client → `openWindow`), by unit-testing the handler body or extracting it.
- **Verification method:** Add the tests and record the coverage delta; run the four gates.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 18
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#9, S3, Impact 3/Reach 3/Confidence 4). Kept separate from the IMP-117 fix.

### IMP-119 — Test the reminder helpers `fireTimesForOccurrence`, `formatReminderLabel` and the `timeOfDay` path
- **Status:** TODO
- **Category:** tests / tooling
- **Type:** test
- **Area / files:** `src/domain/reminders.ts` (`:24-29`, `:31-41`, `:135-152`)
- **Intent:** `fireTimesForOccurrence` (0%) has no reference outside its module and no test, so its de-dup/sort contract is unverified; `formatReminderLabel` branches and the `timeOfDay` fire path are uncovered.
- **Acceptance criteria:**
  1. `fireTimesForOccurrence` is tested with mixed reminders (absolute + offset + `timeOfDay` + duplicate offsets + a reminder with no trigger) asserting sorted, de-duplicated epoch values.
  2. `formatReminderLabel` is tested for `absolute`, `timeOfDay`, `0`, `±1440`, `±60`, `±30` and the no-trigger fallback.
  3. `reminderFireTime` is tested for the `timeOfDay`-on-a-timed-occurrence case and for `null` when no trigger is present.
- **Verification method:** Add the reminder tests; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#10, S3, Impact 2/Reach 3/Confidence 5).

### IMP-120 — Test `labels.ts` weekday helpers, `date.ts` helpers and the backup glue
- **Status:** TODO
- **Category:** tests / tooling
- **Type:** test
- **Area / files:** `src/lib/labels.ts` (`:64-77`), `src/lib/date.ts` (`:61-67`, `:130-141`), `src/lib/backup.ts` (`:146-176`), `src/db/repository.ts` (`:159-165`, `:296`, `:302-311`)
- **Intent:** `labels.ts` has 0% branch coverage (`weekdayLabels` is the single shared helper for the week-start setting, reused by two views), `date.ts`/`backup.ts` helpers are partly uncovered, `backupRepo.prune` (the migration-backup retention guard) is never exercised, and `withTime` is untested dead code.
- **Acceptance criteria:**
  1. `weekdayLabels(0)` === `['Sun','Mon',…,'Sat']` and `weekdayLabels(1)` === `['Mon',…,'Sun']` are asserted; `statusClasses` is distinct for each of `done`/`doing`/`cancelled`/`todo` with a `dark:` class on every variant; `priorityBadgeClasses('high')`/`('low')` are distinct and dark-safe.
  2. `dateKeyOf` is tested for a date-only value, a datetime value, a non-ISO parseable value and an unparseable value (`null`); `setTimeOnDateString`/`stripTime`/`withTime` are tested (or `withTime` is removed and the others covered).
  3. `backupRepo.prune(keep)` is tested with more rows than `keep` asserting the newest `keep` survive; `replaceAll` is tested to clear then bulk-put inside one transaction.
  4. `readTextFile` is tested with a stubbed `FileReader` (resolve + `onerror` reject).
- **Verification method:** Add the tests (merging quality #11 and #12); run the four gates.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 15
- **Notes:** Source: `.improve/reports/discover3-quality.md` (#11 + #12, S3). Merged into one test item per instruction.

### IMP-121 — Give every form control an accessible name
- **Status:** TODO
- **Category:** accessibility
- **Type:** bug-fix
- **Area / files:** `src/components/ui/Form.tsx` (`:28-40`), `src/features/item/ItemEditorSheet.tsx` (`:385-447`, `:467-478`, `:594-670`), `src/features/item/KindFields.tsx` (`:17-305`), `src/features/item/RecurrenceEditor.tsx` (`:54-165`), `src/features/item/ReminderEditor.tsx` (`:56-73`), `src/features/settings/SettingsView.tsx` (`:226-254`, `:283-288`, `:321-331`), `src/features/shopping/ShoppingView.tsx` (`:122-130`, `:146-152`), `src/features/list/ListView.tsx` (`:191-196`), `src/features/notes/NotesView.tsx` (`:54-62`), `src/features/quickadd/QuickAdd.tsx` (`:116-128`), `src/features/command/CommandPalette.tsx` (`:93-115`)
- **Intent:** `Field` renders a sibling `<label>` but no call site passes `htmlFor`/`id`, and several controls rely on `placeholder` alone, so nearly every editor/settings/quick-add control is programmatically unlabelled and `getByLabelText` cannot find it.
- **Acceptance criteria:**
  1. Every `<input>`/`<select>`/`<textarea>` in the editor, settings, quick add, command palette and the shopping/list/notes capture resolves to an accessible name (axe `label` clean; `getByLabelText` works in tests).
  2. No visual change; existing tests pass.
- **Verification method:** Add `getByLabelText`/axe assertions across the listed views; run the four gates.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F1, S2, Impact 4/Reach 5/Confidence 5).

### IMP-122 — Expose progress semantics on `ProgressRing`
- **Status:** TODO
- **Category:** accessibility
- **Type:** bug-fix
- **Area / files:** `src/components/ui/ProgressRing.tsx` (`:32-59`); consumers `src/features/today/TodayView.tsx` (`:159`, `:202-208`, `:257`), `src/features/goals/GoalsView.tsx` (`:88`)
- **Intent:** The ring renders a raw `<svg>` plus a text node with no `role`, `aria-label` or `aria-valuenow`; a custom `label` (e.g. `✓`/`0`) replaces the percentage, so goal/habit progress is invisible to assistive tech.
- **Acceptance criteria:**
  1. The ring exposes `role="progressbar"` (or `img`) with an accessible name including its value and the surrounding item context.
  2. Today and Goals snapshots show it; tests pass.
- **Verification method:** Add component tests asserting role/name/value for the ring in Today and Goals. Run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F2, S2, Impact 3/Reach 4/Confidence 5).

### IMP-123 — Add ARIA state and keyboard semantics to Tabs and the recurrence weekday picker
- **Status:** TODO
- **Category:** accessibility
- **Type:** bug-fix
- **Area / files:** `src/components/ui/Tabs.tsx` (`:16-36`), `src/features/item/ItemEditorSheet.tsx` (`:371-381`), `src/features/item/RecurrenceEditor.tsx` (`:75-92`)
- **Intent:** IMP-033 fixed toggles in Settings/Notes/Bills/Habits but the shared `Tabs` (no `tabpanel`, `aria-controls`, roving `tabIndex` or `type="button"`) and the recurrence weekday picker (no `aria-pressed`, single-letter labels) were not in its file list, so the active state is conveyed by colour only and cannot be arrow-navigated.
- **Acceptance criteria:**
  1. Tabs are arrow-key operable, only the active tab is tabbable, and panels are associated via `aria-controls`/`aria-labelledby`.
  2. Weekday buttons expose `aria-pressed` and a full weekday name.
  3. No visual change; tests pass.
- **Verification method:** Add keyboard/ARIA tests for `Tabs` and the weekday picker; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-033
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F3, S2, Impact 3/Reach 4/Confidence 5).

### IMP-124 — Add a legend and a non-colour summary to the habit heatmap
- **Status:** TODO
- **Category:** accessibility
- **Type:** improvement
- **Area / files:** `src/features/habits/HabitsView.tsx` (`:151-175`)
- **Intent:** Four green intensities are the sole encoding; `title` tooltips are not keyboard-reachable or exposed under `role="img"`, and there is no legend, so colour-blind and screen-reader users cannot recover per-day values.
- **Acceptance criteria:**
  1. A visible "less → more" legend and an accessible per-day/per-week summary (grid/table or `aria-describedby` text) expose the data without colour.
  2. Tests pass.
- **Verification method:** Add tests asserting the legend and the accessible summary; run the four gates.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 18
- **Notes:** Source: `.improve/reports/discover3-features.md` (F4, S3, Impact 3/Reach 3/Confidence 4). Complements the IMP-099 light-mode fix.

### IMP-125 — Add a skip-to-content link and an addressable `<main>`
- **Status:** TODO
- **Category:** accessibility
- **Type:** improvement
- **Area / files:** `src/features/shell/AppShell.tsx` (`:212`; nav landmarks `:122`), `src/features/shell/MobileBottomNav.tsx` (`:43`)
- **Intent:** `<main>` has no `id`/`tabIndex` and there is no bypass link, so keyboard users tab through the full nav rail (10 links plus actions) on every view before reaching content.
- **Acceptance criteria:**
  1. The first Tab reveals a "Skip to content" link that moves focus to `<main id="main" tabIndex={-1}>`.
  2. The link is visually hidden until focused; tests pass.
- **Verification method:** Add a jsdom focus test for the skip link; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F5, S3, Impact 2/Reach 4/Confidence 5).

### IMP-126 — Let habits be completed from the Today dashboard
- **Status:** TODO
- **Category:** UX / missing feature
- **Type:** feature-improvement
- **Area / files:** `src/features/today/TodayView.tsx` (`:196-220`); contrast `src/features/habits/HabitsView.tsx` (`:60-63`, `:104-117`)
- **Intent:** README promises "habit rings" on Today, but the ring is display-only and checking a habit requires navigating to Habits; `toggleDone` and `expandOccurrences` already exist for this.
- **Acceptance criteria:**
  1. Clicking a Today habit ring/row toggles today's occurrence through the same path as `HabitsView.markToday`, updating the ring and streak in place without leaving Today.
  2. Tests pass.
- **Verification method:** Extend the Today tests plus a Playwright click on the ring; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F6, S2, Impact 4/Reach 4/Confidence 5).

### IMP-127 — Decide how notes attach to an item (NEEDS-HUMAN)
- **Status:** NEEDS-HUMAN
- **Category:** UX / product decision
- **Type:** new-feature
- **Area / files:** `src/features/item/KindFields.tsx` (`:296-305`), `src/types/item.ts` (`:51`), `src/domain/itemFactory.ts` (`:90`, `:134`), `src/features/notes/NotesView.tsx`
- **Intent:** README states notes are "attachable to any item", but no UI sets a note's `parentId` and nothing surfaces an attached note; the model already honours `parentId`, so this is a product/UX decision, not just wiring.
- **Acceptance criteria (proposed):**
  1. A product decision records the attachment UX (selector vs. attach-from-item, one vs. many notes per item, discoverability on the parent).
  2. The chosen behavior is implemented with set/clear tests and survives the JSON/CSV round trip.
- **Verification method:** To be defined after the decision.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F7, S2, Impact 3/Reach 3/Confidence 4). NEEDS-HUMAN per instruction (product decision).

### IMP-128 — Decide how absolute one-off reminders are created (NEEDS-HUMAN)
- **Status:** NEEDS-HUMAN
- **Category:** UX / product decision
- **Type:** new-feature
- **Area / files:** `src/types/item.ts` (`:13-14`), `src/features/item/ReminderEditor.tsx` (`:24-74`), `src/pwa/ReminderRuntime.tsx` (`:171-175`)
- **Intent:** README promises reminders "relative or absolute"; the type and engine support `absolute`, but the editor only offers offset presets (timed) or a time-of-day (all-day), and `absolute` is written only by snooze, so this needs a UX decision on entry and labelling.
- **Acceptance criteria (proposed):**
  1. A product decision records the absolute-reminder UX (explicit date/time entry, interaction with the offset presets, labelling in the editor).
  2. The chosen behavior persists `absolute` and fires once through `upcomingReminders`, with tests.
- **Verification method:** To be defined after the decision.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F8, S2, Impact 3/Reach 3/Confidence 4). NEEDS-HUMAN per instruction (product decision).

### IMP-129 — Replace `window.prompt` for a new shopping list with the app Dialog
- **Status:** TODO
- **Category:** UX / consistency
- **Type:** improvement
- **Area / files:** `src/features/shopping/ShoppingView.tsx` (`:94-110`); contrast `src/features/settings/SettingsView.tsx` (`:365-389`)
- **Intent:** "New shopping list" uses `window.prompt`, which is unstyled, blocks the main thread, and is neither focus-trapped nor announced by the app, while every other capture uses `Dialog`/`Field`.
- **Acceptance criteria:**
  1. "List" opens the app `Dialog` with a labelled input; Enter/OK creates the list and selects it, Esc/Cancel is a no-op, and no `window.prompt` remains.
  2. Tests cover both paths.
- **Verification method:** Replace with `Dialog` and add tests for create and cancel; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F9, S2, Impact 3/Reach 3/Confidence 5).

### IMP-130 — Confirm destructive bulk and shopping actions before deleting
- **Status:** TODO
- **Category:** UX / data safety
- **Type:** improvement
- **Area / files:** `src/features/list/ListView.tsx` (`:95-98`), `src/features/shopping/ShoppingView.tsx` (`:87-92`); contrast `src/features/settings/SettingsView.tsx` (`:381-389`)
- **Intent:** One click deletes every selected item or every purchased row with no confirmation or undo, while Settings already routes its destructive reset through `ConfirmDialog`, so the safe pattern exists.
- **Acceptance criteria:**
  1. Both actions route through `ConfirmDialog` (or produce a toast with an Undo action) before deleting; Cancel leaves data untouched.
  2. Tests cover confirm and cancel for both actions.
- **Verification method:** Add tests for confirm + cancel on both actions; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F10, S2, Impact 3/Reach 3/Confidence 5).

### IMP-131 — Expand occurrences once per year view instead of twelve times
- **Status:** TODO
- **Category:** performance
- **Type:** improvement
- **Area / files:** `src/features/calendar/CalendarView.tsx` (`:328-341`), `src/hooks/useOccurrences.ts` (`:8-18`)
- **Intent:** Year mode runs `expandOccurrences` over all items once per month (12 full passes) instead of one pass over the year, a visible jank hotspot on the least-optimised view.
- **Acceptance criteria:**
  1. Year view computes occurrences once for the year and buckets them by month; instrumentation shows ≤1 expansion pass.
  2. Rendered output is unchanged; tests pass.
- **Verification method:** Add an instrumentation test counting expansions for a year render plus a Playwright year-view check; run the four gates.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F11, S2, Impact 3/Reach 3/Confidence 4).

### IMP-132 — Compute editor analytics only when the Analytics tab is open
- **Status:** TODO
- **Category:** performance
- **Type:** improvement
- **Area / files:** `src/features/item/ItemEditorSheet.tsx` (`:146-154`)
- **Intent:** The `analytics` `useMemo` depends on `draft` and runs `itemCompletionStats` plus a 120-day `expandOccurrences` on every keystroke, even when the Analytics tab is closed.
- **Acceptance criteria:**
  1. Analytics are computed only when `tab === 'analytics'` (or memoized on `draft.id`/`draft.recurrence`), with identical output.
  2. Typing stays responsive; tests pass.
- **Verification method:** Add a test asserting no expansion runs while typing on a non-analytics tab; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F12, S3, Impact 3/Reach 3/Confidence 5).

### IMP-133 — Split the ten views out of the single 384 KB entry chunk
- **Status:** TODO
- **Category:** performance
- **Type:** improvement
- **Area / files:** `src/App.tsx` (`:4-19`), `vite.config.ts` (`:61-72`), `dist/assets/index-*.js`
- **Intent:** All ten views are statically imported, so Calendar/List/Command and their icons are in the first-load 384 KB (raw, ~115 KB gzip) entry chunk even when the user opens Today; vendor chunks are already separated.
- **Acceptance criteria:**
  1. Views load via `React.lazy` behind a `Suspense` fallback; the entry chunk shrinks materially.
  2. First paint of Today is unchanged; `npm run build` and tests pass.
- **Verification method:** Compare `dist` chunk sizes before/after and measure Today first paint; run the four gates.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 18
- **Notes:** Source: `.improve/reports/discover3-features.md` (F13, S3, Impact 3/Reach 4/Confidence 3).

### IMP-134 — Add an in-app Help entry point for quick-add syntax and export formats
- **Status:** TODO
- **Category:** docs / onboarding
- **Type:** new-feature
- **Area / files:** `src/features/shell/ShortcutSheet.tsx` (`:5-14`), `src/features/settings/SettingsView.tsx` (`:357-363`), `src/features/quickadd/QuickAdd.tsx` (`:17-21`)
- **Intent:** README documents quick-add syntax, recurrence and export formats, but the app exposes only the shortcut list, so a first-run user has no discoverable place to learn `pay electricity $120 every month on the 5th`.
- **Acceptance criteria:**
  1. A reachable "Help" surface (e.g. Settings → About and/or the shortcut sheet) lists quick-add syntax examples, the keyboard shortcuts, and a one-line note on JSON vs CSV vs ICS.
  2. It is reachable by keyboard; tests assert the entry point opens it.
- **Verification method:** Add tests for the entry point; run the four gates.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25
- **Notes:** Source: `.improve/reports/discover3-features.md` (F14, S3, Impact 3/Reach 3/Confidence 4).
