# Discovered — IMP-088

Unrelated findings noticed while implementing IMP-088:

- **Nested partial payloads still crash kind-specific reads.** `normalizeItem`
  shallow-merges `data`, so a stored payload like `{ target: { count: 2 } }`
  loses `per` and `{ target: null }` / `{ metric: null }` still throws in
  `KindFields`, `HabitsView` and `stats.ts`. IMP-071's verifier already noted
  this; IMP-088 only guarantees a missing/`null` whole `data` object is safe.
  A deep merge or nested guards would be a small follow-up.
- **Dexie live queries do not observe raw IndexedDB writes from another
  connection.** For browser verification, rows seeded with
  `indexedDB.open(...).transaction(...).put(...)` did not appear until a full
  document reload; hash-only navigation kept the old live-query snapshot. This
  is verification tooling behavior, not an app defect (all app writes go through
  Dexie).
- **IndexedDB reports Dexie version 1 as IDB version 10.** Dexie opens with
  `10 * declaredVersion`; a DB at version 10 is healthy, not stale. This cost
  time during browser verification and is worth knowing for future verifiers.
- **`useItem` has no production consumer.** It is exported from
  `src/hooks/useData.ts` and only appears in that file; either wire it up or
  treat it as dead code in a future cleanup.
