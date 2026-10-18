# verify-IMP-111 — Validate recurrence rules at the import/normalize seam

**Verdict: PASS** (acceptance criteria met; one non-blocking byte-identity deviation noted)

Reviewer: independent, did not write the change. Source not modified (probe modules deleted after use).

## Scope reviewed

`git diff HEAD` for the six changed files against the IMP-111 acceptance criteria in
`.improve/FEATURES.md`. Only `src/lib/itemValidation.ts`, `src/domain/itemFactory.ts`,
`src/domain/recurrence.ts` and their tests changed.

- `coerceRecurrence` (`itemValidation.ts:68-105`) returns `{ok:true, rule}` or `{ok:false, reason}`;
  non-object/absent → `{ok:true, rule:null}`; unknown/missing `freq` → `{ok:false}`.
- `coerceItemShape` now carries `recurrence`; `validateItem` rejects an unknown `freq` before
  coercing (`itemValidation.ts:135-140`). Both seams (`csv.ts:186`, `backup.ts:71`) already route
  rows through `validateItem`, and both spread `validated.shape` **after** the raw row, so the
  coerced rule wins.
- `normalizeRecurrence` delegates to `coerceRecurrence` (`itemFactory.ts:114-117`); the repository
  `readItem`/`normalizeItem` path and the CSV/backup path coerce identically.
- Engine defence in depth: `weekStartsOn ?? 1` (weekly), `if (rule.freq !== 'yearly') return`
  (yearly guard), and `?? []` / `?.` on `exceptions`/`overrides`.

## Criteria checks

1. **Complete rule or rejected row.** `coerceRecurrence` always emits `freq` ∈ the four values,
   `interval ≥ 1` (floored), `weekStartsOn ∈ {0,1}`, `exceptions: []`, `overrides: {}`, and copies
   `byWeekday`/`byMonthDay`/`byMonth`/`count`/`until` only when valid. `validateItem` returns
   `{ok:false}` for an unknown `freq`, and both importers count the row as `invalid` (probe: csv and
   backup each reported `invalid: 1` and dropped the item). ✅
2. **No throw without `exceptions`/`overrides`.** Probe expanded `daily`/`weekly`/`monthly`/`yearly`
   rules that omit both fields over 2024-01-01→2025-12-31: no throw. All four access sites in
   `recurrence.ts` (`:197,209,215,269`) are guarded. ✅
3. **Weekly default Monday.** `{freq:'weekly',byWeekday:[1,3]}` without `weekStartsOn` expanded to
   `['2024-01-01','2024-01-03']` in <200 ms (HEAD returned `[]` after burning the 200k guard). ✅
4. **Unknown `freq` never yearly.** `{freq:'hourly'}` expands to `[]` over 2024–2026 (yearly guard
   returns before the loop) and is rejected at the seam. ✅

## Well-formed / byte-identity check

Compared `normalizeItem(rule).recurrence` against HEAD's passthrough semantics for nine well-formed
rules (all four freqs, `interval` 1/2/3, both `weekStartsOn` values, `byWeekday`/`byMonthDay`/`byMonth`,
`count: 0`, `until` string/null, populated `exceptions`/`overrides`):

- **Deep equality: identical for every rule** — no meaningful field is added, dropped or retyped.
- **Expansion: identical** occurrence-key lists over 2024-01-01→2025-06-30 for every rule.
- **App-generated rules round-trip byte-identically** (`{"freq":"daily","interval":1,"weekStartsOn":1,"exceptions":[],"overrides":{}}`
  in = out); `quickadd.ts:86` and the editor already produce that key order.

**Deviation (non-blocking):** `JSON.stringify` of the normalized rule is not byte-identical to the
input when the input carries optional grid fields (`byWeekday`/`byMonthDay`/`byMonth`/`count`/`until`)
or an empty grid array, because the constructed rule appends those keys after `overrides` and omits
zero-length arrays (`byWeekday: []` → key absent). This is key-order/empty-array canonicalisation
only: `toEqual` holds, no consumer compares serialized rules, and expansion is unchanged (an empty
array is read as absent by `candidateDates`). Strict literal-byte reading of criterion 1 fails; the
substantive intent (no data loss, unchanged expansion) holds.

## Hostile inputs (throwaway probes, deleted)

| Input | Result |
| --- | --- |
| `interval: NaN` / `0` / `-5` | coerced to `1`; no guard burn |
| `interval: 1.9` | floored to `1` |
| `interval: "3"` / `"abc"` | `3` / `1` |
| `count: 1e21` | kept (finite); `count: Infinity` → omitted (unbounded) |
| `count: -1` | **dropped → unbounded** (HEAD kept `-1` → zero occurrences); `count: 2.5` → `2` |
| `byWeekday: 'x'` (non-array) | omitted; weekly infers the series-start weekday |
| `byWeekday: [1,'x',NaN,Infinity,3]` | `[1,3]` |
| `until: 'garbage-date'` | kept as string; `parseLocalDate` → null, so unbounded (same as HEAD) |
| `overrides.__proto__` | entry silently dropped, **no global `Object.prototype` pollution** |
| `null` / `undefined` / `'daily'` / `[]` | `{ok:true, rule:null}` |

`count: -1 → unbounded` is the only hostile input whose semantics changed in a way that could matter
(HEAD produced an empty series). Not covered by the criteria; recommend treating a negative `count`
as `0` (or rejecting it) for consistency with `count: 0`.

## Gates (probes removed)

```
npm run typecheck    PASS
npm run lint         PASS
npm run test         PASS (46 files, 518 tests)
npm run format:check PASS
npm run build        PASS (tsc --noEmit && vite build; PWA sw.js generated)
```

## Summary

All four acceptance criteria are met and verified independently: coercion is complete, malformed
rows are rejected, the engine no longer throws or burns its guard on missing fields, weekly defaults
to Monday, and an unknown `freq` never expands as yearly. Expansion results for well-formed rules are
unchanged and no meaningful field is lost. The only deviations — key-order/empty-array
canonicalisation and `count: -1` becoming unbounded — are non-blocking and outside the stated intent.
