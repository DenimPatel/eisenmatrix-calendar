# Discovered problems — IMP-036

Unrelated/adjacent issues noticed while implementing IMP-036. Not fixed here.

- **Cross-tab reminder dedupe is still check-then-record.** The `ticking` guard is
  per-`ReminderRuntime` instance, so two open tabs (or a tab plus an installed PWA
  window) can both pass `deliver`'s `wasFired` check before either `record`s and both
  notify. The unique index makes only one insert win, but both deliveries have already
  happened. Cross-tab coordination (e.g. `BroadcastChannel`, Web Locks) is out of scope
  for IMP-036.
- **`deliver` ignores `record`'s new boolean.** After a successful show/toast it calls
  `reminderLogRepo.record` without checking the result, so a lost race is not observable
  to the caller; the duplicate delivery has already occurred. Left as-is to preserve the
  "record only after delivery" retry semantics.
- **Skip-only tick guard can defer a tick.** If the effect rebuilds while a tick is
  in-flight, the immediate `tick()` is skipped (returns early) and the new item set is not
  scanned until the next 60s interval or a `visibilitychange`. Ticks are normally fast, so
  this is latent rather than observed; a pending-rerun guard would remove the delay.
