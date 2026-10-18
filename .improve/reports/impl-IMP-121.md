# impl-IMP-121 — Give every form control an accessible name

**Status:** done

## Change

The bug was structural: `Field` rendered a sibling `<label>` but never tied it to the
control, so no call site could produce an accessible name, and several controls relied on
`placeholder` alone.

### Shared fix — `src/components/ui/Form.tsx`

`Field` now generates an id with `useId()` and clones a single labelable child
(`input`/`select`/`textarea`, or a custom control like `Select` that forwards its props)
to carry it, so the rendered `<label htmlFor>` associates with the control. Wrapper
children (a `<div>`/`<fieldset>` holding several controls) are left untouched — one `for`
cannot name several inputs — and the label stays presentational, exactly as before. No
markup or class change is visible. This fixes every `Field` call site at once: the editor
(Title, Notes, Status, Urgency, Importance, List), `KindFields`, `RecurrenceEditor` and
the settings selects.

### Explicit names for placeholder-only / wrapper controls

- `src/features/item/ItemEditorSheet.tsx` — `aria-label` on the tag input ("Add tag"),
  the subtask/milestone input ("Add subtask" / "Add milestone"), the checklist input
  ("Add checklist item"), the checklist checkbox (`entry.text`), and the two inputs in
  the "Start" wrapper ("Start date", "Start time").
- `src/features/item/ReminderEditor.tsx` — the labelless `Field`s now name their controls
  ("Reminder time", "Reminder offset").
- `src/features/settings/SettingsView.tsx` — "Daily digest time".
- `src/features/shopping/ShoppingView.tsx` — "Add shopping item", "Filter by list".
- `src/features/list/ListView.tsx` — "New list name", "Search items", "Filter by kind",
  "Filter by status", "Move selected to list".
- `src/features/notes/NotesView.tsx` — "New note".
- `src/features/quickadd/QuickAdd.tsx` — "Quick add" (Kind/Date/Time already use wrapping
  `<label>`s).
- `src/features/command/CommandPalette.tsx` — "Search commands".

## Tests

`src/features/a11yFormControls.test.tsx` (new, no new dependency). It implements a
reduced accessible-name computation (aria-label → aria-labelledby → `label[for]` →
wrapping label → title), which is what `getByLabelText` matches on, plus:

- a `getByLabelText(host, text)` helper that asserts exactly one control matches;
- an axe-like `unnamedControls(host)` check that the `label` rule would flag.

Suites cover the item editor (details + schedule, task and bill kinds), settings, quick
add (including the revealed Kind/Date/Time overrides), the command palette, and the
notes/shopping/list captures. Every mounted surface asserts zero unnamed controls and
looks up representative controls by label text.

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check` — all pass
(48 files, 543 tests).

## Browser verification

Built `dist/`, ran `npm run preview`, unregistered the service worker and cleared caches,
then reloaded through `about:blank`. With the final bundle:

- quick add input resolves to the name "Quick add";
- `#/settings`, `#/lists`, `#/notes`, `#/shopping`, `#/today` each report zero unnamed
  controls;
- a new task in the editor reports zero unnamed controls on both the Details and Schedule
  tabs (Schedule names: All day, Start date, Due, End).

## Notes / out of scope

`GoalsView.tsx`'s placeholder-only "Add milestone…" input is not in IMP-121's file list
and was left unchanged.
