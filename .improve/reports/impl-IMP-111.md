# impl-IMP-111 — Validate recurrence rules at the import/normalize seam

- **Status:** done
- **Category:** correctness / import
- **Type:** bug-fix
- **Source:** `.improve/reports/discover3-quality.md` (#2, S2)

## Problem

`normalizeRecurrence` was a bare passthrough and `coerceItemShape` ignored `recurrence`, so an
imported rule reached the engine verbatim. A rule without `exceptions` threw
(`rule.exceptions.includes`), a weekly rule without `weekStartsOn` produced `NaN` offsets and
burned the 200k iteration guard to return `[]`, and an unknown `freq` fell through to the
yearly branch.

## Change

`src/lib/itemValidation.ts`

- Added `coerceRecurrence(value)` returning `{ ok: true; rule } | { ok: false; reason }`. It
  turns an absent/non-object into `null`; an object with an unknown/missing `freq` is flagged;
  otherwise it produces a complete `RecurrenceRule` (`freq` ∈ the four values, numeric
  `interval ≥ 1`, `weekStartsOn ∈ {0,1}` defaulting to `1`, `exceptions: []`, `overrides: {}`,
  plus filtered `byWeekday`/`byMonthDay`/`byMonth`/`count`/`until`).
- `ItemShape` now carries `recurrence`; `coerceItemShape` coerces it (leniently to `null`).
- `validateItem` rejects a row whose `recurrence.freq` is unknown, so `csvToItems`/`parseBackup`
  count it as `invalid` like any other malformed row.

`src/domain/itemFactory.ts` — `normalizeRecurrence` delegates to `coerceRecurrence`, so
`normalizeItem` and the repository path coerce the same way.

`src/domain/recurrence.ts` — defence in depth for rules that bypass the seam:

- weekly branch reads `weekStartsOn ?? 1`, so a missing value expands from Monday instead of
  `NaN`/guard burn;
- the yearly branch is guarded by `if (rule.freq !== 'yearly') return`, so an unknown `freq`
  never silently expands as yearly;
- `exceptions`/`overrides` reads use `?? []`/`?.` so a rule lacking them cannot throw.

## Acceptance criteria

1. A rule crossing the seam is coerced to a complete `RecurrenceRule`; an unknown `freq`
   rejects the row — covered by the csv/backup tests below.
2. `expandOccurrences` does not throw for a rule lacking `exceptions`/`overrides` — engine test.
3. A weekly rule without `weekStartsOn` expands from Monday (not `[]`) — engine + csv tests.
4. An unknown `freq` expands to `[]`, never yearly — engine + rejected-row tests.

## Tests

- `src/lib/csv.test.ts` — coerces `{"freq":"weekly"}` to the full shape and expands it without
  burning the guard; rejects `{"freq":"hourly"}` as `invalid`.
- `src/lib/backup.test.ts` — same coercion via `parseBackup`; counts an unknown-frequency item
  as invalid.
- `src/domain/recurrence.test.ts` — weekly default Monday; no throw without
  `exceptions`/`overrides`; unknown `freq` → `[]`.

## Gates

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — 46 files, 518 tests pass
- `npm run format:check` — pass

## Files changed

- `src/lib/itemValidation.ts`
- `src/domain/itemFactory.ts`
- `src/domain/recurrence.ts`
- `src/lib/csv.test.ts`
- `src/lib/backup.test.ts`
- `src/domain/recurrence.test.ts`
