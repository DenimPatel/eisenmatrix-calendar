# IMP-144 — Reject non-string occurrence override fields on import

**Status:** done
**Type:** bug-fix (correctness / import validation)
**Files changed:**
- `src/lib/itemValidation.ts`
- `src/lib/itemValidation.test.ts` (new)
- `src/lib/backup.test.ts`
- `src/lib/csv.test.ts`

## Root cause

`asOverrides` accepted any plain object and cast it to `OccurrenceOverride` without checking
fields. A backup/CSV row with `recurrence.overrides: {"2026-03-09": {"start": 5}}` passed
`validateItem` (`invalid === 0`); `expandOccurrences` then produced a numeric `start`, and the
`useOccurrences` sort (`(a.start ?? a.occKey).localeCompare(...)`) threw
`TypeError: aTime.localeCompare is not a function`, crashing every occurrence view.

## Fix

Added `asOccurrenceOverride` (`src/lib/itemValidation.ts`), which builds a fresh
`OccurrenceOverride` from the known fields only:

- `start` — string when present, else drop.
- `end` — `string | null` when present (the type permits explicit `null`), else drop.
- `allDay` — boolean, else drop.
- `title` / `notes` — string, else drop.
- `status` — one of `todo | doing | done | cancelled`, else drop.

Unknown fields are never copied (dropped). If any known field is present with the wrong type,
the whole override is dropped — no partial application. Non-object entries are dropped.

## Coherence choice (requirement 2)

The invalid override is **dropped**, not counted: the item still imports with `invalid`
unchanged and the rest of the item (and any sibling valid overrides) intact. Rationale: an
override is a single optional sub-record; a bad one should not discard an otherwise-valid item,
and the acceptance criteria allow either outcome. The choice is asserted in the tests
(`expect(parsed.invalid).toBe(0)` plus `overrides` emptied).

Note on `end`: the spec's prose says start/end "must be strings", but the canonical
`OccurrenceOverride` type is `end?: string | null` and `occurrenceEnd` treats `null` as an
explicit "no end". Per the primary instruction ("validate against the OccurrenceOverride
type") and requirement 4 ("do not change valid overrides"), `end: null` is kept; only a
non-string, non-null `end` drops the override.

## Verification

- `src/lib/itemValidation.test.ts` (new): direct unit coverage of every field type, the
  `end: null` control, unknown-field dropping, and non-object entries.
- `src/lib/backup.test.ts`: malformed-override describe block — `{start: 5}`, invalid `status`,
  numeric `title`, valid control (kept, unknown field dropped), mixed map (only the bad entry
  dropped), and a regression replicating the exact `useOccurrences` `localeCompare` sort
  asserting it does not throw and every `start` is a string.
- `src/lib/csv.test.ts`: same malformed override through the CSV path; `invalid === 0`, no
  numeric starts.
- **Mutation check:** bypassing `asOccurrenceOverride` (`return value as OccurrenceOverride`)
  makes 13 tests fail across the three files; restoring the fix passes.
- Existing identity/no-items/CSV guards and IMP-038/111 item-level validation untouched.

## Gates (all pass)

```
npm run typecheck   PASS
npm run lint        PASS
npm run test        PASS — 77 files / 790 tests
npm run format:check PASS
npm run build       PASS — dist/sw.js generated, 28 precache entries
```

No commit made. Backlog/state files not edited.
