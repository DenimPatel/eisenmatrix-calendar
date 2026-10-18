# Discovered during IMP-086 — not fixed

Pre-existing or out-of-scope observations found while implementing the undelivered-reminder
path. None were changed.

## D1 — A reminder the app was never open to attempt is still lost silently

`deliver` is the only writer of a failure row, so a reminder is only recorded once a tick
actually reaches it. If the app is closed (or the machine asleep) for longer than the 24h
`LOOKBACK_MS` window, its `fireAt` is already outside the window when the app next opens:
`upcomingReminders` never returns it, `deliver` is never called, and no failure row exists.
IMP-086's AC1 is scoped to a *failed delivery attempt*, so this is not a criterion miss — but
the silent-loss class it addresses still has this unhandled member. A fix would need a
separate "missed while closed" scan (expand the last window on boot and diff against the
fired log), which is a larger product decision.

## D2 — `useItems`' module-level cache leaks across component mounts in tests

`src/hooks/useData.ts` keeps `itemsSource` (and the liveQuery subscription) in module scope,
unsubscribing only when the last listener leaves. A runtime mounted in a test *after* another
runtime unmounted therefore ticks once against the previous test's items before the new
liveQuery emits. This made the first draft of the IMP-086 integration test record a failure
row for the prior test's item. Worked around by giving the failure-reporting tests their own
file (empty cache on first mount) and by not creating items in the file's earlier test. The
cache is fine in production (one app, one mount) but is a latent test-isolation hazard for
any future test that mounts `useItems` consumers in sequence.

## D3 — Failure rows are not reaped when their item is deleted or archived

`reminderFailureRepo` is cleared on successful delivery, on "Clear all data", and by the 30-day
retention prune, but not when the underlying item is removed or archived. A deleted item's
failure row lingers up to 30 days and keeps counting toward the "passed their time
undelivered" toast, so the reported number can include reminders that no longer exist.
`itemRepo.removeWithChildren` / `setArchived` would need to clear the matching rows.
