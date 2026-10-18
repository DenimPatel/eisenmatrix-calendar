# IMP-082 — Independent verification

**Reviewer:** independent (did not author the change)
**Verdict:** PASS

Scope reviewed: `git diff` (4 files, +109/-2) plus the two untracked reports
(`impl-IMP-082.md`, `discovered-IMP-082.md`). No source files modified by the reviewer;
throwaway probes were deleted.

## Gates

All run on the working tree, in order, all green:

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 43 files / 483 tests passed
- `npm run format:check` — clean
- `npm run build` — clean (PWA injectManifest SW emitted)

## Acceptance criteria

1. **No empty tail; head untouched on refusal — PASS.** `hasOccurrenceOnOrAfter(stored, occKey)`
   is checked before `splitSeries` (`src/domain/itemActions.ts:373-376`); on failure nothing is
   written, no undo entry is pushed, and one `info` toast
   ("Nothing to split — the series has no later occurrences") is shown. Refusal returns `false`,
   so the persisted series is byte-identical to the unsplit render. Test
   "writes no tail when the split lands past the series' last occurrence" asserts
   `itemRepo.all()` equals the pre-call row, empty undo stack, the toast, and that every persisted
   recurring row still expands to ≥1 occurrence.
2. **Inverted tail range normalized — PASS.** `src/domain/itemActions.ts:392-396` drops
   `tailPatched.end` when the patched `end` precedes the patched `start`. Confirmed by test and by
   throwaway probes: all-day start-only edit (`start=2026-07-25`, stale `end` dropped → `null`),
   end-only inversion (`end=2026-07-01` dropped), and no over-normalization (moving `start`
   earlier to `2026-07-18` with `end=2026-07-19` keeps both). Date-only `end` against a timed
   `start` is dropped, consistent with the engine's `endFollowsStart`.
3. **Mid-series invariants — PASS.** `splitSeries` was not modified (no signature change), so the
   IMP-023 property sweep and every existing `splitSeries` unit test are untouched and pass. A
   probe on an unbounded weekly series splitting mid-series wrote head+tail with the union of
   occurrence keys equal to the unsplit set.
4. **No-op for count / unbounded / mid-range until — PASS.** `hasOccurrenceOnOrAfter` returns
   `true` for an unbounded rule, a count with remaining slots, and an `until` past the split
   (unit tests + all pre-existing future-scope tests). `count: 0` correctly returns `false`.

## Boundedness / performance (infinite rules)

The loop returns on the first candidate `>= boundaryDay`, so a near split is O(1). For an
unbounded daily rule with a split 100 years out it terminates in ~24 ms; the generator's
`MAX_ITERATIONS` (200,000) caps the worst case. Beyond that cap (probe: unbounded daily, boundary
600 years out) it returns `false` — matching `expandOccurrences`, which likewise yields nothing
there, so the guard is consistent with the engine and cannot mis-refuse a rendered occurrence
(occurrences only render within the same cap).

## Refusal UX / editor state

`ItemEditorSheet.handleSave` (`src/features/item/ItemEditorSheet.tsx:206-227`) calls
`updateRecurring`, then always `closeEditor()`. For scope `future` the branch's own info toast is
the feedback (the sheet only adds a toast for scope `occurrence`), and `false` means no row, no
undo entry, and the draft is discarded on close — sane, no half-applied state.

## Scope / leftovers

Diff is limited to the two domain files and their tests. No stray debug code, no unrelated edits,
no signature changes; `splitSeries` is untouched. Backlog status left as TODO (expected pre-verify).

## Residuals (not blocking)

- **D1 (exceptions), pre-existing, out of scope.** `hasOccurrenceOnOrAfter` counts candidate days
  only, so a split whose every remaining candidate is in `recurrence.exceptions` still reports a
  later occurrence and writes a tail that expands to zero *visible* occurrences (probe confirmed:
  daily `count: 3`, `exceptions: ['2024-01-03']`, split at `2024-01-03` → `hasOccurrenceOnOrAfter`
  true, tail expands to 0). This is the same empty-tail class the item targets, via a different
  mechanism. IMP-082's Notes explicitly keep the tail's `exceptions`/`overrides` copy out of scope,
  and the pre-change code produced this empty tail too, so this is a documented residual, not a
  regression. Logged in `discovered-IMP-082.md`. A strict reading of criterion 1 ("beyond the
  series' last occurrence") could be taken to include it, but criterion 4 scopes the guard to
  count/until and the Notes exclude exceptions.
- **Empty *head* at a single-occurrence split, pre-existing.** Splitting a `count: 1` series at its
  only occurrence yields a head whose `until` precedes its first candidate and therefore expands
  to zero occurrences (`splitSeries` is unchanged, so this predates IMP-082). The item title scopes
  the fix to the *tail*; worth a future item, not a criterion failure here.

## Conclusion

All four acceptance criteria are met as scoped, all five gates pass, and the two named failure
modes are fixed with mutation-verified tests. **PASS**, with D1 recorded as an accepted residual.
