# Discovery 4 — UX / Interaction Audit

Scope: real user flows on all 10 nav routes plus the item editor, quick add, command palette,
shortcut sheet and Help dialog — quick-add parsing/preview/kind-switch/commit; editor tabs,
scope switching, reminder and recurrence editors, occurrence-vs-series actions; keyboard-only
operation (Tab order, focus, Escape, shortcuts); Today/Matrix/Calendar/List/Habits/Goals/Bills/
Shopping/Notes interactions; drag-and-drop; empty and error states; mobile 390px. Read-only on
`src`; the only file written is this report.

Method: `npm run preview` builds served at `http://localhost:4173/eisenmatrix-calendar/`
(per AGENTS.md, SW registrations and caches unregistered/deleted and an `about:blank`
round-trip forced before testing). **The 4173 origin is shared with concurrent discovery
peers:** mid-session the `eisenmatrix` IndexedDB was externally replaced (580 seeded items,
then a 26-item fixture) which invalidated clean-state repros. Every finding below was therefore
**re-confirmed on an isolated origin** (`vite preview --port 4180`, a separate IndexedDB) unless
noted; the peer confirmed on the board that its destructive seeding had finished. Viewports:
1280×800 and 390×844 (plus 390×667 for one scroll check). Dark/light both used; all findings
are theme-independent. Console: zero errors/warnings throughout the interaction sweeps.

Reviewed first and **not** re-proposed: IMP-091/106/108/109 (open TODOs) and the
`discover4-visual` items V1–V10; DONE items were skipped per brief (notably IMP-009/013/016/
037/050/054/055/057/069/079/093/123/126/130 and IMP-017, which stays BLOCKED).

## What is already healthy (no item raised)

- **Drag-and-drop works** end-to-end: dragging a Matrix card between quadrants reprioritises it
  (`AppShell.handleDragEnd` → `setPriority`); a false negative during the shared-origin window
  was traced to my drop target being the wrong quadrant's placeholder, not a defect.
- **Occurrence vs series actions** are correct: "Skip this occurrence" removes only that day and
  leaves the rest; "This and future" splits the series and re-times only the tail; "All
  occurrences" edits the whole (post-split) series without re-anchoring the start.
- **Editor tabs** implement the full pattern (roving `tabIndex`, Arrow/Home/End, `aria-selected`);
  **command palette** implements `aria-activedescendant`/`role=option`/no-results correctly.
- Editor focus trap, Escape-to-close with focus restore to the opener, the IMP-013 overlay
  shortcut guard, and the mobile bottom nav (all 10 destinations) all behave correctly.
- Mobile item editor fits 390×844 and scrolls correctly at 390×667 with Save reachable.

---

### U1 — Make the quick-add preview reflect the Kind/Date/Time overrides

- **Area / files:** `src/features/quickadd/QuickAdd.tsx:154-163` (chips render `parsed.chips`),
  `:35` (`effectiveKind`), `:164-190` (Kind/Date/Time controls).
- **Evidence:** route `#/today`, 1280×800. Press `c`, type
  `pay electricity $120 every month on the 5th !urgent`. The preview chips read
  `bill · 2026-10-18 · every month on the 5 · USD 120 · Urgent`. Change **Kind** to `Event`
  (then `Note`) in the preview form: the chips **do not change** — still `bill`, `USD 120`,
  recurrence and `Urgent`. Committing with Kind = Note stored a `note` whose `data` is
  `{pinned:false}` (no amount) while the preview had promised a bill with USD 120.
- **Intent:** the dialog's own copy says "Chips show what will be created — edit before
  committing"; the chips contradict the controls the user just edited, so the last thing they
  see before committing is wrong.
- **Acceptance criteria:**
  1. Changing Kind updates the preview's kind chip (and hides chips whose field no longer
     applies, e.g. amount/recurrence for a Note) before commit.
  2. Changing the Date or Time control updates the corresponding date/time chip.
  3. With no override, the chips are byte-identical to today's output.
- **Verification method:** Playwright at preview: fill the sample, read chip texts, switch Kind
  to each value and change Date/Time, assert the chips track the controls; assert an
  un-overridden input is unchanged. Add a jsdom test in `QuickAdd`/`quickadd.test.ts` asserting
  the rendered chip list derives from `effectiveKind` + overrides.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/4/5 (score 15) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-054 preserved parsed *data* on a kind change (commit path) and
  IMP-018's note mentions only the missing "Daily" hint; neither covers the preview chips
  ignoring the override controls, and `discover4-visual` audited pixels, not this flow.

### U2 — Show the first real occurrence, not the series anchor, in the quick-add preview

- **Area / files:** `src/features/quickadd/QuickAdd.tsx:53-56` (commit sets `start` from
  `parsed.start`/today), `:178` (Date control value), `src/domain/quickadd.ts` (`quickAddToItem`).
- **Evidence:** route `#/today`, 1280×800. Quick-add `pay rent every month on the 5th` (today is
  2026-10-18). The preview shows Date `2026-10-18` and chip `2026-10-18`, and the Date control is
  `2026-10-18`. After Add, the item is **absent from Today** and from October's Calendar month
  grid; it first appears on **Nov 5** (Calendar → Next). Lists shows it with Date `2026-10-18`,
  a day it never occurs on. Contrast IMP-011: `party on the 5th` *without* recurrence correctly
  resolves to the next 5th — the same words with `every month` resolve to today instead.
- **Intent:** a user adding "pay rent every month on the 5th" is shown today's date and then sees
  nothing today; the preview should show the first occurrence the rule actually produces.
- **Acceptance criteria:**
  1. For a monthly rule whose anchor day-of-month is before today, the preview Date (chip and
     control) equals the next occurrence date, not the anchor.
  2. The created item's first occurrence is the date the preview showed (Today/Calendar agree).
  3. Non-recurring inputs keep IMP-011 behaviour; rules whose anchor already matches are
     unchanged.
- **Verification method:** Playwright: quick-add the sample, assert the preview Date equals the
  first date the item appears on in the Calendar month grid, and that Today lists it when that
  date is today. Unit-assert the derived first-occurrence date in `quickadd.test.ts`.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/3/5 (score 15) **Effort:** S/M **Risk:** med
- **Depends on:** U1 (same preview surface)
- **Not covered because:** IMP-011 scoped the non-recurring month-day case; no item covers the
  recurring month-day anchor-vs-first-occurrence mismatch, and the visual sweep checked layout.

### U3 — Disable or scope-label Subtasks when the editor scope is "This occurrence"

- **Area / files:** `src/features/item/ItemEditorSheet.tsx:493-536` (Subtasks block, **not**
  wrapped in `SeriesOnlyGroup`), contrast `:538-591` (Checklist, wrapped) and the banner copy at
  `:334-340` ("Fields marked “Applies to the whole series” are disabled for this scope").
- **Evidence:** route `#/calendar`, 1280×800, open a recurring occurrence (scope defaults to
  "This occurrence"). The Urgency/Importance/List/Tags/Estimate/Energy/Checklist controls are
  disabled (fieldset) and labelled; the **Add subtask** input and every subtask checkbox remain
  enabled. Typing a subtask and pressing Enter while scoped to one occurrence created a child
  item with `parentId` = the series id (verified in IndexedDB), i.e. a series-wide change made
  under a scope whose own text says it cannot happen.
- **Intent:** the scope banner makes a promise the Subtasks control breaks, so a user editing one
  occurrence silently mutates the whole series.
- **Acceptance criteria:**
  1. Under "This occurrence", the Subtasks/Milestones input and child checkboxes are disabled
     and labelled with the series-only hint, matching Checklist.
  2. Under "This and future" and "All occurrences" they are enabled as today.
  3. No subtask can be created from the editor while the occurrence scope is active.
- **Verification method:** Playwright: open an occurrence, assert the Add-subtask input is
  `:disabled` and carries the series-only hint; assert it is enabled for the other two scopes.
  Add a `ItemEditorSheet.test.tsx` case asserting the disabled state per scope.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/3/5 (score 15) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-016 enumerated the occurrence-ownable fields and disabled the
  series-only ones, but the Subtasks block was left out; IMP-095 concerns *draft* subtasks on
  Cancel, a different behaviour.

### U4 — Expose the editor's occurrence-scope selector state to assistive tech

- **Area / files:** `src/features/item/ItemEditorSheet.tsx:311-333` (three `<button>`s, active
  state only via `cn(...)`, no `aria-pressed`/`aria-selected`, no group role).
- **Evidence:** route `#/calendar`, 1280×800, open a recurring occurrence. Querying the three
  buttons `This occurrence` / `This and future` / `All occurrences` returns
  `aria-pressed: null` for all three; the active one is distinguishable only by
  `bg-amber-100`. This control decides what Save writes (one occurrence / the tail / the series),
  so a screen-reader user cannot tell which destructive-ish scope is selected.
- **Intent:** scope is the highest-consequence choice in the editor; its state must not be
  colour-only.
- **Acceptance criteria:**
  1. The selected scope button exposes `aria-pressed="true"` (or `aria-selected` in a
     `tablist`/`radiogroup`), and the others `false`.
  2. A group name/label identifies the control ("Apply changes to").
  3. No visual change; keyboard activation still switches scope.
- **Verification method:** Playwright: assert exactly one scope button reports pressed/selected
  after open and after each click; screenshot diff to confirm no visual change. Run the four
  gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 3/3/5 (score 15) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-123 added ARIA state to `Tabs` and the recurrence weekday picker
  only; this bespoke scope selector (added for IMP-016) was not in its scope.

### U5 — Give the Calendar Day/Week/Month/Year switcher a selected state and group label

- **Area / files:** `src/features/calendar/CalendarView.tsx:135-147`.
- **Evidence:** route `#/calendar`, 1280×800. The four view buttons expose no `aria-pressed`,
  no `aria-selected`, no group role; the active view is colour-only (`bg-accent`). The
  accessibility snapshot names them `day`/`week`/`month`/`year` (lowercase, from the raw token)
  with no group context, so neither the active view nor the control's purpose is announced.
- **Intent:** the view switcher is the primary control on the Calendar; a colour-only active
  state hides which of four mutually exclusive modes is on.
- **Acceptance criteria:**
  1. The active view button exposes `aria-pressed="true"` (or `radiogroup`/`aria-checked`).
  2. The group has an accessible name (e.g. "Calendar view").
  3. Button labels are the capitalised display labels ("Day", "Week", "Month", "Year"); no
     visual change.
- **Verification method:** Playwright: assert the pressed/checked state follows each click and
  the group has a name; screenshot diff for no visual change. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/4/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-033/IMP-123 covered Settings/Notes/Bills toggles, `Tabs` and the
  weekday picker; the Calendar mode switcher was never in those file lists.

### U6 — Make Settings reachable by number key or fix the "1 – 9" claim

- **Area / files:** `src/features/shell/nav.ts:32` (`shortcut: ''` for Settings),
  `src/features/shell/helpContent.ts:11` (`1 – 9` / "Jump to a view"),
  `src/features/command/CommandPalette.tsx:45` (`hint` omitted when no shortcut).
- **Evidence:** route any, 1280×800. There are **10** nav destinations; `1`–`9` map to Today…
  Notes and Settings has none. Pressing `0` does nothing (verified: `9 → /notes`, `0 → /notes`
  unchanged). The shortcut sheet advertises "Jump to a view: 1 – 9" and the command palette's
  "Go to Settings" row is the only "Go to …" entry with **no** `⌘` hint, so a keyboard user is
  given no way to learn or use a key for the 10th view.
- **Intent:** the documented shortcut set should cover every view, or say what it covers; a
  silent 10th view is a discoverability dead end for keyboard users.
- **Acceptance criteria:**
  1. Either Settings gets a number key (e.g. `0`) listed in the sheet and the palette hint, or
     the sheet copy states the exact key range and the palette shows a consistent hint.
  2. Pressing the chosen key navigates to `#/settings` and no longer no-ops.
  3. Existing `1`–`9` mappings are unchanged.
- **Verification method:** Playwright: press the chosen key, assert the route; assert the sheet
  row and palette hint text. Extend the `useKeyboardShortcuts`/nav unit tests.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-024 covered *mobile reachability* of all destinations; no item
  addresses the number-key set versus the 10-view count or the sheet's "1 – 9" wording.

### U7 — Treat the Archived toggle as an active filter in the Lists empty state

- **Area / files:** `src/features/list/ListView.tsx:135-140` (`hasActiveFilter` omits
  `showArchived`), `:423-460` (empty-state branch), `:246-249` (the toggle).
- **Evidence:** route `#/lists`, 1280×800, with items present and none archived. Tick
  **Archived**: the table empties and shows the first-run empty state
  "**No items yet** — Add your first task, event or note to get started. [Add item]". The user is
  browsing the archive, not looking at a first-run app, and the offered action ("Add item") adds
  a *live* item, not an archived one.
- **Intent:** the empty state should describe the state the user asked for, and its CTA should
  not create something that immediately disappears from the current view.
- **Acceptance criteria:**
  1. With Archived on and zero archived items, the empty state says the archive is empty (not
     "No items yet") and its action is "Reset filters"/"Show live items", not "Add item".
  2. The un-filtered first-run empty state is unchanged.
  3. Other active filters keep the existing "No items match" state.
- **Verification method:** Playwright: toggle Archived with no archived items, assert the title
  and the CTA label; extend the ListView test suite with the archived-empty case. Run the gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-101 decided the first-run CTA vs "No items match" split; the
  Archived toggle was added later and was never folded into `hasActiveFilter`.

### U8 — Make the Shopping add box match its placeholder (parse quantity/unit or stop promising it)

- **Area / files:** `src/features/shopping/ShoppingView.tsx:64-71` (`addItem` stores the raw
  draft as the title), `:141-143` (placeholder "Add item and press Enter (e.g. milk 2L)"), and the
  empty-state copy "Add groceries with quantity and aisle" at `:172-176`.
- **Evidence:** route `#/shopping`, 1280×800. Type `bananas 2kg` into the add box and press
  Enter: the row renders `bananas 2kg` with quantity `1` and the editor shows Quantity `1`,
  Unit empty, Aisle `Uncategorised` — the `2kg` stayed in the title. The identical string typed
  into **quick add** parses to title `Milk` with `2 l` (chip "2 l"), so the two entry points
  disagree while the Shopping placeholder implies the parsing one.
- **Intent:** the placeholder teaches a syntax the field does not implement, so users get
  untidy titles and wrong quantities/prices (which feed the estimated total).
- **Acceptance criteria:**
  1. Either `addItem` parses the same quantity/unit/price tokens quick add does, or the
     placeholder/copy stops advertising them (e.g. "Add item name…").
  2. A parsed `bananas 2kg` yields title `Bananas`, quantity `2`, unit `kg`, and the estimated
     total reflects it.
  3. Plain titles with no numbers are stored verbatim.
- **Verification method:** Playwright: add `bananas 2kg` via the Shopping box and assert the row
  title/quantity; compare with the quick-add result. Add a unit test on the shared parser if the
  parsing path is reused.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/4 (score 8) **Effort:** S/M **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-007/054 touched the quick-add parser; no item covers the Shopping
  view's own add box, whose placeholder was written to match quick-add but whose handler is a
  plain title write.

### U9 — Do not push an undo entry or "Saved" toast for an unchanged save

- **Area / files:** `src/domain/itemActions.ts:82-104` (`saveItem` pushes
  `Edit “<title>”` + toast unconditionally when the row exists);
  `src/features/item/ItemEditorSheet.tsx:214+` (`handleSave`).
- **Evidence:** route `#/lists`, 1280×800. Open an item and press **Save** without editing
  anything: a **"Saved"** toast appears and an undo entry is pushed. Pressing `⌘Z` then reports
  **"Undone"** although nothing visibly changed (the closure re-creates the identical row). So
  the undo stack fills with no-ops and undo appears to do nothing.
- **Intent:** "every action is undoable" only holds if the stack contains real actions; a no-op
  entry makes `⌘Z` feel broken and hides the real previous action one step further down.
- **Acceptance criteria:**
  1. Saving with no field change pushes no undo entry and shows no "Saved" toast (the editor
     still closes).
  2. Saving with at least one change keeps the current single-entry undo/toast behaviour.
  3. Repeated open→Save→close does not grow the undo stack.
- **Verification method:** Add an `itemActions.test.ts` case asserting the undo depth is
  unchanged after `saveItem` with an identical item and incremented after a real edit;
  Playwright: open→Save, assert no toast and that `⌘Z` reports the *previous* action.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/4/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-069 made *creates* undoable and IMP-087 fixed parent-undo
  orphans; neither considers the no-op edit path, and no visual/UX sweep exercises Save-without-
  changes.

### U10 — Give the Calendar month grid arrow-key navigation instead of 35+ tab stops

- **Area / files:** `src/features/calendar/CalendarView.tsx:179-250` (each day cell renders a
  focusable `Add item on <date>` button; no `role="grid"`/`row`/`gridcell`, no roving tabindex).
- **Evidence:** route `#/calendar` (default Month), 1280×800. The main region exposes **59
  tabbable buttons, 35 of them** `Add item on YYYY-MM-DD` (one per day cell), and **zero**
  `role="grid"`/`row`/`gridcell` nodes. A keyboard user must Tab through every day (and every
  other control) to move across the grid; there is no Arrow-key movement and no way to skip it.
- **Intent:** the month grid is the densest interactive surface in the app; one tab stop per day
  makes keyboard navigation impractical and the grid is not announced as a table of dates.
- **Acceptance criteria:**
  1. The month grid is exposed as a grid/table with row/column context (or each day's accessible
     name includes its full date).
  2. Only one cell is in the tab order at a time and Arrow keys move between cells (roving
     tabindex), with Home/End/PageUp/PageDown as appropriate.
  3. The total tab stops in the Calendar main region drop accordingly; mouse behaviour and the
     `+`/chip interactions are unchanged.
- **Verification method:** Playwright: assert the grid role structure and that ArrowRight/Left
  move focus between day cells while Tab leaves the grid; count tab stops before/after. Run the
  four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 3/3/5 (score 15) **Effort:** M **Risk:** med
- **Depends on:** none
- **Not covered because:** IMP-049/IMP-100 touched the calendar's week start and tap targets;
  IMP-053 the "+N more" affordance; none addresses keyboard traversal of the day grid, and the
  visual sweep only measured pixels.

### U11 — Keep the reminder control consistent when All day is toggled

- **Area / files:** `src/features/item/ReminderEditor.tsx:23-26` (`add` seeds `timeOfDay` when
  all-day), `:60-77` (control chosen by the current `allDay`, value from
  `offsetMinutes ?? -10`), `src/domain/reminders.ts:19-28` (fire time: `offsetMinutes` wins,
  else `timeOfDay`), `:158` (label: `timeOfDay` wins → "At HH:mm").
- **Evidence:** route `#/today`, 1280×800. New task → Schedule → check **All day** → **Add**
  reminder (creates `{timeOfDay:'09:00'}`). Uncheck **All day**: the reminder row now shows the
  offset `<select>` reading **"10 min before"** while the label span beside it reads
  **"At 09:00"** — and the stored reminder still has `timeOfDay` and no `offsetMinutes`, so it
  actually fires at 09:00 (the label), not 10 minutes before start (the select). The two halves
  of the same row contradict each other.
- **Intent:** the reminder's displayed value must equal the fire time it will use; a contradictory
  row makes the reminder untrustworthy and can fire at an unintended time.
- **Acceptance criteria:**
  1. Toggling All day off converts a time-of-day reminder to a real offset (or clears it), so the
     control value and the fire time agree; the row never shows two different times.
  2. Toggling All day on converts an offset reminder to a time-of-day (or clears it) with the
     same agreement.
  3. A reminder added and left untouched keeps its intended time across the toggle.
- **Verification method:** Playwright: reproduce the toggle and assert the select value and the
  label text describe the same instant; add a `reminders.test.ts` case asserting
  `reminderFireTime` matches `formatReminderLabel` for a toggled reminder. Run the four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/3/5 (score 15) **Effort:** S **Risk:** med
- **Depends on:** IMP-119 (reminder helper tests)
- **Not covered because:** IMP-110/119/128 concern fire-time evaluation windows and the absolute-
  reminder product decision; no item covers the all-day↔timed toggle leaving a reminder in a
  mixed state, and the visual sweep only checked that the control renders.

---

## Summary

| # | Title | Sev | I/R/C | Score | Effort |
|---|-------|-----|-------|-------|--------|
| U1 | Quick-add preview ignores Kind/Date/Time overrides | S2 | 3/4/5 | 15 | S |
| U2 | Quick-add shows the anchor, not the first occurrence | S2 | 3/3/5 | 15 | S/M |
| U3 | Occurrence scope leaves Subtasks enabled (series-wide write) | S2 | 3/3/5 | 15 | S |
| U4 | Editor scope selector has no ARIA selected state | S3 | 3/3/5 | 15 | S |
| U5 | Calendar view switcher has no ARIA selected state/group | S3 | 2/4/5 | 10 | S |
| U6 | Settings unreachable by number key vs the "1 – 9" claim | S3 | 2/3/5 | 10 | S |
| U7 | Lists Archived toggle isn't an active filter → wrong empty state | S3 | 2/3/5 | 10 | S |
| U8 | Shopping add box doesn't parse the quantity its placeholder shows | S3 | 2/3/4 | 8 | S/M |
| U9 | No-op save pushes an undo entry and "Saved" toast | S3 | 2/4/5 | 10 | S |
| U10 | Calendar month grid is 35+ tab stops, no arrow-key/grid semantics | S3 | 3/3/5 | 15 | M |
| U11 | Reminder row contradicts itself after the All-day toggle | S2 | 3/3/5 | 15 | S |

No S0/S1 defects found; every flow that mutates data (DnD, skip/split/delete, bulk actions,
habit completion, bill paid, note/quick-add creation) was exercised and behaved correctly. The
strongest, most objectively verifiable findings are **U3** (a scope promise broken by an enabled
control that writes series-wide data), **U1** (the preview contradicts the controls the user
just edited, verified with the created row) and **U11** (a single reminder row displaying two
different fire times, verified against `reminderFireTime`). **U2** and **U10** are the highest-
effort and therefore the most likely to be deferred.
