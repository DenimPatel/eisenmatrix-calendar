# discovered-IMP-050 — findings while implementing IMP-050

Out of scope for IMP-050; not fixed here. Ordered by impact.

## D1 — `item.data.streak` is a write-only denormalized field
Evidence: after IMP-050 the only writes are `toggleDone` (`src/domain/itemActions.ts`) and
`quickadd.ts:411` (initialise to zeros). A repo-wide search for `.streak` outside tests
finds **no reads**: `src/features/habits/HabitsView.tsx:48` and
`src/features/today/TodayView.tsx:196` both call `habitStreak(habit)` and render the live
result. Nothing imports `HabitData.streak`.
Impact: the persisted copy costs a write (and a history entry) per toggle and can silently
drift from the computed value — exactly the class of bug IMP-050 fixed. Same category as the
already-known write-only `defaultView` / `notificationsEnabled` settings
(REPO_PROFILE §7).
Options: (a) delete `HabitData.streak` and drop the write entirely (simplest, but
IMP-050/AC2 explicitly asked for the persisted+history-tracked write, so it would revert a
just-landed criterion); (b) keep it as an export/analytics snapshot and document that
consumers must prefer `habitStreak`; (c) have the views read `data.streak` so the field
becomes the single source of truth — cheapest consistent option, but it makes a stale
persisted value user-visible if any write path is missed.
Also note the value is redundant with `occurrences`: `habitStreak` is pure and cheap.

## D2 — `setStatus` persists the caller's whole `occurrences` map
Evidence: `src/domain/itemActions.ts` `setStatus` builds
`{ ...item.occurrences, [occKey]: {...} }` from the prop it is handed. Two concurrent
toggles (e.g. `HabitsView.markToday` double-fired, or `ReminderRuntime` acting while the
user toggles) therefore race on the whole map and the loser drops the winner's occurrence.
IMP-050's re-read makes the *streak* authoritative, but the occurrence state itself is still
clobbered by the stale map.
Impact: lost toggles under concurrency; the resulting streak is then computed from the
surviving map, so it is at least self-consistent.
Options: re-read inside `setStatus` and apply the occurrence merge to the persisted map
(same fix shape as IMP-050's), or serialize toggles per item id.

## D3 — `buildHistory` records whole-`data` diffs, not nested fields
Evidence: `buildHistory` iterates `Object.entries(patch)`, so patching `data` yields one
entry with `field: 'Data'` and `oldValue`/`newValue` set to `JSON.stringify` of the whole
payload. IMP-050's streak change is therefore recorded, but a reader cannot diff it without
parsing JSON, and unrelated `data` edits appear in the same entry.
Impact: low; history is display-only today.
Options: leave as is, or teach `buildHistory` an optional JSON pointer prefix for `data`
keys (e.g. `field: 'Data.streak'`). Any change alters existing snapshots, so it belongs in
its own item with test updates.

## D4 — Habit toggles are the only occurrence mutation that also rewrites `data`
Evidence: `toggleDone` is the sole caller of the streak path; `ItemCard`'s completion of a
non-habit recurring item goes through `setStatus` only.
Impact: none observed. Recorded because it means IMP-050's `trackUndo: false` precedent is
currently unique to the derived-streak write and future derived-field writes should follow
the same "share the source write's undo entry" rule rather than pushing their own.