# Discovered during IMP-019 — not fixed

Pre-existing or out-of-scope observations found while extracting `deliver`. None were changed.

## 1. An undelivered reminder is eventually dropped silently (candidate backlog item)

With the bug fixed, a reminder that cannot be delivered (notification permission `denied` **and**
the tab hidden, e.g. a PWA left open in the background) is retried once per 60s tick until its
`fireAt` falls out of the 24h `LOOKBACK_MS` window, and is then simply no longer considered by
`upcomingReminders`. It is never delivered and never recorded, and nothing tells the user.

- Retry is bounded and cheap, so it is not a storm — but the *outcome* is a silent loss.
- Possible follow-ups: surface an "undelivered reminders" affordance, record an
  `attemptedAt`/failure row so the deadline is observable, or widen the lookback only for
  reminders that have been attempted.
- Location: `src/pwa/delivery.ts:38` (`deliver`), `src/pwa/ReminderRuntime.tsx` tick window.

## 2. The digest re-builds its summary on every tick while undeliverable

`deliverDigest` dedupes *before* expanding occurrences, but when the digest cannot be delivered it
is not recorded, so the next tick repeats the check and, if still in the digest window, both
`expandOccurrences` sweeps again (today + the previous 30 days, all items) — up to ~1440 times per
day. The pre-check prevents this only once the digest has been recorded. Cheap for realistic item
counts (no writes, no toasts while hidden), but it is real repeated work; a "last attempted digest
build" cache or an early visibility/permission short-circuit before the sweeps would remove it.

## 3. `deliver`'s return value is ignored by the runtime

`deliver` now returns a meaningful `true = delivered and recorded` / `false = skipped or
undelivered`, and `ReminderRuntime` awaits it in a `for` loop without looking. A future item could
use it to surface delivery failures (see §1) or to count "still pending" reminders per tick; today
it is dead information at the only call site.

## 4. Verification gotcha: raw IndexedDB writes are invisible to `useLiveQuery`

While verifying, an item seeded through a raw `indexeddb` transaction never reached
`ReminderRuntime` (`reminderLog` stayed empty) even though the row was readable. Two causes, both
worth knowing for the next browser check:

- Dexie's mutation signal only fires for writes made through its own instance, so `useLiveQuery`
  does not re-emit after a raw write;
- `page.goto` to a URL that differs only by hash (`…/#/today`) is a same-document navigation, so
  the app does **not** reboot and never re-reads IndexedDB. Use a cache-busting query
  (`…/?r=1#/today`) to force a real reload.

The reminder path was verified instead through the real UI (item editor → reminder → save), which
delivered and recorded correctly.