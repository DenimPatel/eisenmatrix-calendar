# verify-IMP-093 — Keep pre-switch schedule edits when scope changes to future

**Reviewer:** independent (did not author the change)
**Diff:** `src/features/item/ItemEditorSheet.tsx` (`changeScope`), `src/features/item/ItemEditorSheet.test.tsx`
**Verdict: PASS**

## What changed

`changeScope` now early-returns for `next === 'future'`, so a switch to “This and future” keeps
the draft's `start`/`end`/`allDay` as edited. Only `occurrence` (reseed from `seed`) and `all`
(restore from `editor.item`) rewrite the schedule. A regression test was added; `FEATURES.md` is
untouched.

## Acceptance criteria

1. **`future` preserves edits, `all` restores series — MET.** The only schedule rewrite sites are
   the `occurrence`/`all` ternary at `ItemEditorSheet.tsx:177-181`; `future` returns first. The
   pre-existing IMP-077 test (“does not leak the seeded occurrence range into an all-occurrences
   save”) still passes, pinning `all`.
2. **Regression test — MET.** The new test asserts the time input still reads `14:45` after the
   scope switch, that the persisted tail starts `2026-10-04T14:45`, and that the head expands to
   `09:00` on `2026-10-03`. On the pre-fix code the `future` branch fell through to
   `editor.item` (series) values, so the `14:45` assertion would fail; this follows from the diff
   but was **not** re-run by reverting source (review constraint: no source modification).
3. **Occurrence scope unchanged — MET.** `next === 'occurrence'` still reseeds from `seed`; all
   existing occurrence-scope/seed/override tests pass.

## Gates (all clean)

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 43 files, 484 tests passed
- `npm run format:check` — clean
- `npm run build` — OK (`dist/sw.js`, 18 precache entries)

## Probe suite (throwaway, deleted afterwards)

7 jsdom tests exercising the scope-switch state machine; all passed:

- `occurrence → future`: edit preserved (`14:45`).
- `future → all`: series schedule restored (`09:00`), no split, single row.
- `occurrence → all → future` with a seeded override: no leak of the override; tail `09:00`,
  head override untouched.
- `occurrence → future → occurrence → future`: the edit is dropped when reseeding to
  `occurrence` and is **not** resurrected on the second `future`; tail `09:00`.
- unedited `occurrence → future`: tail `2026-10-04T09:00`, head `until 2026-10-03`,
  `10-04/05/06` all `09:00` — equivalent to a plain split, no corruption.
- title edit in `future` reaches the tail only; head keeps the original title.
- `allDay` override on the occurrence carries into the tail consistently (tail `allDay:true`,
  bare-date start).

## Issues

- **Low (observation, not a blocker):** editing the occurrence **date** before switching to
  `future` keeps the new date as the tail anchor while the head still ends the day before the
  original occurrence key, so the days between the old and new date disappear (probe D:
  date→`2026-10-06`, head `until 2026-10-03`, `10-04`/`10-05` gone). This is a defensible reading
  of “the start moved forward”, and the pre-fix behaviour silently discarded the edit, so it is
  not a regression; but the gap semantics are undocumented. Worth a follow-up note.
- **Informational:** `IMP-093` remains `TODO` in `FEATURES.md` — intended by the impl report.
- **Informational:** the report's “fails pre-fix” claim was validated by code reading, not by
  reverting the source.

No scope creep, no debug leftovers, no unrelated edits.
