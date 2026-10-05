# discovered-IMP-023 — out-of-scope findings

Observed while implementing IMP-023; not fixed here to stay inside the item's acceptance
criteria. Several belong to IMP-037, which already owns `updateRecurring`'s `future` branch
and lists "count handling follows IMP-023" as AC4.

- **The `future` branch still builds the head from the patched draft, so past occurrences
  receive the edit.** `updateRecurring(item, 'future', …)` receives the editor's draft and
  `splitSeries(item, …)` copies it into both halves, so a retitled "Standup (retro)" also
  renames the head's occurrences before the split. IMP-037 AC1 fixes this by building the
  head from the persisted row; my `itemRepo.get(item.id)` read only compares the three date
  anchors and does not touch the title/notes fields.
- **A split still pushes no undo entry.** `updateRecurring`'s `future` branch calls
  `itemRepo.create` twice and pushes nothing onto the undo stack, so a split cannot be
  reverted from the UI. IMP-037 AC2. Deliberately untouched here: the count math is
  independent of undo, and adding it would double-implement IMP-037.
- **Splitting a series whose `until` already ended produces an empty tail row.** With the
  head clamped to the original `until` (see `impl-IMP-023.md`) and the tail anchored on a
  later split key, both halves can be empty of the tail's part: `updateRecurring` still
  persists a recurring row that generates zero occurrences. Before this change the head was
  extended instead and grew phantom occurrences; the empty tail is the lesser defect, but a
  "split point is past the end of the series" guard belongs at the action or editor level.
- **A deliberately edited `start` without a matching `end` collapses the tail's range.** The
  editor exposes `start` and `end` independently, and the `future` branch now applies an
  edited `start` while keeping the anchored `end`, so `tail.end` can precede `tail.start`.
  `deriveOccurrenceEnd` falls back to the occurrence start, so the tail renders as a
  zero-length event instead of throwing. A paired edit (move both, or normalise the end to
  the start) would be the fix; it belongs with the editor's schedule tab.
- **`recurrence.exceptions` and `recurrence.overrides` are copied wholesale into the tail.**
  Harmless for expansion (`candidateDates` never emits a day before the tail's new start, so
  head-range overrides/exceptions are inert there, and head-cut overrides are inert in the
  head), but the stored payload now duplicates those maps across two rows and both are
  written to JSON/ICS export. Pruning them to the tail's own range is a tidy-up, not a
  correctness fix.
- **The head's `count` is left at the original value.** Redundant because the head is
  `until`-bound, and keeping it means the head still honours `count` if its `until` is ever
  widened. Left as-is deliberately.
- **IMP-041's other sites are untouched.** `parseLocalDate(item.start)!` still exists at
  `src/domain/stats.ts:52` (and at `stats.ts:92-93` over occurrence keys), so a habit with a
  malformed `start` can still throw inside `habitStreak`. IMP-023's note only asked for the
  `splitSeries` guard, which is now done.
- **The 20-count test series in `itemActions.test.ts` reaches for `db.items` directly.** My
  new `future`-scope test needed to find the generated tail id (the action does not return
  it), so it reads `db.items.toArray()`. `src/db/` is the only place allowed to touch Dexie,
  and the test file is an existing exception, but a returned tail id from `updateRecurring`
  would remove the need — a natural small addition to IMP-037, which is already changing that
  function's signature area.