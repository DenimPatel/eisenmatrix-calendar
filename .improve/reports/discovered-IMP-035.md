# Discovered findings — IMP-035

- `src/db/migrations/notificationGate.ts:65-76` still performs a read-modify-write of
  the `app` row (`get('app')` then `set('app', { ...DEFAULT_SETTINGS, ...current, ... })`).
  It runs once at boot for legacy installs whose notifications gate was never seeded, so
  a concurrent theme change in the same window could still be dropped. It was outside
  IMP-035's named files; switching it to `settingsRepo.merge` would close the residual
  race, but its `SettingsStore` dependency type (`Pick<typeof settingsRepo, 'get' |
  'set'>`) and migration tests would need the added method.
- `settingsRepo.set` remains a whole-row writer. Current non-test/import callers are
  the notification gate and migration markers; any future settings writer should use
  `merge` for partial updates.
