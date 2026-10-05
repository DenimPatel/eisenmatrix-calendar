# IMP-018 — Implementation report

**Status:** implemented; all four gates pass; not marked DONE in FEATURES.md; not committed.

## 1. The change

One line of behaviour in `src/domain/quickadd.ts` (`quickAddToItem`, now `:433`):

```ts
// A habit only makes sense as a series; default it to daily so streaks are computable.
item.recurrence = parsed.recurrence ?? (parsed.kind === 'habit' ? baseRule('daily') : null);
```

`baseRule('daily')` is the module's existing rule factory, so the default is byte-identical
in shape to a parsed `every day` / `daily` rule: `{ freq: 'daily', interval: 1,
weekStartsOn: 1, exceptions: [], overrides: {} }`. No new helper, no new file, no change
to `parseQuickAdd`, the item factory, the schema or any UI.

Why here and not in `parseQuickAdd`: `QuickAdd.tsx:47-52` calls `quickAddToItem(parsed)` and
then, if the user changed the Kind in the dialog, overwrites `item.kind` and `item.data`
only — `item.recurrence` survives. A parse-time default would therefore attach "Daily" to a
task the user re-typed as a Task, and would also leak into the preview chips for a kind the
user is about to change. Defaulting at the commit boundary keeps the rule consistent with the
kind that is actually written. (Consequence: the preview chips do not show it — see
`.improve/reports/discovered-IMP-018.md` §1.)

Explicit input still wins: `parsed.recurrence ?? default`, so `habit: stretch every 3 days`
keeps `{freq:'daily', interval:3}` and `habit: gym mon/wed/fri` keeps its `byWeekday` list.

## 2. Acceptance criteria

| AC | Where satisfied |
| --- | --- |
| 1. habit + no parsed recurrence → daily `interval: 1` | the line above; test *"defaults a habit to a daily rule so it recurs from today"* |
| 2. explicit recurrence preserved | `??` short-circuit; test *"keeps an explicit recurrence from the input"* |
| 3. shows today and expands for the coming week | `start` is unchanged (`parsed.start`, today when no date is given) and the daily rule expands; test *"expands a quick-added habit across the coming week"* asserts the 7 keys `2024-06-10 … 2024-06-16` from `expandOccurrences`; browser check in §4 |

## 3. Tests

`src/domain/quickadd.test.ts`: new `describe('quickAddToItem')` block, **+4** cases
(218 → 222): daily default with `interval === 1`; `every 3 days` preserved as
`interval === 3`; `expandOccurrences` over the coming week returns all seven consecutive
local occurrence keys; a non-habit quick-add still has `recurrence === null` (regression
guard for the `??` branch). The week test drives the real `expandOccurrences` from
`./recurrence` rather than asserting on the rule object alone, so AC 3 is covered at the
level the UI consumes.

`npm run test`: 26 files, **222** passing.

## 4. Browser verification (Playwright, `npm run preview` on :4173)

The first attempt was served from the **stale service-worker precache** and created a
recurrence-less habit; the service worker was unregistered and `workbox-precache-v2-*`
cleared, then the flow was repeated against the current bundle. Worth knowing for future
verifications of this app.

1. Today → **Quick add** → `habit: journal` → chips: `habit`, `2026-10-05`, title
   "Journal", Kind `Habit` → **Add**. Toast `Added "Journal"`.
2. Stored row in IndexedDB:
   `recurrence {freq:"daily", interval:1, weekStartsOn:1, exceptions:[], overrides:{}}`,
   `start "2026-10-05"`.
3. Today: the habit appears in **Today's agenda** (badge "Daily") and in the **Habits**
   panel with `0 day streak · best 0`. Habits: the row shows a `Complete today` control
   ("Complete today" toggle + 1× per day + Mon–Sun week strip + completion heatmap).
4. Calendar (month, October 2026): **Journal appears on Oct 5 and on every following day
   through Nov 1** — the daily series expands. Control items created without a rule
   (`Meditate`, the seeded `Drink water`) appear on their start day only.
5. Console: **0 messages.**

Cleanup: both probe habits were deleted from the browser's IndexedDB via a raw read-write
transaction; the only remaining habit is the pre-existing seeded `Drink water`.

## 5. Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run test` 26 files / 222 tests ·
`npm run build` OK (`dist/sw.js`, 18 precache entries, 607.35 KiB).

## 6. Out of scope

Four adjacent observations (preview chips, non-quick-add habit creation, no back-fill of
existing habits, and a Today-screen duplication that the daily default makes visible) are in
`.improve/reports/discovered-IMP-018.md`. None were changed.
