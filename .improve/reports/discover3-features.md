# Discovery round 3 — product/feature · accessibility · performance · docs

Read-only code review of `src/features/*`, `src/components/ui/*`, `src/App.tsx`, `src/store`,
`src/hooks`, `src/types`, plus `dist/` bundle output. No browser used (port 4173 busy).
Scope deliberately excludes items already titled in `.improve/FEATURES.md` (IMP-001…IMP-097),
including the nearby ones IMP-009/057/059 (overlay focus), IMP-027 (dialog names), IMP-033
(toggles/sortable ARIA), IMP-053 (`+N more`), IMP-060 (shared live query), IMP-065 (SW reset),
IMP-091 (mobile List header), IMP-094 (scroll lock).

---

### F1 — Form controls have no accessible name (editor, settings, quick add, command palette)
- **Dimension:** Accessibility
- **Type:** bug (a11y)
- **Severity:** S2
- **Files/lines:** `src/components/ui/Form.tsx:28-40` (`Field` renders `<label htmlFor={htmlFor}>`
  but no call site passes `htmlFor`/`id`); `src/features/item/ItemEditorSheet.tsx:385-447,594-670`;
  `src/features/item/KindFields.tsx:17-305`; `src/features/item/RecurrenceEditor.tsx:54-165`;
  `src/features/item/ReminderEditor.tsx:56-73`; `src/features/settings/SettingsView.tsx:226-254,321-331,283-288`;
  placeholder-only: `src/features/shopping/ShoppingView.tsx:122-130,146-152`,
  `src/features/list/ListView.tsx:191-196`, `src/features/notes/NotesView.tsx:54-62`,
  `src/features/quickadd/QuickAdd.tsx:116-128`, `src/features/command/CommandPalette.tsx:93-115`,
  `src/features/item/ItemEditorSheet.tsx:467-478`.
- **Evidence:** `Field`'s label is a sibling of the control and `htmlFor` is never supplied, so
  every editor field (Title, Notes, Status, Urgency, List, Start, Due, End, recurrence, reminder
  offset, amount, quantity…) is programmatically unlabelled; several other controls rely on
  `placeholder` alone, which is not an accessible name. `getByLabelText` cannot find these inputs.
- **Acceptance criteria:** Every `<input>`/`<select>`/`<textarea>` in the editor, settings,
  quick add, command palette and shopping/list/notes capture resolves to an accessible name
  (axe `label` clean; `getByLabelText` works in tests). No visual change; existing tests pass.
- **Effort:** M **Impact:** 4 **Reach:** 5 **Confidence:** 5

### F2 — ProgressRing has no progress semantics
- **Dimension:** Accessibility
- **Type:** bug (a11y)
- **Severity:** S2
- **Files/lines:** `src/components/ui/ProgressRing.tsx:32-59`; consumers
  `src/features/today/TodayView.tsx:159,202-208,257`, `src/features/goals/GoalsView.tsx:88`.
- **Evidence:** The component renders raw `<svg>` + a text node with no `role`, no `aria-label`,
  no `aria-valuenow`. A custom `label` (e.g. `✓` / `0` in TodayView) replaces the percentage, so
  a screen reader gets either a bare symbol or nothing; goal/habit progress is invisible to AT.
- **Acceptance criteria:** The ring exposes `role="progressbar"` (or `img`) with an accessible name
  including its value and the surrounding item context; Today and Goals snapshots show it; tests pass.
- **Effort:** S **Impact:** 3 **Reach:** 4 **Confidence:** 5

### F3 — Custom controls miss ARIA state / keyboard semantics (Tabs, recurrence weekday toggles)
- **Dimension:** Accessibility
- **Type:** bug (a11y)
- **Severity:** S2
- **Files/lines:** `src/components/ui/Tabs.tsx:16-36` (role=tablist/tab but no `tabpanel`,
  `aria-controls`, roving `tabIndex`, no `type="button"`); used at
  `src/features/item/ItemEditorSheet.tsx:371-381`; `src/features/item/RecurrenceEditor.tsx:75-92`
  (weekday buttons: no `aria-pressed`, single-letter labels).
- **Evidence:** IMP-033 fixed toggles in Settings/Notes/Bills/Habits but the shared `Tabs`
  component and the recurrence weekday picker were not in its file list. Tabs cannot be moved with
  arrow keys and the active weekday state is conveyed only by background color.
- **Acceptance criteria:** Tabs are arrow-key operable, only the active tab is tabbable, and panels
  are associated via `aria-controls`/`aria-labelledby`; weekday buttons expose `aria-pressed` and a
  full weekday name. No visual change; tests pass.
- **Effort:** S **Impact:** 3 **Reach:** 4 **Confidence:** 5

### F4 — Habit heatmap encodes data by colour only, with no legend or per-day text
- **Dimension:** Accessibility
- **Type:** bug (a11y)
- **Severity:** S3
- **Files/lines:** `src/features/habits/HabitsView.tsx:151-175` (cells are `<div>`s with `title`
  only, inside one `role="img"` labelled `"… completion heatmap"`).
- **Evidence:** Four green intensities (lines 166-170) are the sole encoding; `title` tooltips are
  not keyboard-reachable and are not exposed under `role="img"`. Colour-blind and screen-reader
  users cannot recover per-day values, and there is no legend explaining the shades.
- **Acceptance criteria:** A visible "less → more" legend and an accessible per-day/per-week summary
  (grid/table or `aria-describedby` text) so the data is available without colour; tests pass.
- **Effort:** M **Impact:** 3 **Reach:** 3 **Confidence:** 4

### F5 — No skip link and no labelled/addressable main landmark
- **Dimension:** Accessibility
- **Type:** improvement
- **Severity:** S3
- **Files/lines:** `src/features/shell/AppShell.tsx:212` (`<main>` has no `id`/`tabIndex`); nav
  landmarks are already distinctly named at `:122` and `MobileBottomNav.tsx:43`.
- **Evidence:** Keyboard users must tab through the full nav rail (10 links + actions) on every
  view before reaching content; there is no bypass mechanism and `<main>` cannot be focused.
- **Acceptance criteria:** The first Tab reveals a "Skip to content" link that moves focus to
  `<main id="main" tabIndex={-1}>`; the link is visually hidden until focused. Tests pass.
- **Effort:** S **Impact:** 2 **Reach:** 4 **Confidence:** 5

### F6 — Habits on the Today dashboard cannot be completed from Today
- **Dimension:** UX/Interaction
- **Type:** missing feature
- **Severity:** S2
- **Files/lines:** `src/features/today/TodayView.tsx:196-220` (only a static `ProgressRing` and an
  "Edit" button); contrast `src/features/habits/HabitsView.tsx:60-63,104-117` which has a real toggle.
- **Evidence:** README:27 promises "habit rings" on Today, but the ring is display-only; checking a
  habit requires navigating to Habits. `toggleDone` + `expandOccurrences` already exist for this.
- **Acceptance criteria:** Clicking a Today habit ring/row toggles today's occurrence (same path as
  `HabitsView.markToday`), updating the ring and streak in place without leaving Today; tests pass.
- **Effort:** S **Impact:** 4 **Reach:** 4 **Confidence:** 5

### F7 — Notes cannot be attached to an item (README promise unreachable)
- **Dimension:** UX/Interaction
- **Type:** missing feature
- **Severity:** S2
- **Files/lines:** `src/features/item/KindFields.tsx:296-305` (note editor exposes only `pinned`);
  `src/types/item.ts:51` (`parentId` exists on `BaseItem`); `src/domain/itemFactory.ts:90,134`
  already honours `parentId`; `src/features/notes/NotesView.tsx` never shows an attachment.
- **Evidence:** README:40 states "Notes — pinned quick notes, attachable to any item", but no UI
  sets `parentId` for a note and nothing surfaces an attached note.
- **Acceptance criteria:** The note editor offers an "Attach to" item selector (and a clear
  option); an attached note is discoverable from its parent (badge or list); the link survives
  JSON/CSV round-trip. Tests cover set/clear.
- **Effort:** M **Impact:** 3 **Reach:** 3 **Confidence:** 4

### F8 — Absolute one-off reminders cannot be created in the UI (README promise)
- **Dimension:** UX/Interaction
- **Type:** missing feature
- **Severity:** S2
- **Files/lines:** `src/types/item.ts:13-14` (`absolute?: number` supported); 
  `src/features/item/ReminderEditor.tsx:24-74` only offers offset presets (timed) or a time-of-day
  (all-day); `absolute` is written only by snooze at `src/pwa/ReminderRuntime.tsx:171-175`.
- **Evidence:** README:41 promises reminders "relative or absolute"; the type and reminder engine
  support `absolute`, but the editor has no way to enter one.
- **Acceptance criteria:** A user can add a reminder at an explicit date/time, persisted as
  `absolute`, labelled in the editor; fires once via the existing `upcomingReminders` path. Tests pass.
- **Effort:** M **Impact:** 3 **Reach:** 3 **Confidence:** 4

### F9 — "New shopping list" uses `window.prompt` instead of the app Dialog
- **Dimension:** UX/Interaction
- **Type:** improvement
- **Severity:** S2
- **Files/lines:** `src/features/shopping/ShoppingView.tsx:94-110`.
- **Evidence:** `window.prompt` is unstyled, blocks the main thread, and is not focus-trapped or
  announced by the app; every other capture uses `Dialog`/`Field` (`SettingsView.tsx:365-389`).
- **Acceptance criteria:** "List" opens the app `Dialog` with a labelled input; Enter/OK creates the
  list and selects it, Esc/Cancel is a no-op; no `window.prompt` remains. Tests cover both paths.
- **Effort:** S **Impact:** 3 **Reach:** 3 **Confidence:** 5

### F10 — Destructive bulk/shopping actions run without confirmation or undo
- **Dimension:** UX/Interaction
- **Type:** improvement
- **Severity:** S2
- **Files/lines:** `src/features/list/ListView.tsx:95-98` (`bulkDelete`),
  `src/features/shopping/ShoppingView.tsx:87-92` (`clearPurchased`).
- **Evidence:** One click deletes every selected item / every purchased row; Settings already routes
  its destructive reset through `ConfirmDialog` (`SettingsView.tsx:381-389`), so the pattern exists.
- **Acceptance criteria:** Both actions route through `ConfirmDialog` (or produce a toast with an
  Undo action) before deleting; Cancel leaves data untouched; tests cover confirm + cancel.
- **Effort:** S **Impact:** 3 **Reach:** 3 **Confidence:** 5

### F11 — Year view expands every item 12 times
- **Dimension:** Performance
- **Type:** improvement
- **Severity:** S2
- **Files/lines:** `src/features/calendar/CalendarView.tsx:328-341` (each `YearMonthCard` calls
  `useOccurrences(items, from, to)`), `src/hooks/useOccurrences.ts:8-18`.
- **Evidence:** Switching to year mode runs `expandOccurrences` over **all** items once per month
  (12 separate full passes) instead of one pass over the year; with many recurring items this is a
  visible jank hotspot on the least-optimised view.
- **Acceptance criteria:** Year view computes occurrences once for the year and buckets them by
  month; instrumentation shows ≤1 expansion pass; rendered output is unchanged; tests pass.
- **Effort:** M **Impact:** 3 **Reach:** 3 **Confidence:** 4

### F12 — Item editor recomputes 120-day analytics on every keystroke
- **Dimension:** Performance
- **Type:** improvement
- **Severity:** S3
- **Files/lines:** `src/features/item/ItemEditorSheet.tsx:146-154`.
- **Evidence:** The `analytics` `useMemo` depends on `draft` and runs `itemCompletionStats` +
  `expandOccurrences` over a 120-day window; `draft` changes on every character typed into Title
  or Notes (lines 390, 399), so the expansion re-runs even when the Analytics tab is closed.
- **Acceptance criteria:** Analytics are computed only when `tab === 'analytics'` (or memoized on
  `draft.id`/`draft.recurrence`), with identical output; typing stays responsive; tests pass.
- **Effort:** S **Impact:** 3 **Reach:** 3 **Confidence:** 5

### F13 — All ten views ship in one 384 KB entry chunk; split by route
- **Dimension:** Performance
- **Type:** improvement
- **Severity:** S3
- **Files/lines:** `src/App.tsx:4-19` eagerly imports every view; `vite.config.ts:61-72` only splits
  vendors; `dist/assets/index-BiLfn1F7.js` = 384 KB raw / ~115 KB gzip (measured from existing `dist/`).
- **Evidence:** Views are statically imported, so Calendar/List/Command (and their lucide icons) are
  in the first-load chunk even when the user opens Today; vendor chunks are already separated.
- **Acceptance criteria:** Views load via `React.lazy` behind a `Suspense` fallback; the entry chunk
  shrinks materially and first paint of Today is unchanged; `npm run build`/tests pass.
- **Effort:** M **Impact:** 3 **Reach:** 4 **Confidence:** 3

### F14 — No in-app Help entry point (quick-add syntax, shortcuts, backup guidance)
- **Dimension:** Docs/Onboarding
- **Type:** missing feature
- **Severity:** S3
- **Files/lines:** `src/features/shell/ShortcutSheet.tsx:5-14` (shortcuts only, opened from the
  header `?`/keyboard button); `src/features/settings/SettingsView.tsx:357-363` ("About" card has
  no help link); `src/features/quickadd/QuickAdd.tsx:17-21` examples only appear transiently.
- **Evidence:** README documents quick-add syntax (`README:44-45`), recurrence, and the export
  formats, but the app exposes none of it beyond the shortcut list; a first-run user has no
  discoverable place to learn `pay electricity $120 every month on the 5th`.
- **Acceptance criteria:** A reachable "Help" surface (e.g. from Settings → About and/or the
  shortcut sheet) lists quick-add syntax examples, the keyboard shortcuts, and a one-line note on
  JSON vs CSV vs ICS. Reachable by keyboard; tests assert the entry point opens it.
- **Effort:** S **Impact:** 3 **Reach:** 3 **Confidence:** 4
