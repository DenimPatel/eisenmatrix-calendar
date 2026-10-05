# impl-IMP-050 — Habit completion records undo/history and uses fresh state

## Files
- `src/domain/itemActions.ts` (`toggleDone`, `patchItem`)
- `src/domain/itemActions.test.ts` (3 new cases)

## What changed
`toggleDone` previously built a *local* `updated` item from the caller's possibly-stale
prop, computed `habitStreak(updated)` and wrote it with a raw
`itemRepo.update(item.id, { data })`. That write recorded no history entry, pushed no undo
entry, and derived the streak from a prop that may lag the database.

Now, after `setStatus` has persisted the occurrence change, `toggleDone` re-reads the row
(`itemRepo.get(item.id)`), computes `habitStreak(persisted)` from the persisted
post-toggle occurrence state, and persists it through
`patchItem(item.id, { data: { ...persisted.data, streak } }, { silent: true, trackUndo: false })`.
Non-habit kinds return early, so the raw `itemRepo.update` call is gone from this module's
habit path.

`patchItem` gained one option, `trackUndo`, mirroring the existing `trackHistory`: when
`false` the patch is persisted and recorded in history but no undo entry is pushed.

## Why `trackUndo: false`
The streak is *derived* state: it is a pure function of the occurrence state that
`setStatus` just wrote. That write already pushed an undo entry whose closure restores the
whole pre-toggle snapshot — including the pre-toggle `data.streak`. If the derived streak
write pushed a second entry, the LIFO stack would pop it first, and it restores the
snapshot taken *between* the two writes (occurrence `done`, streak still stale). One
Cmd+Z would then visibly do nothing and the user would have to press it twice. Sharing the
occurrence write's undo entry makes a single undo restore both the occurrence status and
`data.streak` (AC3), which is what the spec's verification recipe requires.

## Acceptance criteria
1. Re-read after `setStatus` and compute from persisted state — yes: `itemRepo.get(item.id)`,
   early return when the row is gone, then `habitStreak(persisted)`. Asserted by
   *"computes the streak from the persisted occurrences, not the stale prop"*: the toggle is
   given a prop whose `occurrences` map is empty while two prior days are persisted as done,
   so the persisted state (streak `current: 2`) wins over the prop (`0`).
2. Persist through `patchItem` — yes; the raw `itemRepo.update` is gone, and
   `buildHistory` records a `Data` entry (old/new JSON carrying the streak values).
   Asserted in the first test. The write stays silent (no toast), per the item's notes.
3. Toggle then undo restores status and streak — yes: the first test asserts the occurrence
   is back to not-done, `data.streak` equals the pre-toggle value, and the persisted row
   deep-equals the pre-toggle snapshot after a **single** `undo()`.

## Commands + results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (23 files, 173 tests), re-run twice more, all green
- `npm run build` — PASS (`dist/sw.js`, 18 precache entries)

## Verification notes
Mutation-checked against the pre-change file: reverting `toggleDone` to the old body fails
2 of the 3 new cases (history entry, persisted-state streak); dropping `trackUndo: false`
fails 2 (single undo entry, undo restores both fields); feeding `habitStreak(item)` the
stale prop instead of the re-read fails 2. The remaining case (single undo entry) passes on
the old code by construction — it is the guard that keeps the fix from regressing AC3.

## Uncertainties
- AC2's parenthetical ("records history and pushes an undo entry") is satisfied at the
  toggle level rather than by the streak write itself; a literal second entry would
  contradict AC3. Rationale above.
- `buildHistory` only walks top-level patch keys, so the streak change is recorded as one
  `Data` entry rather than a `Streak` entry. Nested-field history would be its own item.
- `item.data.streak` has no reader in the app (both habit views call `habitStreak` live) —
  see `.improve/reports/discovered-IMP-050.md` D1.
- `setStatus` still persists the caller's whole `occurrences` map, so a stale prop can
  clobber a concurrently written occurrence (D2). Out of scope here; IMP-050 only required
  the streak to be derived from fresh state.