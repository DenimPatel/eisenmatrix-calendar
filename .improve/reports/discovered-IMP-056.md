# Discovered while implementing IMP-056 (out of scope, not fixed)

## D1 — `ReminderEditor` misrenders an `absolute` (snooze) reminder as a relative offset

`src/features/item/ReminderEditor.tsx:58-74` renders every row through `OFFSET_PRESETS`:

```tsx
<Select value={String(reminder.offsetMinutes ?? -10)} … />
```

A snooze row has no `offsetMinutes`, so a pending snooze displays as "10 min before" while the label
next to it shows the real timestamp (`formatReminderLabel` → `toLocaleString()`), which is
self-contradictory. Two consequences:

- Editing that row calls `update(id, { offsetMinutes })`, so the row now claims a relative offset *and*
  an `absolute`; `reminderFireTime` returns `absolute` first, so the edit is inert but persisted.
- On an all-day item the branch at `:60-63` calls `update(id, { timeOfDay, offsetMinutes: undefined })`,
  which strips an offset from an absolute row without changing when it fires.

There is also no way to reschedule or remove an absolute reminder other than the trash button (which
works). Suggested fix: branch on `typeof reminder.absolute === 'number'` and render a read-only
timestamp (or a datetime input) instead of the offset `Select`. Not done here: IMP-056's criteria are
all about pruning, and IMP-056 explicitly lists this file as an area — but the fix belongs to a
separate, UI-visible item. The prune does mean stale snoozes no longer appear here after a load, which
is what the item's intent asked for.

## D2 — The snooze path persists display copy as data

`src/pwa/ReminderRuntime.tsx:89` writes `label: \`Snoozed ${minutes}m\``. `AGENTS.md` says display
copy lives in `src/lib/labels.ts` and must not be persisted. Worse, `formatReminderLabel`
(`src/domain/reminders.ts:97-99`) ignores `label` entirely for an absolute reminder and shows
`toLocaleString()`, so the persisted string is dead weight in the row — and it is the one thing that
*could* have been used to tell a snooze from a hand-written absolute reminder. IMP-056 deliberately
does **not** key the prune off that label (deriving behaviour from display text is worse than the
unbounded-growth bug), and relies instead on the fact that the snooze path is the only producer of
`absolute`. A real discriminator (e.g. a `source: 'snooze'` field on `Reminder`) would make the prune
provably incapable of touching a user-authored absolute reminder.

## D3 — A notification snooze pushes an undo entry that evicts a real edit

`ReminderRuntime.tsx:84-93` calls `patchItem` with `{ silent: true, trackHistory: false }` but leaves
`trackUndo` at its default, so every service-worker snooze pushes `Change "<title>"` onto the undo
stack. The stack is capped at 25 (`src/store/useUiStore.ts:130`, `slice(-24)`), so a run of snoozes
displaces the user's own recent edits from ⌘Z — a system action evicting user history. Adding
`trackUndo: false` would match the intent (a snooze is a notification action, not an edit). Not
changed here: out of scope, and the undo entry is arguably a defensible way to cancel a snooze.

## D4 — Two snoozes inside one window still fire twice in the same session

Pressing "Snooze 10m" and then "Snooze 1h" on a notification that has not gone away appends a second
absolute, and both fire (two toasts / two notifications). IMP-056's prune collapses a stack at the
**next** load, and the soonest-only rule in `pruneExpiredAbsolute` bounds the damage, but nothing
stops the in-session duplication. The clean fix is in the snooze branch itself — replace a pending
snooze instead of appending (`item.reminders.filter((r) => typeof r.absolute !== 'number')`) — which
also makes the same invariant hold without a load. Left alone to keep IMP-056 to the prune pass the
spec describes.

## D5 — The prune pass reads the whole item table once per load

`pruneItemReminders` calls `itemRepo.all()`. `reminders` is a nested array, not an indexed field, so
Dexie cannot query "items that have an absolute reminder" — a full read is the only option without a
schema/migration change, and it is the same read `useItems` already performs on mount. Measured cost
is one extra `toArray()` plus at most one bulk write per app load, and zero writes when nothing is
stale. Acceptable; noted in case the item count grows enough for it to matter.