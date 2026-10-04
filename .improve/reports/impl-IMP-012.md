# IMP-012 — Implementation report

**Status:** implemented (all gates pass; not marked DONE in FEATURES.md)

## Change

| File                                        | Change                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/item/cardTime.ts` (new)       | Pure helper `resolveCardTime(occurrenceStart, itemStart)` → `formatTime(occurrenceStart ?? itemStart)`. Lives in its own module so `ItemCard.tsx` still only exports a component (an in-file export tripped the `react-refresh/only-export-components` lint warning). |
| `src/features/item/ItemCard.tsx`            | New optional `start?: string \| null` prop (the resolved occurrence start). The clock label is now `resolveCardTime(start, item.start)` instead of `formatTime(item.start)`. Everything else — drag id, done toggle, status, recurrence label, tags — is untouched. |
| `src/features/today/TodayView.tsx`          | "Today's agenda" passes `start={occ.start}` to `ItemCard`.                                                                                                                                                                                                                   |
| `src/features/calendar/CalendarView.tsx`    | `AgendaList` (day + week modes) passes `start={occ.start}`.                                                                                                                                                                                                                    |
| `src/features/item/ItemCard.test.tsx` (new) | 6 tests: 3 unit cases for `resolveCardTime`, 3 render cases for the card.                                                                                                                                                                                                       |

```ts
export function resolveCardTime(
  occurrenceStart: string | null | undefined,
  itemStart: string | null,
): string {
  return formatTime(occurrenceStart ?? itemStart);
}
```

Callers pass the already-resolved `Occurrence.start` (post-override, per the AGENTS.md note), so no
occurrence object is prop-drilled — only the one string the card actually needs.

### Design notes

- **Presence, not truthiness.** The fallback keys on `start == null`, matching AC1 ("when supplied").
  An occurrence whose resolved start is date-only (all-day moved occurrence) therefore shows no clock
  label instead of inheriting the series' time — the alternative would print a time the occurrence
  does not have. `formatTime` already returns `''` for date-only values, so nothing else changes.
- **`Item.start` remains the fallback**, which is what `MatrixView` (the only caller without
  occurrences) relies on. Non-recurring items resolve to `occ.start === item.start`, so their cards
  are byte-identical.
- **The month grid in `CalendarView` was already correct** (it renders `formatTime(occ.start)`
  inline); only `AgendaList` used `ItemCard`. Year mode uses its own card and has no time label.

## Acceptance criteria

1. Card renders the resolved occurrence start when supplied, else `item.start` — covered by the
   `resolveCardTime` unit tests (`'2026-10-08T16:30'` wins over `'2026-10-01T09:00'`; `undefined`
   and `null` fall back; date-only → `''`) and by the render tests.
2. A recurring item moved via `updateOccurrence` shows the moved time on Today and Calendar —
   verified in the browser (see below) and in the "shows the overridden time of a moved occurrence"
   render test, which builds the override, resolves it through `expandOccurrences`, and asserts the
   card renders `16:30` and **not** `09:00`.
3. No visual regression for non-recurring items — the fallback tests plus the "non-recurring item with
   a time" render test; `MatrixView` cards are unchanged because they pass no `start`.

## Tests added

`src/features/item/ItemCard.test.tsx` (jsdom, 134 → 140 tests across 21 files, all passing):

- `resolveCardTime` — prefers the occurrence start; falls back for `undefined` and `null`; returns
  `''` for all-day values on either side.
- `ItemCard time label` — moved occurrence renders `16:30` and not `09:00`; a card without `start`
  still renders the series anchor `09:00`; a non-recurring item renders its own time when
  `start={occ.start}` is passed.

Cards are mounted inside a `DndContext` (required by `useDraggable`) with `createRoot` + `act`, the
same pattern as `NotesView.test.tsx`.

**Mutation check:** forcing `resolveCardTime(undefined, item.start)` back into `ItemCard.tsx` makes
exactly the moved-occurrence test fail (`expected … to contain 16:30`); the other five still pass, so
the suite pins the fix rather than the plumbing.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean, no new warnings) ·
`npm run test` (21 files, 140 tests passed) · `npm run build` (OK, `dist/sw.js` emitted, 18 precache
entries, 603.55 KiB) · `npx prettier --write` applied to the touched files.

## Browser verification (preview + Playwright)

Seeded a daily task `Weekly sync`, series `2026-09-28T09:00`, override `2026-10-04 →
2026-10-04T16:30`, then:

| Surface | Expected | Seen |
| --- | --- | --- |
| Today → Today's agenda card | moved time | `Weekly sync 16:30 Daily` |
| Calendar → month cell Oct 4 | moved time | `16:30 Weekly sync` |
| Calendar → day mode agenda card | moved time | `Weekly sync 16:30 Daily` |
| Matrix card (no `start` prop) | series anchor | `Weekly sync 09:00 Daily` |

Then, through the real editor: opened the occurrence from the Calendar agenda, Schedule tab, changed
the time to `14:45`, saved with scope "This occurrence" → toast **"Occurrence updated"**, and both
Today and Calendar cards switched to `14:45` live. No console errors/warnings. Seeded row deleted
afterwards.

Caveat for whoever re-verifies: after a rebuild the already-open preview tab keeps serving the
**old** bundle from the service-worker precache (it first showed `09:00` after the fix). Unregister the
SW and clear `caches` (or use a fresh context) before judging UI results — details in
`discovered-IMP-012.md` §3.

## Notes for the verifier

- Out-of-scope findings, do not fold them into this item:
  `.improve/reports/discovered-IMP-012.md` — (1) the editor writes the *series* date into an
  occurrence override and mutates `item.start` when scope is "This occurrence" (so a moved occurrence
  resolves to the wrong day), (2) `ItemEditorSheet` crashes on rows with no `data` payload,
  (3) the stale-SW trap above.
- Other views that list occurrences with their own inline `formatTime(occ.start)` (calendar month
  grid, year month cards) were left alone: they were already correct, and the spec scoped this item to
  `ItemCard` + Today + Calendar.
