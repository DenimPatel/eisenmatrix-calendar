# Discovery 4 — Visual / Experience Audit

Scope: all 10 nav routes (Today, Calendar, Matrix, Lists, Goals, Habits, Bills, Shopping,
Notes, Settings) plus the item editor, quick add, command palette, Help dialog and the
shortcut sheet, at **1280×800** and **390×844**, in **light and dark**. Read-only on `src`.

Build/browser method: `npm run preview` at http://localhost:4173/eisenmatrix-calendar/.
Service-worker registrations and caches were unregistered/deleted and an `about:blank`
round-trip was forced before every capture, per AGENTS.md "Browser verification", so the
screenshots reflect the current `dist/` bundle and not a stale precache. Both a **first-run
(empty) database** (DB deleted, then all 10 routes re-visited) and a **populated** database
(seeded through the UI via quick add, the Notes composer and the goal/bill editors) were
audited. Raw screenshots and measured probes are in `.improve/artifacts/discover4/`.

Existing `IMP-*` items and the `discover3-visual` findings (promoted to IMP-098…IMP-109)
were reviewed first. IMP-091/106/108/109 are open TODOs and are **not** re-proposed here;
the calendar-chip truncation at 390px and the Matrix quadrant dead space seen during this
sweep belong to IMP-109 and IMP-106 respectively and are excluded.

## What is already healthy (no item raised)

- Dark-mode tokens: no white-on-white / black-on-black found on any route; `text-muted` on
  `bg`/`surface` and the 10–11px pills all measured ≥4.7:1 (except the accent-soft case V10).
- Empty states on Goals, Habits, Bills, Shopping, Notes, Lists, Matrix, Today are rich
  (icon + title + description + CTA) and render correctly in both themes.
- Calendar Day/Week/Month/Year views, the recurrence editor weekday picker, the reminder
  editor, the goal/habit/bill kind fields and the mobile item-editor sheet all render
  without clipping or overflow at both widths and themes.
- Native `<select>`/date/datetime controls adopt `color-scheme: dark` correctly in dark mode.

---

### V1 — Stop the item editor's Start-time control clipping its AM/PM indicator

- **Area / files:** `src/features/item/ItemEditorSheet.tsx:629` (`className="input w-28"`);
  contrast with the already-fixed digest input `src/features/settings/SettingsView.tsx:288`
  (`input w-36`) and its regression test `src/features/settings/SettingsView.test.tsx:240`.
- **Evidence:** route `#/lists` → open the timed task editor → Schedule tab, 1280×800, light
  (`.improve/artifacts/discover4/light-1280-editor-reminders.png`,
  `.improve/artifacts/discover4/zoom-editor-starttime.png`). The native time input renders
  `03:00 P` with the clock icon drawn over the truncated `M`; measured box is 112×40 with
  `px-3` (24px of padding) leaving ~88px of content. IMP-104 widened the *digest* input for
  exactly this symptom but the editor's `w-28` was left behind.
- **Intent:** the editor is the primary scheduling surface; a user setting a start time
  cannot read the meridiem, and the same defect was already judged worth fixing elsewhere.
- **Acceptance criteria:**
  1. The Start-time input renders the full `HH:mm AM/PM` string with no clipping or icon
     overlap at 1280px and 390px, in light and dark.
  2. The Start-time input's content box is wide enough for `12:00 AM` plus the native clock
     affordance (no `w-28`).
  3. The same width guard is applied consistently to every `<input type="time">` in the app.
- **Verification method:** Playwright at 1280×800 open a timed item, screenshot the
  Start-time input and assert its rendered text is not truncated (or add a unit assertion
  mirroring `SettingsView.test.tsx:240` that no `input[type=time]` carries `w-28`). Run the
  four gates.
- **Severity:** S2 **Impact/Reach/Confidence:** 3/4/5 (score 15) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-104 scoped only the Settings daily-digest input; the editor's
  `w-28` time control is a separate file/line and was not part of that item or of IMP-109.

### V2 — Keep the small ProgressRing label inside the ring

- **Area / files:** `src/components/ui/ProgressRing.tsx:79-80` (absolute label span,
  `text-xs font-semibold`), `src/features/today/TodayView.tsx:202-207` (`size={28}`,
  `strokeWidth={3}`).
- **Evidence:** route `#/today`, Today's-agenda header, 1280×800 and 390×844, light and dark
  (`.improve/artifacts/discover4/zoom-today-ring-1280.png`,
  `.improve/artifacts/discover4/zoom-today-ring-390.png`). With 2/5 done the ring renders
  `40%` and the `%` glyph crosses the 3px accent stroke; the ring is 28×28 → 22px inner
  diameter, while `40%` at 12px semibold measures ≈30px and is centred, so it overhangs the
  stroke on both sides.
- **Intent:** the agenda header is the first status indicator on the landing view; a label
  that collides with the ring reads as a rendering bug and reduces legibility.
- **Acceptance criteria:**
  1. For any 0–100% value at `size={28}` the label's rendered width ≤ the ring's inner
     diameter (or the label is omitted/abbreviated at small sizes).
  2. No glyph of the label overlaps the ring stroke at 1280px or 390px, light or dark.
  3. Larger rings (≥40px) keep the current label appearance.
- **Verification method:** Playwright measure the label span width versus
  `size - 2*strokeWidth` for `40%`/`100%` at `size={28}`; screenshot both themes. Run the
  four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 3/4/5 (score 15) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-122 added the progressbar semantics and IMP-109 covers badge
  font sizes; neither addresses label overflow inside `ProgressRing`.

### V3 — Stop dialog and sheet headings rendering as boxed, input-like fields

- **Area / files:** `src/components/ui/Dialog.tsx:89-96` (`<h2 tabIndex={-1}
  className="… outline-none">`), `src/styles/index.css:64-66` (`:focus-visible { @apply
  outline-none ring-2 ring-accent ring-offset-2 ring-offset-bg }`),
  `src/features/shell/HelpDialog.tsx:28` and `src/features/shell/ShortcutSheet.tsx:19`
  (`initialFocusRef={headingRef}`).
- **Evidence:** routes via header buttons, 1280×800 light
  (`.improve/artifacts/discover4/light-1280-help.png`,
  `.improve/artifacts/discover4/light-1280-shortcuts.png`) and 390×844
  (`.improve/artifacts/discover4/light-390-help.png`). The focused `<h2>` computes
  `box-shadow: rgb(248,250,252) 0 0 0 2px, rgb(79,70,229) 0 0 0 4px` — the accent focus ring
  wraps the title text, so "Help & syntax" and "Keyboard shortcuts" look like editable text
  inputs with a caret box.
- **Intent:** two overlays open with their heading framed as if it were a form field, which
  misleads users about what is interactive and looks broken on first open.
- **Acceptance criteria:**
  1. When the Help dialog and the shortcut sheet open, their `<h2>` renders with no visible
     ring/box (computed `box-shadow` contains no accent ring).
  2. Focus still moves into the overlay and Tab stays trapped (IMP-057 behaviour unchanged).
  3. No other dialog that focuses a non-interactive heading shows a focus box.
- **Verification method:** Playwright open each overlay, assert the focused element's
  computed `box-shadow` has no ring, and screenshot; keep the existing focus-trap test
  green. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** IMP-057 (focus behaviour)
- **Not covered because:** IMP-057 delivered the initial-focus behaviour itself; the visual
  consequence of focusing a `tabIndex={-1}` heading under the global ring rule was not
  captured by any item.

### V4 — Show date-only controls for an all-day item's Due and End

- **Area / files:** `src/features/item/ItemEditorSheet.tsx:644-660` (Due, always
  `type="datetime-local"`), `:663-676` (End, always `type="datetime-local"`), versus
  `:611-642` (Start, `type="date"` + optional `type="time"`).
- **Evidence:** open a recurring/all-day task → Schedule, 1280×800, light
  (`.improve/artifacts/discover4/light-1280-editor-schedule.png`,
  `…/light-1280-editor-schedule-all.png`) and dark
  (`…/dark-1280-editor-schedule.png`). With **All day** checked, Start shows `10/18/2026`
  while Due and End render datetime-local controls showing `10/18/2026, 12:00 AM` — a
  midnight time on a date-only item.
- **Intent:** an all-day item has no time; showing `12:00 AM` in the Due/End controls
  implies a midnight deadline and makes the three schedule controls inconsistent.
- **Acceptance criteria:**
  1. When **All day** is checked, Due and End render date-only controls (no time segment).
  2. When **All day** is unchecked, Due and End keep their current datetime behaviour.
  3. An all-day item round-trips without gaining a time component.
- **Verification method:** Playwright toggle All day on an item and assert the Due/End input
  types switch to `date` and the value has no `T`/time; screenshot both themes. Run the four
  gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/4 (score 8) **Effort:** S/M **Risk:** med
- **Depends on:** none
- **Not covered because:** no existing item addresses the schedule-control type mismatch for
  all-day items; IMP-104 only touched input *width*.

### V5 — Give the native checkbox a theme-consistent unchecked appearance in dark mode

- **Area / files:** `src/components/ui/Form.tsx:70-74` (checkbox classes
  `… rounded border-border bg-surface text-accent accent-[rgb(var(--accent))]`; no
  `appearance-none`), used across Lists, Shopping, Matrix, the editor and Settings.
- **Evidence:** route `#/lists`, 1280×800, dark (`.improve/artifacts/discover4/dark-1280-lists.png`,
  `…/zoom-dark-checkbox.png`) versus light (`…/light-1280-lists.png`). In light an unchecked
  box is a white square with a light border; in dark the same control paints a **solid
  grey/olive filled square** (computed `background-color: rgb(15,23,42)` is ignored by the
  UA dark rendering), so unchecked boxes read as filled/disabled while only the checked
  state is tinted.
- **Intent:** the primary completion/selection control should look empty when unchecked and
  identical in structure across themes; a filled-looking unchecked box is ambiguous.
- **Acceptance criteria:**
  1. In dark mode an unchecked checkbox is visually distinguishable from a filled/disabled
     control (empty interior with a visible border, or a documented custom appearance).
  2. Checked and unchecked states differ by more than fill colour alone (e.g. a checkmark).
  3. Light-mode appearance is unchanged and the 24×24 target size (IMP-100) is preserved.
- **Verification method:** Playwright at 1280×800 dark screenshot an unchecked checkbox at
  4× zoom and assert its rendered interior is not a uniform fill (or that
  `appearance: none` + explicit styles are applied); compare with light. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/4/3 (score 6) **Effort:** S **Risk:** low
- **Depends on:** IMP-100 (target size)
- **Not covered because:** no item covers the native checkbox's cross-theme rendering; the
  dark-mode token sweep (discover3) only checked CSS utility classes, not UA-painted controls.

### V6 — Keep the toast stack from covering modal form fields on mobile

- **Area / files:** `src/components/ui/ToastHost.tsx:21` (`fixed … z-[60]`,
  `w-[min(92vw,22rem)]`, bottom offset tuned to the mobile nav), versus
  `src/components/ui/Sheet.tsx:55` (`z-50`) and `src/components/ui/Dialog.tsx:67` (`z-50`).
- **Evidence:** route `#/habits` at 390×844, light, with the habit editor open while two
  quick-add toasts are live (`.improve/artifacts/discover4/light-390-habit-editor.png`): the
  toast stack (near-full-width at 92vw) is painted over the sheet's `Per`/`Unit`/`List`
  fields and its `pointer-events-auto` body intercepts taps on them until it auto-dismisses.
- **Intent:** on mobile a full-width toast over a full-width sheet hides the very fields the
  user is editing and can swallow a tap.
- **Acceptance criteria:**
  1. While a sheet/dialog is open at 390px, the toast stack does not overlap the modal's
     form area (or is repositioned/inset so no control is covered).
  2. Toasts remain dismissible and the Undo action stays reachable.
  3. No change to desktop toast placement.
- **Verification method:** Playwright at 390×844 open the editor with ≥2 toasts live, assert
  no toast rectangle intersects a form control rectangle; screenshot. Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/4 (score 8) **Effort:** S **Risk:** low
- **Depends on:** IMP-094 (scroll-lock layering) conceptually
- **Not covered because:** IMP-094 concerns body scroll locking; the toast stack's z-order and
  footprint over open overlays on mobile is a separate, unrecorded behaviour.

### V7 — Stop the mobile Lists panel reserving a large blank area below its rows

- **Area / files:** `src/features/list/ListView.tsx:206` (`card flex min-h-[30rem] flex-col
  overflow-hidden`), `:287` (`flex min-h-0 flex-1 flex-col` table body).
- **Evidence:** route `#/lists` at 390×844, light, with one item
  (`.improve/artifacts/discover4/seed-light-390-lists-long.png`). Measured: the row's content
  bottom sits **111px above** the card's bottom, and the card is 620px tall with
  `scrollHeight === clientHeight` (nothing to scroll) — a large empty void under a single
  row. At 1280px with the same data the card ends directly under the row
  (`…/seed-light-1280-lists-long.png`), so the void is mobile-only.
- **Intent:** a mostly empty 30rem panel on a phone reads as an unfinished/broken list and
  pushes the toast and bottom nav into an otherwise empty screen.
- **Acceptance criteria:**
  1. At 390px the Lists panel shrinks to its content when fewer than a screenful of rows is
     present (or the reserved space is filled with the empty-state affordance).
  2. Panel spacing is consistent between the 1280px and 390px layouts for the same data.
  3. With many rows the panel still scrolls rather than growing unbounded.
- **Verification method:** Playwright at 390×844 with 1 item assert the gap between the last
  row and the card bottom is below a small threshold; screenshot with 1 and with 15 items.
  Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/4 (score 8) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-106 is scoped to the Matrix quadrants' `min-h-[16rem]`; this is
  the Lists panel's `min-h-[30rem]`, a different file and route.

### V8 — Give the Calendar month view a first-run empty affordance

- **Area / files:** `src/features/calendar/CalendarView.tsx:179-250` (month grid renders
  unconditionally), compared with the day-view `AgendaList` empty state at
  `:267-273` (`EmptyState` "Nothing scheduled").
- **Evidence:** route `#/calendar` (default Month view) on a freshly cleared database,
  1280×800 light (`.improve/artifacts/discover4/empty-light-1280-calendar.png`) and 390×844
  (from the same sweep): the view is a bare 6×7 grid with a `+` per day and **no** message or
  create CTA, while Today/Lists/Goals/Habits/Bills/Shopping/Notes/Matrix all show a
  first-run empty state with copy and a primary action.
- **Intent:** the default Calendar view on first run looks like an empty, unexplained
  scaffold next to eight sibling views that onboard the user.
- **Acceptance criteria:**
  1. With zero occurrences in the visible range, the month view shows an empty-state
     (message + create action) that does not obscure the day cells' `+` affordances.
  2. The same treatment is applied consistently across Day/Week/Month/Year.
  3. With at least one occurrence the month view is unchanged.
- **Verification method:** Playwright on a cleared DB at 1280px and 390px assert an
  empty-state node is present in the Month view and screenshot both themes. Run the four
  gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/4 (score 8) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** IMP-101 covered the Lists empty state only; the Calendar month
  view's missing first-run affordance is not in any item.

### V9 — Stop the command palette clipping its last row at the list boundary

- **Area / files:** `src/features/command/CommandPalette.tsx:130` (`max-h-[50vh]
  space-y-0.5 overflow-y-auto`), `:132-151` (40 un-padded option buttons).
- **Evidence:** press ⌘K at 1280×800 light (`.improve/artifacts/discover4/light-1280-palette.png`):
  the scroll container ends mid-row and the final visible option ("New Task") is sliced
  horizontally with no fade, inset or "scroll for more" cue. At 390px the shorter sheet
  happens to end cleanly (`…/light-390-palette.png`), confirming the clip is the container's
  fixed `50vh` cap rather than the content.
- **Intent:** a half-cut row at the panel edge looks like broken rendering and hides that the
  list scrolls.
- **Acceptance criteria:**
  1. The palette's scroll container either snaps to whole rows (container height a multiple
     of the row height) or fades/insets the clipped edge.
  2. No option is rendered partially visible at the container boundary when the list
     overflows.
  3. Keyboard navigation still scrolls the active row fully into view.
- **Verification method:** Playwright at 1280×800 assert the last fully-visible option's
  bottom ≤ the container's bottom (no partial row) or that a fade element exists; screenshot.
  Run the four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 1/2/3 (score 3) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** the command-palette scroll behaviour was listed only as a
  below-the-cut note in FEATURES.md ("command-palette active-row scroll"), not as an item, and
  that note is about the active row, not the clipped boundary.

### V10 — Raise muted-on-accent-soft text to AA

- **Area / files:** `src/features/command/CommandPalette.tsx:147` (`text-xs text-muted` hint on
  the active `bg-accent-soft` row), `src/features/list/ListView.tsx` (selected-row count badge
  `text-muted` on `bg-accent-soft`), tokens `src/styles/index.css:11,15` (`--muted: 100 116
  139`, `--accent-soft: 238 242 255`).
- **Evidence:** measured in the live DOM, 1280×800 light: the palette's active-row hint
  (`⌘ 1`, 12px) computes `color: rgb(100,116,139)` on `background: rgb(238,242,255)` =
  **4.26:1**, and the Lists sidebar count badge computes the same pair at 4.26:1 — both below
  the 4.5:1 AA threshold for normal-size text. Dark mode measures ≈5.8:1 (passes), so this is
  light-mode only.
- **Intent:** the app already treats AA contrast as a requirement (DIMENSIONS accessibility
  health 4); the one token pairing that misses it is the muted text on accent-soft selected
  surfaces, used for keyboard hints and counts.
- **Acceptance criteria:**
  1. `text-muted` on `bg-accent-soft` measures ≥4.5:1 in light mode (or the pairing is
     replaced with a darker muted token).
  2. The palette hint and the Lists count badge both pass AA in light and dark.
  3. No other `bg-accent-soft` surface regresses.
- **Verification method:** Playwright compute the contrast ratio of every
  `text-muted`-on-`bg-accent-soft` element on the palette and Lists and assert ≥4.5:1; run the
  four gates.
- **Severity:** S3 **Impact/Reach/Confidence:** 2/3/5 (score 10) **Effort:** S **Risk:** low
- **Depends on:** none
- **Not covered because:** discover3's contrast checks covered `text-muted` on `bg`/`surface`
  and the status pills, not on `bg-accent-soft`; no IMP item records this token pairing.

---

## Summary

| # | Title | Sev | I/R/C | Score | Effort |
|---|-------|-----|-------|-------|--------|
| V1 | Editor Start-time clips AM/PM | S2 | 3/4/5 | 15 | S |
| V2 | ProgressRing label overflows the ring | S3 | 3/4/5 | 15 | S |
| V3 | Dialog/sheet headings render boxed like inputs | S3 | 2/3/5 | 10 | S |
| V4 | All-day item shows datetime "12:00 AM" Due/End | S3 | 2/3/4 | 8 | S/M |
| V5 | Dark-mode unchecked checkbox looks filled | S3 | 2/4/3 | 6 | S |
| V6 | Toasts cover modal form fields on mobile | S3 | 2/3/4 | 8 | S |
| V7 | Mobile Lists panel reserves a 111px blank void | S3 | 2/3/4 | 8 | S |
| V8 | Calendar month view has no first-run affordance | S3 | 2/3/4 | 8 | S |
| V9 | Command palette clips its last row | S3 | 1/2/3 | 3 | S |
| V10 | Muted-on-accent-soft text is 4.26:1 (<AA) | S3 | 2/3/5 | 10 | S |

No S0/S1 defects found; the visual dimension remains broadly healthy. The strongest,
most objectively verifiable findings are **V1** (clipping with an existing in-repo precedent
test), **V2** (measured label-vs-ring geometry) and **V10** (measured contrast ratio).
V3, V4, V6, V7 and V8 are visible in the captured screenshots; V5 and V9 are the weakest and
are included for completeness.
