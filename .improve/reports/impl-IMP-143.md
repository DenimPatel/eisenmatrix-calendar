# IMP-143 — Keep a reminder consistent when All day is toggled

**Status:** DONE (uncommitted)
**Item:** `.improve/FEATURES.md` → IMP-143 (correctness / reminders)
**Source:** `discover4-ux.md` U11 (S2, 3/3/5)

## Problem

`ReminderEditor` chose its per-row control from the current `allDay` prop while rendering
values from the reminder's stored fields, and `formatReminderLabel`/`reminderFireTime`
disagree on precedence (`offsetMinutes` wins the fire time, `timeOfDay` wins the label).
A stored `{timeOfDay:'09:00'}` on a now-timed item therefore rendered the offset select
("10 min before") beside the label "At 09:00" — one row naming two different instants, and
an edit would persist a bogus offset.

## Changes

- `src/domain/reminders.ts` — new pure `reconcileReminderMode(reminders, allDay, start)`
  returning `{ start, reminders }`:
  - **All day off:** a date-only `start` takes the earliest `timeOfDay` in the set (else
    `09:00`); each `timeOfDay` becomes its offset from that start, preserving the fire
    instant. `absolute` rows are untouched.
  - **All day on:** an `offsetMinutes` converts to `timeOfDay` only when its fire instant
    lands on the same calendar day as the start; a cross-day offset is **kept** (never
    dropped) and renders as its own offset row.
- `src/features/item/ReminderEditor.tsx` — renders each row by the reminder's **own** stored
  shape: `absolute` → read-only timestamp, `timeOfDay` → time input, `offsetMinutes` →
  offset select (with the row's own value added as an option when it is not a preset, so a
  kept cross-day offset is shown honestly). A triggerless row renders read-only. Control and
  `formatReminderLabel` can no longer disagree for any stored shape.
- `src/features/item/ItemEditorSheet.tsx` — the All-day toggle now updates `allDay`, `start`,
  `dueAt`, `end` and `reminders` in one draft change via `reconcileReminderMode`. `Add` is
  unchanged (`timeOfDay` when all-day, offset otherwise).

## Tests

- `src/domain/reminders.test.ts` — `reconcileReminderMode`: timeOfDay ↔ timed start, earliest
  time seeding, 09:00 default, offset `-10` @ 09:00 start → `08:50` all-day, cross-day offset
  kept, absolute untouched, off→on round trip, and fire-time/label agreement.
- `src/features/item/ReminderEditor.test.tsx` (new, jsdom) — stored `timeOfDay` row on a timed
  item renders the time input (no select); stored offset row on an all-day item renders the
  select (no time input); absolute → read-only; kept cross-day offset → its own option; and a
  harness that simulates the toggle and asserts control/label agreement both ways.
- `src/features/item/ItemEditorSheet.test.tsx` — integration: new all-day task → Add reminder
  (09:00) → uncheck All day → select value and label name the same instant; re-check → 09:00
  preserved.

**Mutation check:** reverting the control selection to `allDay` (`{allDay ? (`) fails 3 of the
5 `ReminderEditor` tests; restored, diff intact.

## Gates

`npm run typecheck` PASS · `npm run lint` PASS · `npm run test` PASS (76 files · 775 tests) ·
`npm run format:check` PASS · `npm run build` PASS (`dist/sw.js`, precache 28 entries).

## Browser verification

Isolated preview `npm run preview -- --port 4190 --strictPort`, SW + caches reset per AGENTS.md,
1280×800, 0 console errors/warnings. New task → Schedule → All day → Add reminder (09:00):
row = time input `09:00` + "At 09:00". Uncheck All day: row = offset select `0` / "At start"
+ label "At start", start `2026-10-18T09:00` (no contradiction). Re-check All day: time input
`09:00` + "At 09:00"; saved item = `{allDay:true, start:'2026-10-18', reminders:[{timeOfDay:'09:00'}]}`
→ fire instant preserved. Screenshots in `.improve/artifacts/IMP-143/`.
