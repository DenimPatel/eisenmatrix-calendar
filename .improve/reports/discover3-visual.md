# Discovery 3 — Visual + UX/Interaction Audit

Scope: every route (Today, Calendar, Matrix, Lists, Goals, Habits, Bills, Shopping, Notes,
Settings), the item editor, quick add, command palette and shortcut sheet, at **1280×800** and
**390×844**, in **light and dark**. Read-only on `src`. Build: `npm run build` (clean) →
`npm run preview` at http://localhost:4173/eisenmatrix-calendar/.

Method: fresh Playwright contexts (the MCP default context has IndexedDB disabled, so a new
context was created), realistic seeded data written directly into the Dexie `eisenmatrix`
database, plus a first-run (zero-data) pass. Screenshots + raw measurements under
`.improve/artifacts/discovery3/`. Existing `IMP-*` items were reviewed first; none of the 12
below duplicate them.

## What is already healthy (no item raised)

- **Dark-mode tokens**: a repo-wide grep for hardcoded `slate|gray|zinc|neutral|stone|white|black`
  utility classes returns exactly one hit — `src/lib/labels.ts:70` — and it carries matching
  `dark:` variants. No dark-mode token violations found.
- Empty states on Goals, Habits, Bills, Shopping, Notes, Matrix are rich (icon + copy + CTA).
- `text-muted` on `bg`/`surface` measures ≈4.6:1 in light mode (passes AA); `text-rose-600` on
  `bg-rose-50` ≈4.5:1.

---

### V1 — Lists table: status badge and date are jammed into one header-less column

- **Dimension**: Visual
- **Type**: layout / overflow
- **Severity**: S2
- **Files/lines**: `src/features/list/ListView.tsx:274` (header grid), `:337` (row grid), `:380-390` (status + date share the last cell)
- **Evidence**: header defines `grid-cols-[2rem_1fr_7rem_7rem_6rem]` with only 4 labelled
  columns (Select, Item, List, Priority, Date); the body row's 5th cell renders **both** the
  status pill and the date with `justify-between`. Measured at 1280px:
  `gridTemplateColumns: "32px 334px 112px 112px 96px"`, last cell `textContent: "To Do2026-10-18"`
  (96px wide). Result: the pill wraps to `To`/`Do` and the date wraps to `2026-`/`10-18`; an
  `In Progress` pill overflows into the date. Reproduced in light and dark
  (`light-1280-lists.png`, `dark-1280-lists.png`).
- **Acceptance criteria**: (1) In the desktop table every column in the header row has a matching,
  equally-wide body cell; (2) the status pill and the date each get their own grid track and
  neither wraps at 1280px; (3) no cell's content is wider than its track.
- **Effort**: S
- **Impact/Reach/Confidence**: 3/5/5

### V2 — Habit heatmap is invisible in light mode

- **Dimension**: Visual
- **Type**: contrast / missing affordance
- **Severity**: S2
- **Files/lines**: `src/features/habits/HabitsView.tsx:166` (`intensity === 0 && 'bg-elevated'`), heatmap `:140-175`
- **Evidence**: measured on a seeded habit: all 84 cells compute
  `backgroundColor: rgb(255,255,255)`, and the surrounding `.card` is also `rgb(255,255,255)` —
  in light mode `--elevated` and `--surface` are both `255 255 255` (`src/styles/index.css:8-9`).
  The 12-week grid is therefore completely invisible; only the weekday label column shows, so the
  card reads as an empty box (`light-1280-habits.png`, `light-390-habits.png`). In dark mode the
  cells are visible (`dark-390-habits.png`), confirming a light-mode-only defect.
- **Acceptance criteria**: (1) In light mode an empty heatmap cell is visually distinguishable
  from the card background (measurably different computed background, or a border); (2) the full
  12×7 grid is visible in both themes on a habit with no completions.
- **Effort**: S
- **Impact/Reach/Confidence**: 4/3/5

### V3 — Primary completion control and calendar "add" are 16×16px tap targets

- **Dimension**: UX/Interaction
- **Type**: touch target / accessibility
- **Severity**: S2
- **Files/lines**: `src/features/item/ItemCard.tsx:82` (`h-4 w-4`), `src/features/calendar/CalendarView.tsx:205-212` (`rounded p-0.5` + `Plus size={12}`), `src/components/ui/Button.tsx:24` (`icon: 'h-9 w-9'`)
- **Evidence**: measured at 390×844 — `Mark as done` = **16×16**, `Add item on 2026-09-28` =
  **16×16**, header icon buttons (`Theme`, `Keyboard shortcuts`, `New task`) = **36×36**, calendar
  `Today` = 51×**16**, day/week/month/year segments = **24**px tall, `Quick add`/`New task` = 32px
  tall. Reported on today/calendar/matrix/lists/shopping/settings. 16px is below the WCAG 2.5.8
  AA minimum (24×24) and far below the 44×44 guideline used elsewhere in this task.
- **Acceptance criteria**: (1) Every interactive control in the 10 routes has a hit area ≥24×24 at
  390px (target ≥44×44 for primary actions); (2) the item-card completion toggle and the calendar
  day add button each measure ≥44×44 including padding; (3) re-running the target-size probe
  reports no control under 24px.
- **Effort**: M
- **Impact/Reach/Confidence**: 4/5/5

### U1 — Lists empty state calls a zero-data first run "No items match" and offers only "Reset filters"

- **Dimension**: UX/Interaction
- **Type**: empty state / onboarding
- **Severity**: S2
- **Files/lines**: `src/features/list/ListView.tsx:395-418`
- **Evidence**: the single branch renders for `filtered.length === 0` regardless of whether any
  filter is set: title "No items match", description "Adjust filters or add a new item.", action
  "Reset filters". On a brand-new database (0 items, no filters) the user sees that copy and a
  Reset-filters button that does nothing (`empty-lists.png`; main innerText captured as
  `… Archived Add Item LIST Priority Date` then the filter-oriented empty state). Every other
  first-run view offers a create-first-item CTA.
- **Acceptance criteria**: (1) With zero items and no active filters, the Lists view shows a
  first-run empty state whose primary action creates an item; (2) "No items match / Reset filters"
  appears only when at least one filter is active; (3) both states are covered by a test.
- **Effort**: S
- **Impact/Reach/Confidence**: 4/4/5

### U2 — "What's next" ignores time and actionability

- **Dimension**: UX/Interaction
- **Type**: misleading affordance
- **Severity**: S2
- **Files/lines**: `src/features/today/TodayView.tsx:79-81`
- **Evidence**: `nextUp` sorts today's occurrences by `(a.start ?? a.occKey).localeCompare(...)`.
  An all-day item's `start` is `YYYY-MM-DD`, which sorts **before** any `YYYY-MM-DDTHH:mm`, and no
  kind filter is applied. With a 09:00 timed task plus an all-day note, the banner reads
  `WHAT'S NEXT An all-day note that is not actionable` while `Timed task at 09:00` sits in the
  agenda below (`today-truncation.png`). Same effect surfaced a bill due in a week as
  `WHAT'S NEXT Electricity` (`light-1280-today.png`).
- **Acceptance criteria**: (1) The banner never promotes an item that has no time when a timed
  occurrence is still pending today; (2) non-actionable kinds (`note`) are excluded or explicitly
  labelled; (3) when only all-day items remain, the banner shows the item without implying a time.
- **Effort**: S
- **Impact/Reach/Confidence**: 4/4/4

### U3 — Today's sidebar sections silently drop items past a cap

- **Dimension**: UX/Interaction
- **Type**: missing feedback / information loss
- **Severity**: S3
- **Files/lines**: `src/features/today/TodayView.tsx:75` (`billsThisWeek … .slice(0, 6)`), `:126` (`overdue.slice(0, 6)`), `:248` (`goals.slice(0, 4)`)
- **Evidence**: with 7 overdue items the section badge shows `Overdue 7` but only 6 rows render
  and there is no "+1 more" link (measured `overdueBadgeCount: "7"`, `overdueRowsRendered: 6`,
  `hasMoreLink: false`; `today-truncation.png`). The count and the list therefore disagree. The
  calendar already solved this with a `+N more` affordance (IMP-053), so Today is inconsistent.
- **Acceptance criteria**: (1) When a section hides rows, it shows a "+N more" control that
  reveals them (or navigates to the full view); (2) the badge count always equals the number of
  reachable items; (3) verified for Overdue, Bills due soon and Goal progress.
- **Effort**: S
- **Impact/Reach/Confidence**: 3/3/5

### V4 — Daily-digest time input clips its AM/PM indicator

- **Dimension**: Visual
- **Type**: clipping
- **Severity**: S3
- **Files/lines**: `src/features/settings/SettingsView.tsx:283-288` (`className="input w-28"`)
- **Evidence**: `w-28` = 112px minus `px-3` leaves ~88px for a native `<input type="time">`; in
  Chromium the control renders `08:00 A` with the clock icon overlapping the truncated `M`
  (`light-1280-settings.png`, `light-390-settings.png`, `dark-390-settings.png`).
- **Acceptance criteria**: (1) The digest time input renders the full `HH:mm AM/PM` string with no
  clipping or icon overlap at 1280px and 390px, light and dark; (2) the input has an explicit
  accessible label.
- **Effort**: S
- **Impact/Reach/Confidence**: 2/3/5

### V5 — Goals header CTA wraps to two lines on mobile

- **Dimension**: Visual
- **Type**: responsive layout
- **Severity**: S3
- **Files/lines**: `src/features/goals/GoalsView.tsx:49` (`flex items-center justify-between`, no wrap/shrink guard)
- **Evidence**: at 390px the long subtitle "Break big outcomes into milestones and track progress."
  squeezes the button so `New goal` wraps to `New` / `goal` inside a 97×32 button
  (`light-390-goals.png`). Today's header already guards this with `flex flex-wrap … gap-3`
  (`TodayView.tsx:88`); Goals does not.
- **Acceptance criteria**: (1) At 390px the Goals header keeps the CTA label on one line (button
  does not wrap or shrink below its content); (2) the same pattern is applied consistently to
  Bills/Habits/Notes headers.
- **Effort**: S
- **Impact/Reach/Confidence**: 2/3/5

### V6 — Matrix quadrants reserve a fixed height, detaching the "Add" button

- **Dimension**: Visual
- **Type**: spacing / dead space
- **Severity**: S3
- **Files/lines**: `src/features/matrix/MatrixView.tsx:65` (`min-h-[16rem] flex-col`), `:81` (`flex-1`)
- **Evidence**: each quadrant is `min-h-[16rem]`; with one item (SCHEDULE on mobile, DO FIRST /
  DELEGATE on desktop) the `flex-1` list expands and pushes the `+ Add` button ~100px below the
  last card, leaving a large empty gap (`light-390-matrix.png`, `light-1280-matrix.png`). The gap
  is absent in quadrants with several items, so spacing is inconsistent between quadrants.
- **Acceptance criteria**: (1) The Add control sits directly after the last item regardless of how
  many items a quadrant holds, or the reserved space is visually filled; (2) quadrant spacing is
  consistent across all four quadrants at 1280px and 390px.
- **Effort**: S
- **Impact/Reach/Confidence**: 2/4/4

### U4 — Boot failure toast blames "local storage" for an IndexedDB failure

- **Dimension**: UX/Interaction
- **Type**: misleading error copy
- **Severity**: S3
- **Files/lines**: `src/App.tsx:48-50` (uses `STORAGE_UNAVAILABLE_MESSAGE` for a `ensureDbOpen()` rejection), `src/lib/bootFailure.ts:5-6` (message text)
- **Evidence**: with IndexedDB unavailable but `localStorage` fully working (`typeof indexedDB ===
  'undefined'` while `localStorage.setItem/getItem` returned `ls-ok:1`), the app booted and pushed
  the toast "Local storage is unavailable — changes may not be saved." plus "Data migration failed
  — some items may be missing." and "Notification settings could not be restored." The first
  message names the wrong API, so a user with a blocked/unavailable IndexedDB (private mode, storage
  partitioning) is told the wrong thing to fix.
- **Acceptance criteria**: (1) A database-open failure produces a message that names the local
  database (not "local storage"); (2) the message is only shown when persistence is genuinely
  unavailable; (3) the copy is asserted by a test on `reportBootFailure` call sites.
- **Effort**: S
- **Impact/Reach/Confidence**: 2/3/5

### V7 — Today's sidebar empty states are bare sentences, unlike the EmptyState component used elsewhere

- **Dimension**: Visual
- **Type**: inconsistency
- **Severity**: S3
- **Files/lines**: `src/features/today/TodayView.tsx:221`, `:241`, `:265`
- **Evidence**: first-run Today renders "No habits yet.", "No bills due this week.", "No goals yet."
  as plain `text-sm text-muted` paragraphs, while the same features use the shared `EmptyState`
  (icon + title + description + CTA) on their own routes — e.g. `HabitsView.tsx:81-95`,
  `GoalsView.tsx`. The mixed treatment reads as unfinished on the landing view
  (`empty-today.png` vs `empty-goals.png` / `empty-habits.png`).
- **Acceptance criteria**: (1) The three Today sidebar sections use the same empty-state pattern as
  their feature routes (or a documented compact variant); (2) at least the Habits and Goals empty
  states offer a create action.
- **Effort**: S
- **Impact/Reach/Confidence**: 2/3/4

### V8 — Badges, status pills and calendar chips use 10–11px type

- **Dimension**: Visual
- **Type**: legibility / typography scale
- **Severity**: S3
- **Files/lines**: `src/features/list/ListView.tsx:361` (kind badge `text-[10px]`), `:383` (status pill `text-[10px]`), `src/features/habits/HabitsView.tsx:145` (weekday labels `text-[10px]`), `src/features/calendar/CalendarView.tsx:222`,`:239`,`:354`,`:366` (`text-[11px]`/`text-[10px]`), `src/features/item/ItemCard.tsx:129`,`:134` (`text-[10px]`)
- **Evidence**: at 1280px these render as 10–11px text; combined with the cramped status column
  (V1) the pill is unreadable and wraps, and the calendar's month chips shrink to `Ov…` / `14:…`
  at 390px (`light-390-calendar.png`). No token or minimum size is enforced for these labels.
- **Acceptance criteria**: (1) A documented minimum label size (≥11px, ideally ≥12px) is applied to
  kind badges, status pills, weekday labels and calendar chips; (2) status/kind labels remain on one
  line at 1280px; (3) contrast of the smallest text passes AA against its background.
- **Effort**: S
- **Impact/Reach/Confidence**: 2/5/4

---

## Summary

| # | Title | Dim | Sev |
|---|-------|-----|-----|
| V1 | Lists table status/date column collision | Visual | S2 |
| V2 | Habit heatmap invisible in light mode | Visual | S2 |
| V3 | 16×16 completion + calendar tap targets | UX | S2 |
| U1 | Lists first-run empty state says "No items match" | UX | S2 |
| U2 | "What's next" ignores time/actionability | UX | S2 |
| U3 | Today sidebar sections truncate silently | UX | S3 |
| V4 | Digest time input clips AM/PM | Visual | S3 |
| V5 | Goals header CTA wraps on mobile | Visual | S3 |
| V6 | Matrix quadrants reserve fixed height | Visual | S3 |
| U4 | Boot toast blames local storage for IndexedDB | UX | S3 |
| V7 | Today sidebar empty states are bare text | Visual | S3 |
| V8 | 10–11px badge/pill/chip typography | Visual | S3 |

No S0/S1 defects found. The strongest, most verifiable defects are V1, V2, V3, U1 and U2; all five
were reproduced in both themes and with hard measurements.
