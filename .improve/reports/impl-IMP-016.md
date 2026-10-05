# IMP-016 — Implementation report (retry 2)

**Status:** implemented; all four gates pass; not marked DONE in FEATURES.md; not committed.

Retry 2 addresses the three issues from `.improve/reports/verify-IMP-016.md` (§6.1 HIGH,
§6.2 MED-HIGH, §6.3 MED) and the §6.6 coverage gap. The attempt-1 behaviour described in
the previous version of this file is preserved except where noted below.

## 1. HIGH — one source of truth for occurrence status

The override no longer carries `status`. `item.occurrences[occKey]` is the only place a
single occurrence's status lives, and it is now read by every consumer:

| File | Change |
| --- | --- |
| `src/domain/recurrence.ts` | `resolveStatus` → exported `resolveOccurrenceStatus(item, occKey)`. It returns `item.occurrences[occKey]` when present, so an override can never shadow it. `isOverride` is redefined as "this occurrence carries any override" (it used to mean "has an override *status*"). |
| `src/domain/itemActions.ts` | `setStatus(item, status, occKey)` writes `occurrences` (with `completedAt`) and, in the same patch, erases a legacy `overrides[key].status`. `toggleDone` decides from `resolveOccurrenceStatus(...)`, not from `item.occurrences[...] === 'done'`, so the checkbox and the resolved status agree in both directions. |
| `src/domain/itemActions.ts` (`updateRecurring`, occurrence branch) | `patch.status` is written to `occurrences`, never to the override. An override left with no fields is not stored at all. |
| `src/domain/itemActions.ts` (`updateOccurrence`, drag) | `status` removed from the patch type — the drag path can no longer create a second copy. |
| `src/features/item/ItemCard.tsx` | The checkbox uses `resolveOccurrenceStatus(item, occurrenceKey).status` instead of reading `item.occurrences` directly, so a card agrees with the calendar/stats rendering. |

**Legacy data (rows written by attempt 1).** `resolveOccurrenceStatus` still reads
`overrides[key].status` when the occurrence has *no* state of its own, so nothing already
stored is lost or silently reset. The first status write for that occurrence persists the
state and deletes the legacy override status, permanently converging the two. This is a
one-way migration on write, not a second source of truth.

Verified in the browser: an occurrence-scoped `Status = Done` save produced
`occurrences {2026-10-04: {status:'done'}}` with `overrides {}`; the card checkbox became
ticked (agenda 1/5 → 2/5) and clicking it again un-ticked it (2/5 → 1/5).

## 2. MED-HIGH — occurrence ranges are always ordered and shape-coherent

`occurrenceEnd` (`src/domain/recurrence.ts`) was rebuilt around the *resolved* start and
all-day flag instead of `item.allDay` and the canonical series day:

- `deriveOccurrenceEnd(item, startStr, allDay)` — all-day (or a date-only start) ends on
  the resolved start's own day; a timed occurrence ends at `start + seriesDuration`, or at
  `start` when the series has no positive duration.
- An explicit `override.end` is used only when it actually follows the resolved start
  (`endFollowsStart`, which also rejects a bare date ending a timed occurrence); otherwise
  the derived value wins.
- `buildOccurrence` resolves `allDay` before `end` and passes it in, so an all-day occurrence
  switched to timed no longer inherits the series' bare date as its end.

The report's two repros now resolve to:

| Case | Before | After |
| --- | --- | --- |
| all-day series, `override.start = 2026-07-15` | `{start:'2026-07-15', end:'2026-07-13'}` | `{start:'2026-07-15', end:'2026-07-15'}` |
| all-day series, All day unchecked | `{start:'…T09:00', end:'2026-07-13'}` | `{start:'…T09:00', end: null}` (series has no end) or `…T09:00` (zero-length, still ordered) |

`src/features/item/ItemEditorSheet.tsx`: the "All day" checkbox now also normalises `end`
into the same shape as `start` (bare date ↔ `THH:mm`, reusing the start time), and the Due
input always renders a `datetime-local`-conformant value. The latter was needed because
`dueAt` is series-only and therefore frozen while `allDay` flips — without it the input
received a bare date and Chrome logged a format warning.

## 3. MED — the UI no longer accepts input it will drop

Under scope **This occurrence** the fields a single occurrence cannot own are disabled and
labelled instead of silently discarded:

- `urgency`, `importance`, `tags`, `listId`, `checklist`, kind-specific `data`
  (`KindFields`), `dueAt`, the recurrence rule and `reminders` render `disabled` (a
  `<fieldset disabled>` wrapper for the grouped editors, `disabled` on the `Field` selects),
  each labelled **"Applies to the whole series"**; the scope banner states which fields stay
  editable.
- `update()`/`updateData()` additionally drop those keys from a draft patch in this scope, so
  no code path can write a series field for one occurrence even if a control is re-enabled.
- Title, notes, status, start, end and the all-day flag stay editable. Subtasks/milestones
  stay editable — they are separate items, not fields of the series.
- `updateRecurring` now returns whether it wrote, and the toast says
  **"Nothing to update for this occurrence"** when the save changed nothing (verify §6.5).
- Two pre-existing silent drops in the same family were closed: `seriesPatch` now also
  carries `dueAt`, `listId` and `checklist`, so "All occurrences"/"This and future" no longer
  ignore those edits either.

Note on recurrence rules: attempt 1 wrote `draft.recurrence` for an occurrence save. The
branch now re-reads the persisted row (`itemRepo.get(item.id)`) and uses *its* rule, so a
rule edit in the draft cannot reach storage through an occurrence-scoped save even if the
locked editor is bypassed.

## Tests

`npm run test`: 26 files, **218** passing (was 201; +17).

`src/domain/recurrence.test.ts` (+7, one existing case re-based on the new source of truth):
occurrence-state precedence over a stale override status; legacy override status honoured
only while the occurrence has no state; a recurring occurrence with no state resolves to
`todo` rather than the series status; `isOverride`; moved all-day occurrence keeps a
one-day range; all-day → timed keeps the range ordered and leaves siblings alone; an
override `end` before the start is discarded; an 8-occurrence sweep asserts
`end >= start` everywhere.

`src/domain/itemActions.test.ts` (+8): occurrence status lands in `occurrences` and nowhere
else; doing → tick → un-tick agreement across `updateRecurring` + `toggleDone`; a legacy
override status is erased (and its override entry trimmed) on the first status write; a draft
recurrence rule is ignored for an occurrence save; `updateRecurring` reports whether it
wrote; plus resolved-range tests for a moved all-day occurrence and for All day → timed
(`updateRecurring (scope: occurrence) resolved ranges`).

`src/features/item/ItemEditorSheet.test.tsx` (+3, driving the real sheet): the series-only
controls are disabled for an occurrence scope, a forced change still cannot reach the series,
and a no-op save writes nothing and toasts "Nothing to update…"; an occurrence-scoped status
save stores `occurrences[key]` with `overrides` untouched; unchecking All day resolves to an
ordered, timed occurrence while the rest of the series stays all-day.

### Mutation checks (each reverted)

| Mutation | Caught by |
| --- | --- |
| `resolveOccurrenceStatus` reads `override.status` before `occurrences` | 2 recurrence tests |
| put `status` back on the override in `updateRecurring` | 3 tests (2 domain + 1 editor) |
| `deriveOccurrenceEnd` keyed off `item.allDay` + the series day again | 10 tests (domain + editor) |
| `occurrenceScoped` forced to `false` in the editor | the disabled-fields editor test |

## Gates

`npm run typecheck` clean · `npm run lint` clean (0 errors, 0 warnings) · `npm run test`
26 files / 218 tests · `npm run build` OK (`dist/sw.js`, 18 precache entries, 607.31 KiB).

## Browser verification (Playwright, `npm run preview` on :4173)

1. Quick-added `IMP016 probe every day at 9am`, opened occurrence `2026-10-04` (scope "This
   occurrence" preselected). Confirmed: Urgency/Importance/List/Tags/Checklist/estimate/energy
   disabled with "Applies to the whole series", recurrence + reminders inside a disabled
   fieldset, Status/Title/Notes/Start/End/All day editable, banner note present.
2. Status → Done, Save: toast "Occurrence updated", agenda 1/5 → 2/5, card checkbox ticked.
   Clicking the checkbox un-ticked it (2/5 → 1/5). Stored row: `overrides {}`,
   `occurrences {"2026-10-04":{status:"todo",completedAt:null}}`, base `status/start/urgency`
   untouched.
3. Seeded all-day series "Weekly review all-day": occurrence `2026-10-04` → Schedule → All
   day off → Save. Stored `overrides {"2026-10-04":{start:"2026-10-04T09:00",allDay:false}}`,
   base still `start 2026-10-04 / allDay true / end null`; the agenda showed `09:00` for
   that day only. A repeat save with no change toasted "Nothing to update for this
   occurrence" and wrote nothing.
4. Console: **0 messages from the current bundle.** (Two `datetime-local` format warnings
   appeared on an earlier build and led to the Due-input fix; the service worker had to be
   unregistered to see the new bundle.)

Cleanup: the probe item was deleted and the "Weekly review all-day" override cleared from the
browser's IndexedDB; the demo seed data is otherwise untouched.

## Out of scope (unchanged, still open)

Verify §6.4 — `title`/`notes` overrides are stored but still not rendered (`ItemCard` shows
`item.title`); §6.7's stray `.improve/PROGRESS.log` line and the untracked `.kilo/` directory
are still there. See `.improve/reports/discovered-IMP-016.md`.