# Discovered while implementing IMP-016

Out-of-scope observations from the IMP-016 pass. Items 1 and 2 are consequences of the fix that
need a follow-up; 3–6 are pre-existing. Nothing here was fixed, and none of 3–6 is a regression.

## 1. An occurrence-level `title` / `notes` override is persisted but never rendered

IMP-016 makes "This occurrence" title/notes edits *correct* (they land in
`recurrence.overrides[occKey]` instead of the base item) — but nothing displays them.
`ItemCard.tsx:108` renders `item.title`, and `Occurrence` (`src/types/item.ts:136-149`) has no
resolved title/notes field, so the engine never surfaces `override.title`. Verified in the
browser: after retitling occurrence `2026-10-04` to "Occurrence probe (today only)", every card
on every day still reads `Occurrence probe`. Before IMP-016 the edit was visible *everywhere*
(that was the leak); now it is visible nowhere. `notes` is not rendered on cards at all today, so
only `title` is user-visible.

Two clean fixes, both outside this item's scope:

- resolve it in the engine — add `title: string` to `Occurrence`, set
  `override?.title ?? item.title` in `buildOccurrence` (`recurrence.ts:180-199`), and render
  `occ.title` in the three call sites (`TodayView.tsx:163`, `MatrixView.tsx:83`,
  `CalendarView.tsx:266`); or
- read it in the card, the way line 48 already reads the occurrence status:
  `item.recurrence?.overrides[occurrenceKey ?? '']?.title ?? item.title`. One line, no type
  change, but it puts recurrence knowledge in the presentational component.

## 2. `overrides[key].status` now shadows the checkbox for that occurrence

`resolveStatus` (`recurrence.ts:163-170`) checks `override?.status` *before*
`item.occurrences[occKey]`. Criterion 2 requires an occurrence-scoped status edit to write the
override, and `setStatus` (`itemActions.ts:151-178`) only ever writes `occurrences[occKey]`. So:
mark an occurrence done in the editor (writes `overrides[key].status = 'done'`), then click the
card's circle to un-done it — `setStatus` writes `occurrences[key] = 'todo'`, the override wins,
and the occurrence stays done with no visible feedback.

Before IMP-016 the same edit wrote the base `status`, which the engine ignores for a recurring
occurrence without an override, so toggling kept working. Options: have `setStatus` clear
`overrides[occKey].status` for the occurrence it toggles, or make `resolveStatus` prefer an
explicit `occurrences` entry over the override. Both touch files outside IMP-016's area list.

## 3. The editor shows series values, not the occurrence's, for any non-first occurrence

`ItemEditorSheet` seeds the draft from `editor.item` (`:79`), so opening occurrence
`2026-10-08` of a series anchored at `2026-10-04` shows Start `2026-10-04 09:00` — not that
occurrence's `2026-10-08 09:00`, and not a drag-moved `16:30`. IMP-016 makes this *safe* (an
unmodified field is never sent, so a moved `overrides[key].start` survives — covered by
`keeps an existing override when a later edit changes another field`), but it is misleading: the
first thing a user does for a moved occurrence is retype the correct date. Seeding the draft's
occurrence fields from the resolved occurrence (`expandOccurrences` + `override`) would fix the
display; it must not then feed those seeded values into the "All occurrences" patch, which would
re-anchor the series to the occurrence's date.

## 4. An occurrence-scoped status write records no `completedAt`

`OccurrenceOverride` has no `completedAt`, and `resolveStatus` falls back to
`occurrences[key].completedAt ?? null`. So an occurrence marked done in the editor shows as done
(and `habitStreak`, which reads expanded statuses, counts it) but carries no completion
timestamp in the JSON backup. `setStatus` is the action that sets `completedAt`; the editor's
Status select bypasses it.

## 5. A no-op occurrence save still toasts "Occurrence updated"

`updateRecurring` now returns early when the merged override is unchanged
(`itemActions.ts:264`), while `handleSave` pushes its toast unconditionally
(`ItemEditorSheet.tsx:125-128`). Confirmed in the browser: Save with no edits wrote nothing but still
showed "Occurrence updated". Cosmetic; `updateRecurring` could return a boolean, or `handleSave`
could compare before/after itself.

## 6. Pre-existing: "This and future" leaves the tail anchored at the series start

`updateRecurring` scope `future` (`itemActions.ts:270-287`) writes `head` (with
`recurrence.until = occKey - 1`) and a new `tail`, but the tail keeps the original
`start`/`dueAt`, so it re-expands from the series start. Browser check on the daily 09:00 probe
split at `2026-10-20`: `2026-10-04` went from "+2 more" to "+3 more", and `2026-10-07` rendered
the tail's card plus "+1 more" — i.e. **two** occurrences on every day from the series start to
`2026-10-19`. The tail also inherits `overrides`, so the pre-split occurrence overrides are
duplicated into it. This path also pushes no undo entry (the known "this and future loses undo"
defect in REPO_PROFILE) and toasts "Series split" twice `itemActions.ts:286` plus
`handleSave`). Not touched by IMP-016: the `future` patch is byte-identical to the previous
inline literal, and the new editor test pins that scope's behaviour.

## 7. Not re-checked

Dark theme and the 390 px layout. The change adds no class, no colour and no DOM node, and the
scope banner/footer are untouched.
