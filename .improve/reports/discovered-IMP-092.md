# discovered-IMP-092 — non-blocking observations

## D1 — The delivery `tick` can still reject on blocked storage

IMP-092 fixes the prune passes and the undelivered-count read, so a storage-blocked boot with the
default (empty) data set now logs zero unhandled rejections (verified in preview). One path is left:
the tick itself is `void tick().finally(…)` with no `catch`, and `deliver` awaits
`reminderLogRepo.wasFired` / `record`. With a reminder actually due **and** storage unavailable, the
first `wasFired` rejection escapes as an unhandled rejection.

Not fixed here: the item's scope is the prune path (and the async paths IMP-086 added), and a
storage-blocked preview has no due reminders, so the acceptance check passes. A broader
"the runtime never rejects" hardening would be a separate item; it is the same class as the
`itemRepo.get(...).then(...)` service-worker message path (`ReminderRuntime.tsx:160`), which also
has no rejection handler.

Evidence: mutating the fix back out and running the blocked-storage preview reproduced
`MissingAPIError`/`DatabaseClosedError`; the shipped code reproduces none. A due-reminder variant
was not exercised in the browser, only reasoned from `deliver`'s awaits.

## D2 — `reportUndelivered` silently drops a count failure

The new `catch` in `reportUndelivered` (and `ignorePruneFailure`) is deliberately silent, matching
the item's "degrade quietly" criterion and avoiding a duplicate toast over IMP-039's storage
message. The trade-off is that a non-storage failure of `reminderFailureRepo.count()` is now
invisible. `console.warn` would keep a local trace, but the repo's tests assert clean console
output and the boot already logs the storage error, so silence was chosen.
