# Verify IMP-035 — Atomic settings merge for theme and Settings

**Verdict: PASS**
**Branch:** `improve/auto-20261017` (HEAD `b9934d5` + working tree)
**Reviewer:** independent verification; no implementation files modified, nothing committed.

## Diff reviewed

- `src/db/repository.ts`: new `settingsRepo.merge(key, patch, fallback)` opens a `rw`
  Dexie transaction on `settings`, reads the row inside it, and puts
  `{...base, ...patch}`. Missing rows seed from `fallback`. `get`/`set`/`remove`/`all`
  unchanged.
- `src/hooks/useTheme.ts`: persistence effect now calls `merge('app', { theme },
  DEFAULT_SETTINGS)` with the existing `reportBootFailure` catch; the initial load still
  uses `get('app', DEFAULT_SETTINGS)`.
- `src/features/settings/SettingsView.tsx`: `persist(patch)` now calls
  `merge('app', patch, DEFAULT_SETTINGS)`; the `settings` snapshot is still used for
  control values.
- `src/db/repository.test.ts`: three new tests (seeded interleaved merge, existing-row
  merge, missing-row fallback seed).
- `.improve/` edits are orchestration bookkeeping (CHANGELOG/PROGRESS/STATE and the
  IMP-080 entries carried uncommitted). No source comments, dependencies, or style churn.

## Acceptance criteria

| AC | Result | Evidence |
| --- | --- | --- |
| 1. Merge only changed keys, atomically | PASS | `repository.ts:177-188` does read+merge+`put` inside `db.transaction('rw', db.settings, …)`, so concurrent IndexedDB writers serialize. No stale-snapshot `set('app', …)` remains in either named writer. |
| 2. Concurrent theme + digest preserve both | PASS | Interleaved test asserts `theme: 'dark'`, `digestEnabled: true`, and pre-existing `weekStartsOn: 0`. Probe below proves it detects the old read-then-write semantics. |
| 3. `useSetting('app')` still full `AppSettings` | PASS | `useSetting` still reads `settingsRepo.get`; `merge` seeds a missing row from `DEFAULT_SETTINGS`, so the stored row is complete. |

Missing-row seeding matches the pre-change behavior (both writers previously persisted
`{...DEFAULT_SETTINGS, ...patch}` via the `useSetting` fallback). Error paths reject the
transaction promise as before; `useTheme` catches, `SettingsView` call sites use
`void persist(...)` exactly as before (pre-existing unhandled-rejection shape, not a
regression). Other callers (`get`, `set`, `remove`, tests, `notificationGate`) are
untouched and still work; the boot-time notification-gate seeding remains a one-shot
whole-object write outside this item's two named writers.

## Test validity

The interleaved test is non-vacuous. In a temp copy of the working tree, replacing
`merge`'s transactional body with the old read-then-put semantics makes the new test fail:
`expected theme: 'system' … to deeply equal theme: 'dark'` (12/13 pass). The two writes
are started together by `Promise.all`; the non-transactional probe loses `theme`, so the
pass is not an artifact of sequential awaits. A standalone fake-indexeddb simulation
reproduced the same split (non-transactional drops `theme`; transactional keeps both).

## Gates

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test` — 42 files / **450 tests** pass (baseline 447; +3, as expected).
- `npm run build` — pass; `dist/sw.js`, 18 precache entries.
- `npm run format:check` — pass.

## Suggested health delta

**Bugs/Correctness +1**: the single `app` settings row can no longer be clobbered by a
concurrent theme/digest write; the merge is atomic across tabs within one IndexedDB
transaction.
