# impl-IMP-100 — Accessible tap targets for the completion toggle and calendar day add

**Status:** done

## Change

Primary targets (the two the item names):

- `src/features/item/ItemCard.tsx` — the completion toggle was a 16×16 circle (`h-4 w-4`).
  It is now a 44×44 `<button>` (`h-11 w-11`) whose negative margins
  (`-mb-3.5 -ml-3.5 -mr-3.5 -mt-3`) keep the original 16 px layout footprint, with the
  16 px circle moved into an inner `<span>` so the visual is unchanged. Hover moved to
  the wrapper via a named `group/toggle` so the whole 44 px area reacts.
- `src/features/calendar/CalendarView.tsx` — the day "add" control was a 16×16
  `rounded p-0.5` button. It is now a 44×44 button (`-mx-3.5 -my-2.5`, 16×24 footprint)
  wrapping a 24×24 hover chip, so the month grid header row keeps its 24 px height and
  40 px content width at 390 px. The `Today` control gained `min-h-6` (it was 16 px
  tall). Month occurrence chips, `+N more`, and the year-view item/`more` rows gained
  `py-1`/`leading-4`/`py-1` so every one clears 24 px.

Adjacent controls the route-wide probe flagged, fixed to satisfy acceptance criteria
1 and 3 (no interactive control under 24 px at 390 px):

- `src/components/ui/ToastHost.tsx` — dismiss button 14×14 → 24×24 (`h-6 w-6`, 14 px icon).
- `src/components/ui/Form.tsx` — `Checkbox` 16×16 → 24×24 (`h-6 w-6`); native
  checkboxes ignore padding, so the box itself had to grow.
- `src/features/matrix/MatrixView.tsx` — the `Hide completed` input now uses the shared
  `Checkbox` (was a 13 px native input).
- `src/features/shopping/ShoppingView.tsx` — purchased-item title button `py-0.5` (20 → 24).
- `src/features/goals/GoalsView.tsx` — goal title button `py-0.5` (20 → 24).
- `src/features/habits/HabitsView.tsx` — habit title button `py-0.5` (20 → 24).
- `src/features/notes/NotesView.tsx` — note title button `py-0.5` and pin toggle
  `h-6 w-6` (22 → 24).

## Tests

- `src/features/item/ItemCard.test.tsx` — asserts the toggle is `h-11 w-11` and the
  inner circle stays `h-4 w-4`.
- `src/features/calendar/CalendarView.test.tsx` — asserts the day add is `h-11 w-11`
  and `Today` carries `min-h-6`.
- `src/components/ui/Form.test.tsx` (new) — asserts `Checkbox` is `h-6 w-6`.

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check` — all pass
(57 files, 580 tests).

## Visual verification

Built `dist/`, ran `npm run preview` on 4173, then verified through a fresh Playwright
context (the default MCP context has `indexedDB` disabled, so the app could not persist
items there). Seeded 12 items across task/shopping/habit/goal/bill/note via IndexedDB,
reloaded, and probed all ten routes at 390×844:

- Item-card completion toggle: **44×44** (Today 11 instances, Matrix 7).
- Calendar day add: **44×44**.
- No interactive control under 24 px on any of the ten routes.
- `documentElement.scrollWidth === innerWidth` (390) on the calendar month grid — no
  horizontal overflow; cells kept their 24 px header row.

Screenshots in `.improve/artifacts/IMP-100/`
(`{today,lists,matrix,calendar}-{390,1280}-{light,dark}.png`). Preview server stopped
afterwards.

## Notes

- The item's `Area / files` listed only `ItemCard.tsx`, `CalendarView.tsx` and
  `Button.tsx`; acceptance criterion 1 ("every interactive control in the ten routes has
  a hit area ≥24×24 at 390px") could not hold without the adjacent fixes above. `Button`
  needed no change (`icon` is already `h-9 w-9`).
- `Checkbox` grows visually from 16 px to 24 px; native checkboxes cannot take a padded
  hit area, and 24 px is the WCAG 2.2 minimum.
- No changes outside the item. No commit or push.
