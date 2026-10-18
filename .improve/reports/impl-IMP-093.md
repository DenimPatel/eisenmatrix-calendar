# IMP-093 — Keep pre-switch schedule edits when scope changes to future

**Status:** implemented (all gates pass; FEATURES.md left untouched)

## Change

| File | Change |
| --- | --- |
| `src/features/item/ItemEditorSheet.tsx` | `changeScope` now returns early for `future`, so switching to “This and future” leaves the draft's `start`/`end`/`allDay` as the user edited them. Only `all` restores the series range (`editor.item`) and only `occurrence` reseeds from the resolved occurrence (`seed`). Previously both `future` and `all` fell through to the series range, silently discarding any time/day edit made before the switch. |
| `src/features/item/ItemEditorSheet.test.tsx` | Added a regression test: open a daily timed series on occurrence `2026-10-04`, change the time to `14:45` in the Schedule tab, switch to “This and future”, assert the input still reads `14:45`, save, then assert the split tail starts `2026-10-04T14:45` and the head keeps `09:00` for earlier occurrences. |

## Acceptance criteria

1. **`future` preserves edits, `all` restores series** — `changeScope` only rewrites the schedule for
   `occurrence`/`all`. The existing “does not leak the seeded occurrence range into an
   all-occurrences save” test still passes, pinning the `all` behavior (IMP-077).
2. **Regression test** — the new editor test fails on the pre-fix code at the scope-switch assertion
   (`Expected "14:45", Received "09:00"`) and passes after; it also asserts the persisted tail start
   and the untouched head.
3. **Occurrence scope unchanged** — the `next === 'occurrence'` branch is untouched, and the
   occurrence-scope/seed tests all still pass.

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 43 files, 484 tests passed
- `npm run format:check` — clean
- `npm run build` — OK (`dist/sw.js`, 18 precache entries)
- Preview flow (Playwright, `http://localhost:4173/eisenmatrix-calendar/`, SW + caches reset):
  seeded a daily series, opened occurrence `2026-10-18`, set the time to `14:45`, switched to
  “This and future”, confirmed the input still read `14:45`, saved. IndexedDB showed the tail
  `start: "2026-10-18T14:45"` and the head `until: "2026-10-17"`; zero console errors/warnings.
