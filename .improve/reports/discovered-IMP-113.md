# discovered-IMP-113 — unrelated problems noticed while fixing IMP-112/113

Not in scope for IMP-112/113; reported only.

## D1 — a count-0 tail exports as an unbounded RRULE

`recurrenceToRRule` gates `COUNT` on `if (rule.count)`, so `count: 0` is falsy and no
`COUNT` is emitted. `splitSeries` sets the tail's count to `0` when the head consumed the
whole count (an empty tail, `recurrence.test.ts` "produces no tail occurrences once the
head has consumed the whole count"). Exported, that tail has no `COUNT` and no `UNTIL`
(`until: rule.until ?? null`), so an importer reads it as an unbounded series from the
split day — the opposite of the empty tail the engine stores. RFC 5545 also requires
`COUNT` to be a positive integer, so the honest export is no RRULE at all. Not part of
IMP-112's acceptance criteria (which only require at most one of COUNT/UNTIL).

## D2 — a tail whose binding bound is COUNT can over-expand on export

If a stored rule carries both `count` and `until` and the count is the binding constraint
(e.g. `{freq:'daily', count:3, until:'2026-01-31'}` split at `2026-01-02`), the tail is
`{count:2, until:'2026-01-31'}`; the IMP-112 fix emits `UNTIL` alone, which expands to
every day through Jan 31 rather than the two remaining occurrences. The editor keeps
`count`/`until` mutually exclusive (`RecurrenceEditor.tsx:133-135`), so only imported rows
can reach this shape; `recurrenceToRRule` cannot resolve it without the series start.
IMP-112's acceptance ("a split head's count/until combination") targets the head, which
the fix handles correctly.
- recurrenceToRRule prefers UNTIL: {count:3,until:..} over-expands (import only); count:0 tail exports unbounded
