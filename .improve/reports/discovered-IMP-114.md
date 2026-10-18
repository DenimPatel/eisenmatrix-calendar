# discovered-IMP-114 — unrelated findings

## D1 — Module-level item source leaks between tests (`src/hooks/useData.ts`)

`itemsSource` is module-level and is never reset when the last listener unsubscribes
(`src/hooks/useData.ts:9`, `:34-49`). A test that leaves a reminder-bearing item in the live
query leaks that item into the next test: the next mount's first `getSnapshot` returns the
stale `itemsSource` until the fresh `liveQuery` emits, and `ReminderRuntime`'s tick can deliver
against it. This is test-isolation fragility, not a production bug (production has a single
long-lived subscription).

Worked around in `ReminderRuntime.blockedStorage.test.tsx` by draining `db.items` and flushing
the live query in `afterEach` before unmounting. A shared reset hook (or clearing `itemsSource`
on last unsubscribe) would remove the footgun for future tests.

Not in scope for IMP-114/115/117; recorded only.
