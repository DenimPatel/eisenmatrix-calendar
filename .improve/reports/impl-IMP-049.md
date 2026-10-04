# IMP-049 — Implementation report

**Status:** implemented (all four gates pass; not marked DONE in FEATURES.md)

## Change

| File | Change |
| --- | --- |
| `src/lib/labels.ts` | Added pure `weekdayLabels(weekStartsOn: 0 \| 1): string[]` that rotates the existing `WEEKDAY_LABELS` (`Sun`…`Sat`) so it starts on the configured week day. Lives next to the other display-copy constants, so it is unit-testable without mounting. |
| `src/features/calendar/CalendarView.tsx` | Reads `useSetting<AppSettings>('app', DEFAULT_SETTINGS)` (same pattern as `ItemEditorSheet`/`SettingsView`) and threads `settings.weekStartsOn` into the `interval` memo (`startOfWeek`/`endOfWeek` for the `week` and `month` cases) and into the weekday header row, which is now `{weekdayLabels(weekStartsOn).map(...)}` instead of the hardcoded Mon–Sun array. |

`day` and `year` modes are untouched (no week alignment involved), so behaviour there is identical.

## Acceptance criteria

1. `weekStartsOn` is read from the `app` setting and used for the week and month interval bounds — `src/features/calendar/CalendarView.tsx:37-38,49-58`.
2. Header order derived from the setting via `weekdayLabels` — `src/features/calendar/CalendarView.tsx:167`.
3. First cell of the first week row is a Sunday with `weekStartsOn=0`, Monday with `1` — covered by tests and browser checks below.
4. Default (Monday) unchanged — `DEFAULT_SETTINGS.weekStartsOn` is still `1` and the rotation for `1` reproduces the previous header exactly.

## Tests added

- `src/lib/labels.test.ts` (node env): `weekdayLabels(0)` → `Sun…Sat`, `weekdayLabels(1)` → `Mon…Sun`, both length 7, and `WEEKDAY_LABELS` is not mutated.
- `src/features/calendar/CalendarView.test.tsx` (jsdom, `createRoot` + `DndContext` like `src/test/app.smoke.test.tsx`): seeds `settingsRepo` with `weekStartsOn` 0/1, then asserts the exact header order, that the first day cell's `aria-label="Add item on …"` date falls on the expected weekday, that the week-mode interval starts on `startOfWeek(now, weekStartsOn)`, and that a missing setting falls back to Monday. Because the setting arrives through a Dexie live query, the mount helper polls (up to 1s) until the setting-driven render lands before asserting.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test` (14 files, 100 tests passed; baseline was 49 tests in 10 files) · `npm run build` (OK, `dist/sw.js` emitted, 18 precache entries).

## Browser verification (Playwright, `npm run preview` on :4173)

- Settings → "Week starts on" = Sunday → `#/calendar`: header `Sun Mon Tue Wed Thu Fri Sat`; first day cell `2026-09-27` (a Sunday); month grid ends `2026-10-31`.
- Same setting, `week` mode: title `Sep 27 – Oct 3, 2026`, first cell `2026-09-27`.
- Settings → "Week starts on" = Monday → `#/calendar`: header `Mon Tue Wed Thu Fri Sun`; first day cell `2026-09-28` (a Monday).
- No console errors or warnings on either route.
