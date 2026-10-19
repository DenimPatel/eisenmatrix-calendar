# Discovered while implementing IMP-143 (unrelated findings)

## 1. Occurrence-scoped All-day toggle does not reconcile reminders (low)

`ItemEditorSheet.update()` strips `reminders` when the scope is a single occurrence
(`SERIES_ONLY_FIELDS`). Toggling All day while scoped to one occurrence therefore changes
`allDay`/`start` but discards the `reconcileReminderMode` result. This is now harmless for
display: rows render by their own stored shape, so a leftover `timeOfDay` reminder on a timed
occurrence shows the time input and the "At HH:mm" label (agreement holds). The reminder also
still fires at that same clock time on the occurrence day, which is arguably the intended
series-level behavior. Not a defect in the current product surface (the reminder editor is
disabled under that scope), but the reconciliation is intentionally a no-op there — worth a
note if a future item lets reminders be edited per occurrence.

## 2. Triggerless reminder rows are now read-only (informational)

A reminder with no `absolute`/`timeOfDay`/`offsetMinutes` (possible via import or legacy data)
previously rendered the offset select defaulting to `-10` beside the label "Reminder" — the
same class of contradiction as U11. It now renders a read-only "Reminder" field, so the two
halves agree, but the user cannot repair such a row from the editor. No item covers this; low
severity, import-only shape.
