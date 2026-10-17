# Discovered during IMP-054

Unrelated to the IMP-054 acceptance criteria (data payload only); not fixed here.

## D1 — Kind switching does not reconcile the default recurrence

`QuickAdd` builds `item.recurrence` from the parsed kind in `quickAddToItem` (habits default to
daily), and the kind-override branch only replaces `item.kind`/`item.data`. Consequences:

- Parsing `habit: meditate` and switching the kind to task leaves a task with a **daily
  recurrence** (the habit default).
- Switching a task to `habit` leaves `recurrence === null`, so the new habit has no series and
  no computable streak.

Suggested follow-up: derive the default recurrence from `effectiveKind` at commit time (keep an
explicitly parsed recurrence, since it is kind-independent) and only default habit → daily.
