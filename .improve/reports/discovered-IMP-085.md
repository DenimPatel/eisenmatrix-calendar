# IMP-085 — Discovered problems (unrelated / out of scope)

These were noticed while implementing IMP-085 and are **not** fixed here.

## 1. Reminder notifications still use the series title

`src/pwa/ReminderRuntime.tsx:69` builds the notification title from
`scheduled.item.title`, so an occurrence retitled via "This occurrence" still notifies with
the series title even though the card and calendar now show the override. The reminder
window (`expandOccurrences` in `src/domain/reminders.ts`) already produces an `Occurrence`,
so `occ.title` is available; using it would be the consistent follow-up. Out of scope for
IMP-085 (the spec scopes the visible fix to cards and does not mention notifications).

## 2. Spec's "three ItemCard call sites pass occurrenceKey" is inaccurate

Only Today (`TodayView.tsx:165`) and Calendar's `AgendaList` (`CalendarView.tsx:279`) pass
`occurrenceKey`; `MatrixView` renders items, not occurrences. The Calendar month/week grid,
the Calendar year view and Today's Overdue / Bills / "What's next" lines are separate render
paths. This is a spec/premise inaccuracy rather than a repo defect, and IMP-085 handles those
paths explicitly. Flagging it so a future item author does not rely on the same assumption.

## Verifier findings (follow-ups)
- ReminderRuntime.tsx:69 notification uses series title not occurrence title (S2)
- BillsView.tsx:145 upcoming row uses bill.title
- AppShell.tsx:227 drag overlay ignores occurrenceKey
- Empty/whitespace override title: `??` keeps '' so raw occ.title renders blank
