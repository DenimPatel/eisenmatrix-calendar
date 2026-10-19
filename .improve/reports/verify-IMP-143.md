# Verify IMP-143 — Keep a reminder consistent when All day is toggled

**Verifier:** independent (did not write the change)
**Date:** 2026-10-19
**Subject:** uncommitted working tree on `improve/auto-20261018` (6 files, +303/−47)
**Verdict:** **PASS** — item acceptance criteria met; no regression; all gates green; one
import-only residual gap documented (criterion 1, mixed shape).

---

## Scope inspected

```
 .improve/FEATURES.md                       |   4 +-
 src/domain/reminders.test.ts               |  72 +
 src/domain/reminders.ts                    |  85 +-
 src/features/item/ItemEditorSheet.test.tsx |  57 +
 src/features/item/ItemEditorSheet.tsx      |  25 +-
 src/features/item/ReminderEditor.tsx       | 107 +-
 src/features/item/ReminderEditor.test.tsx  | (new, untracked)
 .improve/reports/{impl,discovered}-IMP-143.md (new, untracked)
```

Spec: `.improve/FEATURES.md` IMP-143 (`src/features/item/ReminderEditor.tsx:23-26,60-77`;
`src/domain/reminders.ts:19-28,158`), `discover4-ux.md` U11.

---

## 1. Core invariant — control value vs `formatReminderLabel` vs `reminderFireTime`

`ReminderEditor` now selects each row's control from the reminder's **own** stored shape
(`ReminderEditor.tsx:79-110`), not from the `allDay` prop:

| Stored shape | Control | Label | Fire time | Agree? |
| --- | --- | --- | --- | --- |
| `absolute` | read-only timestamp | `toLocaleString()` | `absolute` | ✅ |
| `timeOfDay` | `input[type=time]` | `At HH:mm` | start date @ HH:mm | ✅ |
| `offsetMinutes` | select (own value added) | offset text | start + offset | ✅ |
| triggerless | read-only `Reminder` | `Reminder` | `null` | ✅ |
| `timeOfDay` **and** `offsetMinutes` (mixed, import-only) | time input | `At HH:mm` | start + offset | ❌ row names 09:00, fires 13:30 |
| `absolute` **and** `offsetMinutes` (mixed, import-only) | offset select | timestamp | `absolute` | ❌ select "10 min before" beside a timestamp |

The two failing rows are **not producible by any app path** (editor, `reconcileReminderMode`,
`withSnooze`, v1 migration which seeds `reminders: []`). `validateItem` passes reminders
through unfiltered (`itemValidation.ts:122`), so a hand-crafted JSON import can still store a
mixed shape; `reminderFireTime` (offset/absolute precedence) then disagrees with the editor
and label (timeOfDay/absolute precedence). This is pre-existing, out of the item's ACs, and
reproduced in the browser (see §6 evidence `v-09`). **Recommend a follow-up** to normalise
reminders on read/import (or check `absolute` first in the render and unify precedence).
Note the impl report's claim "can no longer disagree for any stored shape" is therefore too
broad for adversarial imports, though it holds for every shape the app writes.

For all shapes the app produces, the invariant holds. ✅

## 2. All-day toggle reconciliation

- `timeOfDay:'09:00'` on date-only start → timed: `start` seeded to the earliest `timeOfDay`
  (else `09:00`), reminder becomes `offsetMinutes: 0`; fire instant preserved
  (`reminders.test.ts` reconcile block; browser §6).
- `offsetMinutes:-10` @ `09:00` → all-day: becomes `timeOfDay:'08:50'`. ✅
- Cross-day offset (`-600`, `-1440`) is **kept** (not dropped) and renders as its own honest
  option ("Before 10 hours"). ✅ (browser `v-03`)
- `absolute` untouched in both directions (`reconcileReminderMode` returns it as-is). ✅
- Date-only start with no reminder → `09:00`, never midnight (`reconcileReminderMode([],false,
  '2026-07-20') → '2026-07-20T09:00'`). ✅
- Round trip off→on restores `timeOfDay:'09:00'` (unit + browser). ✅

## 3. Scope expansion (`dueAt`/`end`) — **not introduced by this change**

`git show HEAD:src/features/item/ItemEditorSheet.tsx` (lines ~600-611) already contains
`update({ allDay, start: next, dueAt: next, end })` and the `end` shape-matching block. The
diff adds **only** `reminders: reconciled.reminders`. So the implementer did **not** expand
scope; the report's wording ("now updates … dueAt, end") describes pre-existing behaviour.

Confirmed live: clearing **Due** on a new task then toggling All day repopulates it
(`2026-10-18T00:00`), i.e. the toggle *can* add a due where none existed — but this is
pre-existing and unrelated to the reminder fix, not a regression. It is not lossy beyond the
pre-existing all-day semantics (time is stripped when All day is on). `next` now derives from
the reconciled start, so a date-only start with an 08:00 reminder yields `dueAt …T08:00`
(previously `…T09:00`) — consistent with `start`, not lossy. No FAIL on this criterion.

## 4. Non-preset offsets

`offsetOptions()` (`ReminderEditor.tsx:23-35`) unions the presets with the row's own value, so
`-7` and `-600` render a selected option ("Before 7 min" / "Before 10 hours") — never a blank
or mismatched select. Verified in the browser (`v-04`). ✅

## 5. Gates (all run on the unmodified tree)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 76 files · 775 tests |
| `npm run format:check` | PASS |
| `npm run build` | PASS — `dist/sw.js`, precache 28 entries |

## 6. Browser verification

Isolated preview `npm run preview -- --port 4191 --strictPort`; SW + caches reset per
AGENTS.md (unregister + `caches.delete`, then `about:blank` → app for a real document load).
**0 console errors/warnings** at both sizes.

1280×800: new task → Schedule → Add reminder (09:00) → uncheck All day → select `0`/label
"At start"; re-check → time `09:00`/label "At 09:00". Cross-day `-600` and non-preset `-7`
rows, and an `absolute` snooze row (`10/20/2026, 8:30:00 AM`, no select), all honest.
390×844: same add→uncheck→recheck flow; agreement holds, 09:00 preserved.

Evidence: `.improve/artifacts/IMP-143/v-01..v-09*.png` (plus the implementer's `01-03*`).

## 7. Mutation check & state files

- **Render-by-type** mutation (`{allDay ? (` instead of the stored shape) → **3 of 5**
  `ReminderEditor.test.tsx` tests fail (matches the report). Restored.
- **Reconciliation** mutation (make the all-day-off branch a no-op) → **5 tests fail** across
  3 files (`reminders.test.ts` ×3, `ReminderEditor.test.tsx` ×1, `ItemEditorSheet.test.tsx`
  ×1). Restored; diff stat back to +303/−47; targeted suite green again.
- State/backlog: only `.improve/FEATURES.md` changed (IMP-143 status TODO→IN-PROGRESS, plus an
  IMP-142 note correction "Commit pending"→"Commit 8d975f4", which exists in `git log`).
  `STATE.md`, `HANDOFF.md`, `PROGRESS.log`, `CHANGELOG.md` untouched. ✅

---

## Criterion summary

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Control/label/fire agreement per stored shape | Met for all app-produced + legacy shapes; unmet for import-only mixed shapes (pre-existing) |
| 2 | All-day reconciliation honesty | Met |
| 3 | `dueAt`/`end` scope expansion | Met — pre-existing, not introduced; no new loss |
| 4 | Non-preset offsets render honestly | Met |
| 5 | typecheck/lint/test/format/build | Met |
| 6 | Browser 1280/390, agreement, absolute readable, 0 errors | Met |
| 7 | Mutation tests + state files | Met |

**Health delta:** neutral-positive. All gates green (775 tests, +14 new); the toggle bug is
fixed for every reachable shape; the only residual is a documented import-only mixed-shape
contradiction that predates the change.
