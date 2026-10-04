# IMP-007 — Implementation report

**Status:** implemented (all four gates pass; not marked DONE in FEATURES.md)

## Change

| File | Change |
| --- | --- |
| `src/domain/quickadd.ts` | Added pure `NOTE_TITLE_MAX = 80` and `splitNoteDraft(text): { title, notes }`. The first line still becomes the title (capped at 80 chars for card/editor display), but everything past the cap is prepended to the body instead of being discarded, so `text === title + notes` whenever the input has no trailing line separators consumed by the split. Remaining lines follow in the body unchanged. |
| `src/features/notes/NotesView.tsx` | `addNote` (`addNote`, `:28-33`) now calls `createItem({ kind: 'note', ...splitNoteDraft(text) })`; the inline `firstLine.slice(0, 80)` truncation and the manual `split('\n')` are gone. |

Why `domain/quickadd.ts`: the helper is pure text logic on the quick-add path, it sits with the other quick-add parsing helpers, and it stays unit-testable in the default `node` environment (no React/DOM import). `NotesView` remains the only consumer.

The 80-char title cap is preserved deliberately — it is what keeps the note card title readable — the overflow is no longer destroyed.

## Acceptance criteria

1. A single-line note longer than 80 chars is stored in full — the overflow becomes the body, so no characters are dropped (`src/domain/quickadd.ts:350-357`).
2. Multi-line notes still map the first line to `title` and the remaining lines to `notes` — covered by tests (`'Groceries\nmilk\neggs'` → title `Groceries`, notes `milk\neggs`).
3. A 200-char single line re-read from Dexie returns all characters across `title` + `notes` — asserted in `src/features/notes/NotesView.test.tsx` (mounts the real `NotesView`, types into the textarea, clicks **Add note**, then polls `itemRepo` for the persisted row).

## Tests added

- `src/domain/quickadd.test.ts` (node env, existing file): new `describe('splitNoteDraft')` with 7 cases — 200-char single line preserves every character (`title + notes === text`), short line stays title-only, exactly-`NOTE_TITLE_MAX` line is not truncated, multi-line mapping, over-cap first line plus a following line (round-trip via `text.slice(title.length) === notes`), interior blank lines preserved, empty input.
- `src/features/notes/NotesView.test.tsx` (jsdom, new file; `createRoot` + `act` + fake-indexeddb like `src/features/calendar/CalendarView.test.tsx`): 200-char single line round-trips through Dexie with nothing lost, multi-line draft maps to title/body, and the draft clears after adding so the same note cannot be added twice.

Negative check: temporarily restoring the old `firstLine.slice(0, 80)` behaviour makes the 200-char test fail with `title + notes` = 80 chars, so the test genuinely pins the fix.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (15 files, 110 tests passed; baseline was 100 in 14 files) · `npm run build` (OK, `dist/sw.js` emitted, 18 precache entries). `npx prettier --check` clean on all touched files.

## Browser verification (Playwright, `npm run preview` on :4173, fresh SW/IndexedDB)

- `#/notes`, typed a 230-char single line, clicked **Add note**: stored `title` = 80 chars, `notes` = 150 chars, total 230 — nothing dropped. Card renders the 80-char title plus the overflow body paragraph.
- Editor opens on the note with the full title; body holds the remainder.
- No console errors or warnings on the route. Test data cleared afterwards.

Verification gotcha (not a defect): the preview service worker served the previously precached bundle after a rebuild, so the first check ran old code. Had to unregister the SW, delete `workbox-precache-v2-*` and drop the `eisenmatrix` IndexedDB before the new bundle loaded — see `.improve/reports/discovered-IMP-007.md`.