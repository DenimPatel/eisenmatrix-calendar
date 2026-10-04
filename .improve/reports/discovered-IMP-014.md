# Discovered findings — IMP-014

Out-of-scope observations from implementing `### IMP-014` (`UNTIL` value type in
`src/lib/ics.ts`). **Not fixed**; none are regressions from IMP-014.

## 1. Timed `UNTIL` is still a local wall-clock value tagged `Z` (needs a spec decision)

IMP-014 AC2 requires timed `UNTIL` to "remain a UTC date-time", so that was preserved
verbatim. It is nevertheless inconsistent with the `DTSTART` this module emits:

```
DTSTART:20240506T090000          <- floating (local, no TZID, no Z)
RRULE:...;UNTIL=20240630T235959Z <- tagged UTC
```

RFC 5545 §3.3.10: *"If the 'DTSTART' property is specified as a date with UTC time or a
date with local time and time zone reference, then the 'UNTIL' rule part MUST be
specified as a date with UTC time."* A **floating** `DTSTART` is neither, so `UNTIL`
should be floating too — `UNTIL=20240630T235959`, no `Z`. Right now the `Z` claims a
UTC instant that was never computed from one (`dateOnly(until)` reads local
`getFullYear`/`getMonth`/`getDate`).

Effect: an importer in a negative-UTC-offset zone reading the `Z` form can resolve the
bound to the previous day and drop the final occurrence — the same class of off-by-one
the backlog's own intent paragraph describes, one clause down. Out of scope because
fixing it contradicts AC2 as written; needs the backlog owner to decide whether to
amend AC2 to "for timed events, `UNTIL` remains a floating date-time".

## 2. Multi-day all-day events collapse to a single day on export

`itemsToICS` emits `DTSTART;VALUE=DATE:` for all-day items and only emits `DTEND` on the
timed branch (`:102-108`). RFC 5545 gives a `DATE` `DTSTART` an implicit duration of one
day, so an item with `start: '2024-05-06', end: '2024-05-09'` exports as a **single
2024-05-06** event — the extra days are silently dropped. Suggest emitting
`DTEND;VALUE=DATE:` with `end + 1 day` (exclusive end) whenever the all-day span exceeds
one day. This is a separate interoperability fix, not a `UNTIL` bug.

## 3. Content lines are never folded (75-octet limit)

`lines.join('\r\n')` with no folding means a long `SUMMARY`/`DESCRIPTION`/`LOCATION` can
exceed the 75-octet line limit in RFC 5545 §3.1. The escape logic in `escapeText` handles
backslash/semicolon/comma/newline but not octet counting. Most consumers tolerate long
lines, so this is low severity; a `foldLine()` helper would close it.

## 4. `recurrenceToRRule`'s new flag defaults to the timed form

`dateOnlyStart = false` keeps the signature backward compatible for the existing
single-argument test, but any future caller that forgets it silently emits `T235959Z` for
a date-only series — the exact bug IMP-014 fixes. `recurrenceToRRule` is exported (only
consumed by `itemsToICS` and the test today), so consider making the parameter required,
or exporting it from a module boundary only tests reach.