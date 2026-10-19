# Discovered while implementing IMP-138 (unrelated to the fix)

- `quickAddToItem` derives `item.recurrence` from the *parsed* kind, so switching a parsed
  recurring kind to another kind previously kept the rule (already logged by IMP-054 for
  habit→task). IMP-138 only clears it for the non-recurring `note` kind when the kind is
  overridden; the general "recurrence should follow the effective kind" question remains
  open and is out of scope here.

- `src/domain/itemFactory.ts` exports `isRecurringKind` (`habit`/`bill`) which has no
  callers in `src/`; it does not match the model (tasks/events/goals/shopping can recur),
  so it could not be reused for the preview applicability decision. Candidate dead code.

- Not a defect, no action needed: the quick-add Date control still shows the series anchor
  date for a recurring month-day rule (the U2 finding in `discover4-ux.md`), which is a
  separate backlog item.
