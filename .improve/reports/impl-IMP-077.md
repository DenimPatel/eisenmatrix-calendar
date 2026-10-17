# IMP-077 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File | Change |
| --- | --- |
| `src/features/item/ItemEditorSheet.tsx` | New `seedDraft(item, occKey)` clones the row and, only when the item is **recurring** and an occurrence key is present, resolves that key with `expandOccurrences(item, day, day)` and replaces `start`/`end`/`allDay` with the resolved (override-merged) occurrence values. The editor keeps the seed as a separate baseline state. `occurrencePatch(draft, seed)` now diffs against the seeded occurrence, so opening and saving without schedule edits writes nothing. `changeScope` restores the occurrence range when returning to `occurrence`, and the series' own `start`/`end`/`allDay` for `future`/`all`, so seeded values never reach a series save. Non-recurring items (`recurrence` null/absent) are never seeded, so the non-recurring editor path stays exactly as before, even when a view passes an occurrence key. |
| `src/domain/itemActions.test.ts` | Added an occurrence-scope save whose patch carries a changed time, asserting `overrides[key].start` keeps the occurrence date and the series row is untouched. |
| `src/features/item/ItemEditorSheet.test.tsx` | Added four editor tests: seeded/override-merged schedule values (moved occurrence), time change persisted as `2026-10-04T14:45`, an all-occurrences save after opening a moved occurrence keeping the series dates, and a non-recurring all-day event with a multi-day end (`2026-10-20` → `2026-10-22T00:00`) opened with an occurrence key asserting the draft and untouched save keep both series values. |

## Acceptance criteria

1. **Seed from resolved occurrence** — the Schedule tab's date/time inputs and All-day checkbox
   read the expanded occurrence, including its override (test asserts `2026-10-05` / `14:45` for
   key `2026-10-04`).
2. **Override keeps the occurrence date** — changing the time of `2026-10-04` stores
   `start: '2026-10-04T14:45'`; the `itemActions` test asserts the same at the persistence layer.
3. **No leak into all-scope saves** — switching to All occurrences resets the schedule fields to
   the series row; the saved series `start`/`end` remain `2026-09-28T09:00`/`10:00` and the
   occurrence override is untouched.
4. **Non-recurring unchanged** — `seedDraft` returns the plain clone unless `item.recurrence`
   is set, so views that pass an occurrence key for a non-recurring item no longer reseed.
   The regression test opens a non-recurring all-day event (`start 2026-10-20`,
   `end 2026-10-22T00:00`) with key `2026-10-20`, asserts the Schedule inputs show
   `2026-10-20` / `2026-10-22T00:00`, and asserts an untouched save persists both values with
   no history entry. It fails without the gate (`end` becomes `2026-10-20T00:00`), matching
   the verifier's repro.

## Gates

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 41 files, 441 tests passed (baseline 436; +5)
- `npm run build` — OK, `dist/sw.js` emitted, 18 precache entries

No new deps, no `toISOString()` keys, no routes changed. Browser drag/reopen was not re-run;
the jsdom tests reproduce the same resolved-override state that a drag leaves behind.
