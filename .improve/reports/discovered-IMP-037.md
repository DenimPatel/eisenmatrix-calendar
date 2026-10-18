# Discovered while implementing IMP-037 (unrelated to the item)

1. ~~**`updateRecurring` future split of a just-created recurrence is degenerate.**~~
   **Resolved in IMP-037 (F1):** the future branch now treats a rule-less persisted row as
   scope `all` (patches the row with the draft's rule) instead of splitting it.
2. **`ItemEditorSheet.handleSave` still routes scope `all` through `saveItem`**, which pushes an
   "Edit …" undo entry rather than a series-scoped one; a series-wide save and an
   occurrence-scoped save therefore produce differently labelled undo entries. Cosmetic.
3. **`seriesPatch` never carries `recurrence`**, so a rule edited in the RecurrenceEditor is only
   persisted through the future-branch guard above or through `saveItem`; for a normal split the
   tail keeps the *stored* rule rather than the edited one. No test covers an edited rule on
   "this and future". Worth a dedicated look.

No other defects observed in the touched files.
- Verifier2 R1/R2: invalid occKey same-id head/tail latent; edited recurrence rule dropped on future split (check)
