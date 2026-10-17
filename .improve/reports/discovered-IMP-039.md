# discovered-IMP-039

## 1. Dexie `blocked` upgrades can hang without a toast

`ensureDbOpen()` catches a rejected `db.open()`, but Dexie reports an upgrade blocked by another
tab through the `blocked` event while the open promise stays pending. On that path the app shows
fallback data and no storage warning until the blocking tab closes.

Suggested: in `src/db/schema.ts` or `ensureDbOpen`, subscribe `db.on('blocked')` and route it to
the same `STORAGE_UNAVAILABLE_MESSAGE` report. Keep it UI-free by returning an event/callback
from the DB layer rather than importing the toast helper into `src/db/`.

## 2. Other storage reads still lack catch handlers

`src/features/settings/SettingsView.tsx:66` fires `void backupRepo.all().then(...)` with no
catch; a blocked/failed IndexedDB read produces an unhandled rejection on the Settings route.
More generally, repository mutations triggered by UI actions (`itemActions`, backup import) are
not all caught at call sites. This is outside IMP-039's boot scope but the same class of
storage-failure robustness.

## 3. Persistent toasts can stack on a fully blocked store

When IndexedDB is unavailable, `ensureDbOpen`, the legacy migration, the notification gate and
`useTheme` can each report a distinct fixed message, so up to three persistent error toasts
appear. They dedupe only by exact message. If this proves noisy in manual testing, route all
storage failures through `STORAGE_UNAVAILABLE_MESSAGE` (or a shared failure key) so the user
sees one actionable banner.
