# IMP-037 — Implementation report

**Status:** implemented (all gates pass; backlog state untouched)

## Change

| File | Change |
| --- | --- |
| `src/domain/itemActions.ts` | `updateRecurring` future branch reads the persisted row **before** splitting and builds the head from it (`splitSeries(stored, …)`), so the draft's already-applied patch can no longer reach past occurrences. When the stored row has **no recurrence** (the editor can add a rule to a plain row and save "this and future"), the branch no longer splits: it applies the draft's rule plus the patch to the row, as scope `all` would. Split writes go through one `createMany`, and a single `pushUndo` entry restores the pre-split row and removes the tail through `itemRepo.putAndRemove` (one transaction). |
| `src/db/repository.ts` | Added `itemRepo.putAndRemove(put, remove)` — a single `db.transaction('rw', items)` doing `bulkPut` + `bulkDelete`, so the split undo cannot half-apply. Follows the existing `replaceAll`/`removeWithChildren` transaction style. |
| `src/features/item/ItemEditorSheet.tsx` | `handleSave` no longer pushes a second "Series split" toast; the editor toast is occurrence-scope only, leaving `updateRecurring`'s toast authoritative. |
| `src/domain/itemActions.test.ts` | +4 tests in `updateRecurring (scope: future)`. |

No new dependencies. `count`/`until` handling is unchanged: the tail still receives the
persisted rule through `splitSeries`, so the IMP-023 totals hold.

## Acceptance criteria

1. **Head built from the persisted original** — `src/domain/itemActions.ts:361-374`. `stored`
   is read first and passed to `splitSeries`; only `tailPatched` receives `patch`. The tests
   pass the **already-patched draft** as the `item` argument (the real editor shape), so
   reverting the head source to `item` fails them (mutation-checked: 2 failures).
2. **Single undo entry restores original + removes tail** — `src/domain/itemActions.ts:390-395`.
   Exactly one `pushUndo` runs on the future path. The undo uses
   `itemRepo.putAndRemove([stored], [tailPatched.id])`, a single repository transaction (F3),
   so it cannot half-apply. Covered by the undo test (one stack entry, two rows after split,
   `itemRepo.all()` equal to the pre-split snapshot after undo).
3. **Past occurrences unchanged** — head is unpatched; covered by "leaves every occurrence
   before the split unchanged" with a patched draft.
4. **`count` follows IMP-023** — untouched; the existing count test still passes.
5. **Non-recurring stored row is safe (F1)** — `src/domain/itemActions.ts:366-377`: no
   recurrence on the persisted row ⇒ patch the row (rule from the draft) instead of splitting,
   so head/tail never share an id and undo restores rather than deletes. Covered by "patches
   the row instead of splitting when the stored row has no recurrence": one row, rule persisted,
   one undo entry, undo returns the original recurrence-less row.

## Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run test` **43 files / 478 tests
passed** (baseline 474; +4) · `npm run format:check` clean.

## Verifier findings addressed

- **F1 (High)** — fixed by the `!stored.recurrence` guard above + regression test.
- **F2 (Med)** — the head-untouched and past-occurrence tests now hand over the patched draft
  as `item`; a mutation check (reverting to `splitSeries(item, …)`) fails both.
- **F3 (Low)** — undo is now one transaction via `itemRepo.putAndRemove`; split creation uses
  one `createMany`.

## Notes / limits

- The branch still applies the whole patch to the tail, including series-only fields such as
  `status`; that is the documented "this and future" semantics and is out of scope here.
