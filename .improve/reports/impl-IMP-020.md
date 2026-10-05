# IMP-020 — Implementation report

**Status:** implemented (all four gates pass; not marked DONE in FEATURES.md)

## Change

| File | Change |
| --- | --- |
| `src/lib/backup.ts` | `parseBackup` (`:35-66`) now validates identity and version before parsing. The raw `JSON.parse` result is typed with `unknown` fields instead of `Partial<BackupPayload>`, so `app`/`version` are checked as untrusted input. Rejects a present-and-different `app`, rejects `version > BACKUP_VERSION`, and the dead `if (!Array.isArray(items))` branch is removed. |
| `src/lib/backup.test.ts` | New `describe('payload identity and version')` block with 5 tests (2 rejection + 3 acceptance/back-compat). `BACKUP_VERSION` added to the existing import. |

No other source file was touched. `SettingsView.tsx` needed no change — see below.

## Acceptance criteria

1. **`app` present but not `'eisenmatrix'` throws a clear error** —
   `src/lib/backup.ts:46-48`: `Not an EisenMatrix backup (found app "some-other-app")`.
   The offending value is echoed so the user can tell *which* file they picked.
2. **Too-new `version` is rejected rather than silently accepted** — chosen option is
   *reject* (the AC permits reject-or-warn; reject is the safe reading for a
   possibly-differently-shaped payload). `src/lib/backup.ts:49-54`:
   `Backup is format v3, but this app only imports up to v2`.
3. **Dead `!Array.isArray(items)` branch removed** — was `src/lib/backup.ts:43`, verified
   unreachable (`items` is `[]` or an array from the `:37-41` ternary). Removing it is
   behaviour-neutral, which the full suite confirms. `grep` shows no other reference to
   the `'Backup does not contain an items array'` string in `src/` or `.improve/`.
4. **Round-trip still passes** — `round-trips a full backup` and all 4 IMP-051
   `parentId`-remapping tests are untouched and green.

## Backward compatibility (explicitly enforced)

Only *clearly-wrong identity* and *too-new version* are rejected. Everything else imports
exactly as before:

| Payload | Result |
| --- | --- |
| no `app` field (pre-marker backups) | accepted, `version` defaults to `1` |
| `app: 'eisenmatrix'`, `version: 1` | accepted (older format) |
| legacy `tasks` array | accepted (existing test) |
| `version` absent, or non-numeric | treated as `1`, accepted |
| `version === BACKUP_VERSION` | accepted |

The `app !== undefined` (rather than `app != null` / truthy) test is deliberate: a JSON key
that is present but `null` still proves a foreign producer wrote the file, while a key that
was never emitted is indistinguishable from an older legitimate backup.

## Error surfaces through the existing IMP-015 toast path — confirmed

`importJSON` (`src/features/settings/SettingsView.tsx:103-123`) already wraps
`parseBackup` in `try`/`catch` and pushes
`pushToast({ message: \`Import failed: ${describeError(error)}\`, tone: 'error' })` at
`:120-122`. `parseBackup` is called at `:107`, inside the `try`, and the success toast at
`:119` is the last statement inside the `try` — so a throw skips the write, skips the
success toast and skips `setImportReport`. **No change was needed in `SettingsView.tsx`**;
both new errors reuse that path verbatim.

## Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run test` **27 files / 236 tests
passed** · `npm run build` OK (`dist/sw.js` emitted, 18 precache entries, 607.78 KiB).

## Browser verification (Playwright, `npm run preview` on :4173)

Loaded `index.html?cb=imp020#/settings` (cache-busted, as in IMP-015) against the freshly
built bundle. Two real `.json` files were fed through the actual `<input type="file">`
picker, so `readTextFile` and the whole handler ran unmodified.

- **Foreign identity** — `{app:"some-other-app",version:2,items:[{id:"x1",…}]}` → error
  toast **`Import failed: Not an EisenMatrix backup (found app "some-other-app")`**.
- **Too-new version** — `{app:"eisenmatrix",version:3,items:[{id:"x2",…}]}` → error toast
  **`Import failed: Backup is format v3, but this app only imports up to v2`**.
- **No partial write** — read the `eisenmatrix` IndexedDB `items` store directly after both
  attempts: 13 rows, unchanged, `id` `x1` and `x2` **absent**. No *Import complete* dialog,
  header count stayed `13 items`.
- **Console clean** — zero console errors/warnings across both attempts.

The 13 pre-existing rows in that browser profile are leftovers from earlier verification
sessions (`CSV import regression probe`, `IMP-057 probe row`, `Legacy migrated task A/B`,
…) that predate this item; they were left untouched, since this profile is shared.

## Out of scope

Three findings written to `.improve/reports/discovered-IMP-020.md`: a payload with neither
`items` nor `tasks` still imports as 0 items silently; `lists` entries are not validated at
all; and `src/lib/backup.test.ts` was already Prettier-dirty at HEAD (pre-existing, from
IMP-051 — the unrelated reformat was reverted to keep this diff scoped).
