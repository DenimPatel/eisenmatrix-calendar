# Impl — IMP-090: Deep-normalize nested kind payloads

## Files changed
- `src/domain/itemFactory.ts` — new `mergeDefaults(defaults, value)` helper that
  recursively fills nested plain-object defaults. `null` (or a non-object) in a
  slot that has an object default falls back to the default, arrays and scalars
  from the payload win, and keys not present in the defaults are copied through
  (so `why`, `unit`, `estimateMinutes`, … survive). Used by `createItem` and
  `normalizeItem` in place of the previous shallow `{ ...defaults, ...data }`
  spread. This completes `habit.data.target`/`habit.data.streak` and
  `goal.data.metric` after normalization.
- `src/domain/itemFactory.test.ts` — nested-partial cases: `{ target: { count: 2 } }`
  gains `per: 'day'` and the default `streak`; `{ metric: { type: 'numeric',
  current: 3 } }` keeps its fields on top of the default `metric`; `{ target: null }`
  and `{ metric: null }` fall back to `defaultDataFor(kind)`.
- `src/db/repository.test.ts` — new case seeding a partial-target habit, a
  null-target habit and a null-metric goal via `db.items.bulkPut`; asserts the
  repository read shape is complete and the stored rows are byte-identical to
  what was written (read-only).
- `src/features/noDataRows.test.tsx` — new `views with nested partial payloads`
  describe mounting `HabitsView` with a null and a partial target (asserts
  `1× per day` and `2× per day`) and `GoalsView` with a null metric.
- `src/domain/stats.test.ts` — `habitStreak` and `goalProgress` tolerate a null
  or partial nested object without throwing.

## Design
One seam, same as IMP-088: normalization at the repository read boundary (and
`createItem` so a freshly created partial payload is complete immediately).
`mergeDefaults` is pure and does not mutate its inputs. Well-formed payloads are
value-identical after the merge (key order may differ, which the IMP-088
differential serializes stably); the repository test re-reads the raw rows to
prove nothing is written back.

## Commands / results
```
npm run typecheck   PASS
npm run lint        PASS
npm run test        PASS  42 files / 471 tests
npm run format:check PASS
```

## Non-vacuous check
Reverting `mergeDefaults` to the shallow spread makes the new repository and
`noDataRows` assertions fail (partial target renders `2× per undefined`; read
shape lacks `per`/`streak`), so the tests exercise the fix rather than passing
vacuously.
