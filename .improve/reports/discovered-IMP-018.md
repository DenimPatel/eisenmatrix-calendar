# Discovered findings — IMP-018 (quick-add habit recurrence)

Observed while implementing IMP-018. None were fixed; IMP-018 was limited to
`quickAddToItem` per its spec. All are behaviour changes in product code, so each needs its
own scoped item.

## 1. The quick-add preview does not show the habit default (cosmetic inconsistency)

`QuickAdd.tsx` builds its chips from `parsed.chips`, which `parseQuickAdd` fills **before**
`quickAddToItem` applies the new daily default. The dialog copy says *"Chips show what will be
created — edit before committing"*, so a `habit: meditate` preview lists only
`habit` / `2026-10-05` while the committed item is daily (the card then renders a "Daily"
badge, so the discrepancy is visible after the fact).

Not a one-line fix: the default cannot simply move into `parseQuickAdd`, because
`QuickAdd.tsx:49-52` replaces `item.kind`/`item.data` when the user changes Kind in the
dialog but keeps `item.recurrence` — a parse-time default would attach "Daily" to a Task.
A correct fix either threads `effectiveKind` into the chip builder or strips a defaulted
recurrence when the kind changes.

Repro: Today → Quick add → `habit: meditate` → chips show no recurrence; Add → the agenda
card shows a "Daily" badge.

## 2. Habits created outside quick-add still have no recurrence (same defect class)

IMP-018 only fixes the quick-add path. Every other habit-creation path still produces
`recurrence: null`:

- `HabitsView.tsx:75` and `:90` — **New habit** → `createItem({ kind: 'habit', start: today })`,
  and `createItem` hardcodes `recurrence: null` (`itemFactory.ts:60`).
- The item editor's habit fields set `target`/`streak` only.
- The seeded demo habit `Drink water` is stored with `recurrence: null` and therefore exists
  on Oct 4 only — the same "streaks and done-today are wrong" symptom IMP-018 describes.

If the intent is "habits are daily by default", the default arguably belongs in
`defaultDataFor('habit')`'s caller or in `createItem`; if the intent is narrower, a
follow-up item should cover the editor and New habit. Verified: the seeded `Drink water`
appears on Oct 4 only in the calendar month view.

## 3. No back-fill for habits already stored without a rule

The default applies at creation time only. A habit created before this change keeps its
single occurrence forever, with no prompt and no migration. Whether that matters depends on
how many real users exist (the app is local-first, single-user), but a one-time
"habit with no recurrence → daily" repair in Settings → Data (or a versioned Dexie
migration) would be the place if it does. Not attempted: the spec scoped the change to
`quickAddToItem` and the blast radius of rewriting stored series is high.

## 4. A daily habit now occupies two places on the Today screen (side effect)

`TodayView.tsx` filters habits out of **Overdue** (`:57-59`) but not out of **Today's
agenda** (`:162` maps every occurrence in `todays` to an `ItemCard`). Before this change a
quick-added habit only had today's occurrence; now it is a daily series, so Today renders
it twice — once as an agenda card and once in the Habits panel directly below — and the
Calendar shows it on every day of the visible month.

This is pre-existing behaviour for any *explicitly* recurring habit (e.g. the seeded
`Weekly review all-day`), so it is not a regression introduced by IMP-018; IMP-018 just
makes every quick-added habit hit it. Worth deciding whether the Today agenda should skip
`kind === 'habit'` the way Overdue already does.

Repro: quick-add `habit: journal` → Today shows "Journal Daily" in the agenda **and**
"Journal / 0 day streak" in the Habits panel; the Calendar lists it on Oct 5–Nov 1.

## 5. Verification hazard: the service worker serves the previous bundle

While verifying in the browser, the first quick-add used the **stale precached bundle** and
produced a habit with `recurrence: null` even though `dist/` had been rebuilt — the symptom
of the change being "absent" rather than broken. `navigator.serviceWorker.getRegistrations()`
→ `unregister()` plus `caches.delete('workbox-precache-v2-…')` and a reload is required
before trusting a preview/verification run. Noted again in
`.improve/reports/impl-IMP-018.md` §4 and in `impl-IMP-016.md` §4.
