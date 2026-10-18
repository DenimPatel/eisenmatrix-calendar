# discovered-IMP-096 — unrelated observations

No new unrelated defects were found while implementing IMP-096. Two notes for triage:

1. **Streak derivation cost (perf, minor).** `streakPatch` runs `habitStreak` on every habit
   status write. `habitStreak` expands occurrences from up to 12 months back and walks up to 400
   periods, so each toggle now does that work inside the write transaction. It is bounded and was
   already done by `toggleDone` before this change (just outside the transaction), so this is not a
   regression; it is only worth revisiting if a bulk habit-status path appears.

2. **IMP-097 remains open.** `updateRecurring`, `skipOccurrence`, `saveItem` and `patchItem` still
   do a read followed by a separate `patchItem` write. IMP-096 does not touch them; they are the
   tracked follow-up (same IMP-089 root cause).
