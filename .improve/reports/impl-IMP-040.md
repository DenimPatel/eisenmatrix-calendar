# IMP-040 & IMP-041 — Implementation report

**Status:** implemented (all gates pass; FEATURES.md left untouched — marking is the verifier's step)

## Obsolescence check

- **IMP-040 — not obsolete, one sub-field is.** The bug still exists at
  `src/domain/itemActions.ts` `updateOccurrence`: the non-recurring branch wrote only
  `{ start: patch.start ?? item.start }`, silently dropping `end` and `notes`. However the
  `status` field named in the spec's AC1 no longer exists in the patch signature — IMP-016
  (`1d05687`) deliberately removed `status?: OccurrenceStatus` because per-occurrence status
  is occurrence state, not an override. So "all supported fields" is now `start`, `end`,
  `notes`. Also, IMP-077's note ("IMP-040 already works in that function") is inaccurate: the
  current code drops `end`/`notes`; only `start` was applied.
- **IMP-041 — partially obsolete.** The `splitSeries` half (AC1, and AC3 for
  `recurrence.ts`) is already done and tested: `src/domain/recurrence.ts:434-435` null-guards
  `parseLocalDate(fromKey)` and `recurrence.test.ts:542` covers `''`/`'not-a-date'`. The
  `stats.ts` half (AC2/AC3) was still open with three `parseLocalDate(...)!` assertions.

## Change

| File | Change |
| --- | --- |
| `src/domain/itemActions.ts` | Non-recurring `updateOccurrence` branch now builds an `ItemPatch` from every provided field: `start`, `end` (including `null` to clear), `notes`. `undefined` fields are omitted, so they stay unchanged. Recurring branch untouched. |
| `src/domain/stats.ts` | `habitStreak`: `parseLocalDate(item.start)` result is null-checked and falls back to `addMonths(today, -12)`; the best-streak loop parses the first/last period keys without `!` and skips the scan when either is unparseable. |
| `src/domain/itemActions.test.ts` | New `updateOccurrence (non-recurring)` block: applies `start`+`end`+`notes`; leaves omitted fields unchanged; clears `end` on explicit `null`. |
| `src/domain/stats.test.ts` | `habitStreak` no longer throws on a malformed `item.start`; returns the zeroed `StreakResult`. |

No `!` on `parseLocalDate` remains in either module (`recurrence.ts`, `stats.ts`).

## Acceptance criteria

- **IMP-040.1** all provided patch fields persist — covered by the first test; **.2**
  `undefined` unchanged — second test (end/notes retained); **.3** recurring unchanged — the
  `updateRecurring`/override path was not edited and its existing tests still pass.
- **IMP-041.1** `splitSeries` safe no-op — pre-existing guard + test (recurrence.test.ts:542);
  **.2** `habitStreak` falls back for malformed start — new test; **.3** no remaining `!` —
  verified by grep.

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 69 files, 693 tests passed (+4)
- `npm run format:check` — clean

No new deps, no schema/store changes, no comments beyond the two intent notes.
