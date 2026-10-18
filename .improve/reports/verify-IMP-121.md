# verify-IMP-121 — Independent review: accessible names for form controls

**Reviewer:** independent skeptical pass (source unmodified)
**Branch:** `improve/auto-20261017` (working tree, uncommitted)
**Verdict:** PASS — acceptance criteria met; two latent robustness bugs in the shared
`Field` fix, none exercised by any current call site and none regressing existing
behavior.

## Diff reviewed

`git status`/`git diff` vs the criteria in `.improve/FEATURES.md:1936-1949`:

- `src/components/ui/Form.tsx` — `Field` now `useId()`s an id and clones a single
  labelable child (`input`/`select`/`textarea`, or a custom component) to carry it.
- Explicit `aria-label`s added: `ItemEditorSheet.tsx` (tag, subtask/milestone,
  checklist input, checklist checkbox, Start date/time), `ReminderEditor.tsx`,
  `SettingsView.tsx`, `ShoppingView.tsx`, `ListView.tsx`, `NotesView.tsx`,
  `QuickAdd.tsx`, `CommandPalette.tsx`.
- `.improve/FEATURES.md` status TODO→DONE; new `src/features/a11yFormControls.test.tsx`.

Criteria 1 (every `input`/`select`/`textarea` in the editor, settings, quick add,
command palette and the shopping/list/notes capture resolves to a name): **met**.
Criterion 2 (no visual change; existing tests pass): **met** — the only class change is
none; label markup unchanged apart from `htmlFor`.

## Gates

```
npm run typecheck   PASS
npm run lint        PASS
npm run test        PASS  (48 files, 543 tests)
npm run format:check PASS
```

## Browser sweep (preview build, 4173)

Rebuilt `dist/`, ran `npm run preview`, unregistered the service worker, deleted all
caches, bounced through `about:blank` to force a real document load. Computed a reduced
accessible name (aria-label → aria-labelledby → `label[for]` → wrapping label → button
content → title → placeholder → value) for every
`input:not([type=hidden])`, `select`, `textarea`, `button`.

Surfaces swept: all 10 routes (`today`, `calendar`, `matrix`, `lists`, `goals`,
`habits`, `bills`, `shopping`, `notes`, `settings`), the item editor Details tab, the
Schedule tab, the revealed Recurrence editor (Every/Frequency/Ends), the Reminder editor,
quick add (base + revealed Kind/Date/Time), the command palette, and the editor Delete
confirmation dialog.

Result: **0 controls with no accessible name; 0 placeholder-only controls; 0 duplicate
ids; 0 dangling `label[for]`** on every surface. Named examples observed: Title, Notes,
Status, Urgency, Importance, List, Add tag, Add subtask, Add checklist item, Start date,
Start time, Due, End, Every, Frequency, Ends, Reminder time, Reminder offset, Week
starts on, On import conflict, Daily digest time, Quick add, Kind, Date, Time, Search
commands, New note, Add shopping item, Filter by list, New list name, Search items,
Filter by kind, Filter by status.

## cloneElement edge cases (temporary test, removed after running)

A throwaway jsdom test was run against `Field` and then deleted; `git status` confirms no
residue.

| Case | Result |
| --- | --- |
| non-element child (string) | safe; no clone; label stays presentational (`for` null) |
| multiple children (array) | safe; no clone; label presentational |
| child that already has an `id` | **latent bug**: label `for="_r_2_"` while input keeps `id="mine"` → dangling `for`, association fails |
| same form rendered twice | distinct ids (`_r_3_`, `_r_4_`); each label resolves; no duplicate ids |
| fragment child | **latent bug**: `isLabelableChild(<></>)` is true (type is a Symbol, not a string); the id passed to the Fragment is dropped → dangling `for` |
| `htmlFor` prop + child with a different `id` | dangling `for="external"` |

No current call site triggers the three dangling cases (no `Field` child sets `id`, no
`Field` child is a fragment, no caller passes `htmlFor`), so no existing test breaks and
no current control is affected. They are robustness gaps in the shared fix, not
regressions: before this change the same controls were already unnamed, and the only new
artifact is an invalid (dangling) `for` attribute. A one-line hardening
(`controlId = htmlFor ?? children?.props?.id ?? autoId`, and restricting
`isLabelableChild` to string tags plus known custom controls) would close all three.

Custom components generally: `isLabelableChild` returns true for *any* non-string element
type. This is correct for `Select` (it forwards `{...props}`), and `Select` is the only
custom `Field` child today, but a future wrapper-style child that does not forward `id`
would silently produce a dangling `for` and an unnamed control.

## Double-naming / wrapping-label check

- Checklist checkbox (`ItemEditorSheet.tsx:537`): `aria-label={entry.text}` and the
  checkbox is a **sibling** of the text span, not wrapped in a `<label>` — a single name,
  no double naming. `entry.text` is always trimmed non-empty by `addChecklistEntry`
  (`:251-255`), so the name is never empty.
- `KindFields` checkboxes (Autopay, Purchased, Pin) and the editor "All day" checkbox are
  wrapped by a `<label>` and carry **no** `aria-label` → named once by the wrapping label.
  No conflict introduced.

## Out of scope (disclosed)

`GoalsView.tsx:128-130` "Add milestone…" is still placeholder-only and unnamed. It is not
in IMP-121's acceptance-criteria surface (editor, settings, quick add, command palette,
shopping/list/notes) and the implementation report states this plainly. It would be a
cleanup candidate but does not affect the verdict.

## Notes

The new `a11yFormControls.test.tsx` reimplements accessible-name computation rather than
using axe (no new dependency). It resolves `label[for]` by the control's own `id`, so it
would catch a dangling `for` if a case exercised one; it is otherwise self-referential
for the `Select` path (assumes props forward, which holds). It is an acceptable proxy for
axe's `label` rule for the mechanisms this app uses.
