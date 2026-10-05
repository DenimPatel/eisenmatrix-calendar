# Discovered findings — IMP-021

Observations made while implementing IMP-021. **None were changed**; none are regressions from that
item. Ranked by how likely they are to matter next.

## 1. `Notification.requestPermission()` never settles in headless Chromium, so the toggle gives no feedback

Reproduction: Playwright against `npm run preview` with default permissions, on `#/settings`.
`Notification.permission` is `'default'`; clicking the **Device notifications** switch (or the
pre-existing **Enable** button) awaits `Notification.requestPermission()` indefinitely — after
1.5 s the switch is still unchecked, no toast appeared, and the settings row still held
`notificationsEnabled: false`.

The `Enable` button already had this behavior before IMP-021; the new toggle inherits it. In a real
browser the prompt does resolve, so this is mostly a verifier/automation trap: **a Playwright run
cannot confirm the granted path** unless notification permission is granted on the context first.
This is why the granted/refused branches are covered by unit tests with a stubbed `Notification`
class instead of by the browser check.

Also worth noting: because the handler awaits the prompt before persisting, a user who clicks the
toggle and *then* clicks it again (or turns it off) while the prompt is open can have the first
click's later `persist({ notificationsEnabled: … })` overwrite the second decision — `persist`
merges into the `settings` object captured at render (`SettingsView.tsx:70-72`). Pre-existing shape
of `persist`; slightly more reachable now that the setting has a real effect.

## 2. Raw IndexedDB writes still do not reach `useLiveQuery`

Also recorded at the end of IMP-019 and re-confirmed here. Writing the `app` settings row through a
second raw IndexedDB connection while the app is live leaves every rendered value unchanged: the
**Device notifications** switch stayed `aria-checked="false"` after `notificationsEnabled: true` was
written directly into the store. Dexie's live query only observes mutations made through its own
connection.

Practical consequence for future verification: to change a setting in a live browser you must go
through the UI or call `settingsRepo.set` (which is exactly what the new
`src/pwa/ReminderRuntime.test.tsx` does), not poke IndexedDB from the console.

## 3. Stale service worker masks a fresh `dist/` in preview

First Playwright load on :4173 after `npm run build` served the **previous** bundle (old Settings
copy, no switch) out of the `workbox-precache-v2-…` cache, while the app showed a *"A new version is
available"* prompt. Clicking **Reload** in that prompt (or unregistering the SW and clearing caches)
gives the current build. Verifiers who skip this will report the change as missing.

## 4. A gated reminder is retried every 60s until it ages out of the 24h window

With `notificationsEnabled: false` **and** the document hidden, `deliver` returns `false` without
recording (IMP-019's rule), so each tick repeats one `reminderLogRepo.wasFired` read until
`upcomingReminders` stops returning the reminder (≤24h). This is intentional — it is what lets a
reminder still fire if the user enables notifications later — and costs one IndexedDB read per tick
per due reminder, the same cost as the pre-existing denied-permission case. Noted only so the
`wasFired` polling is not mistaken for a leak. The digest is bounded by the existing
`nowMs - digestAt.getTime() < LOOKBACK_MS` guard.

## 5. Turning device notifications off does not revoke browser permission

Flipping the switch off only sets `notificationsEnabled: false`; `Notification.permission` stays
`granted` and the OS/browser setting is untouched. That is the right scope for this toggle (the
user asked for *the app* to stop notifying), but it means the Settings copy's
`Permission: <state>` line can read `granted` while delivery is off. The new copy sentence
("this switch controls device notifications only") is what disambiguates it; no further change was
made.