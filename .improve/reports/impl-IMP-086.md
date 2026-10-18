# IMP-086 — Implementation report

**Status:** implemented; all four gates (`typecheck`, `lint`, `test`, `format:check`) pass,
plus `npm run build`; not marked DONE in FEATURES.md; not committed.

## What was wrong

A reminder that could not be delivered (device notification off/denied **and** the tab
hidden) was retried once per 60s tick and, once its `fireAt` left the 24h `LOOKBACK_MS`
window, silently dropped: never delivered, never recorded, nothing shown. `deliver`'s
`boolean` was ignored at both call sites, and an undeliverable digest re-ran two full
`expandOccurrences` sweeps every tick.

## Change

| File | Change |
| --- | --- |
| `src/db/schema.ts` | New `ReminderFailureEntry` (itemId, dedupeKey, occKey, title, attemptedAt) and a `reminderFailures` table in `version(4)` with a unique `&[itemId+dedupeKey]` index. |
| `src/db/repository.ts` | New `reminderFailureRepo`: `record` (upsert by key), `clear`, `count`, `all`, `clearAll`, `pruneBefore`. |
| `src/pwa/delivery.ts` | `deliver` writes a failure row on the undeliverable path and clears it on any successful delivery; new `recordFailure` option (off for the digest). New exported `undeliveredCount()`. `deliverDigest` caches its last undelivered build (keyed by `items` identity + day) so an undeliverable tick skips both sweeps. |
| `src/pwa/ReminderRuntime.tsx` | Notification/toast title now uses the resolved occurrence title (`scheduled.occurrence.title`); the tick consumes `deliver`'s return value; a visible tick surfaces the pending undelivered count once (never per tick); failure rows older than 30 days are pruned on boot. |
| `src/features/settings/SettingsView.tsx` | "Clear all data" also clears `reminderFailures`. |

### Acceptance criteria

1. **Distinct failure row.** `deliver` records `{itemId, dedupeKey, occKey, title, attemptedAt}`
   in `reminderFailures` — never the `reminderLog` fired key — so an aged-out reminder stays
   discoverable. Repeated attempts upsert (refresh `attemptedAt`).
2. **Surfaced without a new route.** A one-time error toast: `"N reminder(s) passed their
   time undelivered"`, shown only while the document is visible and only when the pending
   count differs from the last reported count (so it is never per-tick, and resets to zero
   when the pending set empties). Delivered reminders clear their failure row, so a reminder
   that arrives is never reported as lost.
3. **Digest does not re-sweep.** The last undelivered digest build is cached by the `items`
   reference and day; a tick that still cannot deliver reuses it and calls
   `expandOccurrences` zero times. The runtime consumes `deliver`'s return value (`if
   (!delivered) undelivered = true`) to drive the report.
4. **Dedupe invariants.** 500 undeliverable ticks → one failure row (upsert); eventual
   delivery → exactly one toast and one `reminderLog` row, failure row cleared.

### Design notes

- The report runs fire-and-forget off the tick's critical path. Awaiting it lengthened the
  tick past an effect rebuild (live-query emission), and the `ticking` guard then dropped
  that rebuild's tick — which broke `ReminderRuntime.test.tsx`'s live `notificationsEnabled`
  follow. A `reporting` ref serialises the check so two ticks cannot double-toast.
- The failure row is only written by `deliver`, i.e. only for reminders that were actually
  attempted while the app was open (see discovered D3).

## Tests

- `src/pwa/delivery.test.ts`: failure row + `undeliveredCount` on the hidden path; 500
  undeliverable ticks → one row, then one toast/one log row on delivery; digest reuses its
  build with an `expandOccurrences` spy (0 sweeps on the second undeliverable tick) and never
  writes a failure row.
- `src/db/repository.test.ts`: `reminderFailureRepo` upsert, separation from the fired log,
  clear-on-delivery, prune.
- `src/pwa/ReminderRuntime.failures.test.tsx` (new): hidden tab records a failure with the
  resolved occurrence title and reports nothing; visible tick delivers exactly once with that
  title and clears the failure; an aged-out failure is reported once across repeated ticks.
- `src/pwa/ReminderRuntime.delivery.test.tsx`: clears `reminderFailures` between tests.

## Verification

`npm run typecheck && npm run lint && npm run test && npm run format:check` → all pass
(44 files / 497 tests). `npm run build` generates `dist/sw.js` (precache 18 entries).

The spec's Playwright step (deny permission, background the tab, assert no duplicate
delivery) is covered behaviourally by `ReminderRuntime.failures.test.tsx`, which mounts the
real runtime with a hidden document and a failing notification path and asserts one delivery
and one log row. No browser session was run for this item.
