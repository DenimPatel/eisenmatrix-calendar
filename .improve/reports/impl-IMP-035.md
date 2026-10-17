# IMP-035 — Implementation report

**Status:** implemented

## Change

`src/db/repository.ts` — added `settingsRepo.merge(key, patch, fallback)`:

- opens a `rw` Dexie transaction on `settings`, reads the row inside it, and `put`s
  `{ ...stored, ...patch }`, so the read-modify-write is serialized and concurrent
  writers cannot persist a stale whole-object snapshot;
- when the row is absent it seeds from the optional fallback (callers pass
  `DEFAULT_SETTINGS`), preserving the previous first-write behavior where
  `useTheme`/Settings persisted a complete `AppSettings` row;
- `settingsRepo.get`, `set`, `remove` and `all` are unchanged, so existing readers and
  the stored row shape are untouched.

`src/hooks/useTheme.ts` — the persistence effect now calls
`settingsRepo.merge('app', { theme }, DEFAULT_SETTINGS)` directly instead of reading
`get('app')` and writing `{ ...settings, theme }`.

`src/features/settings/SettingsView.tsx` — `persist(patch)` now calls
`settingsRepo.merge('app', patch, DEFAULT_SETTINGS)` instead of writing
`{ ...settings, ...patch }` from the render-time snapshot.

`src/db/repository.test.ts` — new `settingsRepo` suite with three fake-indexeddb tests:
interleaved concurrent merges for `theme` + `digestEnabled` (seeded row), a merge over
an existing snapshot with an untouched `digestTime`, and a missing-row merge asserting
the fallback yields a full `AppSettings` object for `useSetting('app')`.

## Acceptance criteria

1. Both writers merge only changed keys via an atomic repository helper; no caller
   writes a stale snapshot any more.
2. The interleaved `Promise.all` test preserves both `theme: 'dark'` and
   `digestEnabled: true` (plus the pre-existing `weekStartsOn: 0`).
3. `settingsRepo.get('app', DEFAULT_SETTINGS)` / `useSetting('app')` still return a
   merged `AppSettings` object, including after a first write to a missing row.

## Verification

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — 42 files / 450 tests pass (baseline 447; +3 new tests)
- `npm run build` — pass (`dist/sw.js`, 18 precache entries)
- `npm run format:check` — pass

No new dependencies, no comments, no `.improve/` state edits.
