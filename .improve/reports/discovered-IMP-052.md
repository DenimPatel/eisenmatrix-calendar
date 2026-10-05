# Discovered findings — IMP-052

Out-of-scope observations from implementing `### IMP-052` (RFC 5545 line folding in
`src/lib/ics.ts`). **Not fixed**; none are regressions from IMP-052.

## 1. `escapeText` does not escape `\r`, which breaks the fold/unfold invariant

`escapeText` (`src/lib/ics.ts:35-41`) escapes `\\`, `;`, `,` and `\n` — but **not
carriage return**. RFC 5545 §3.3.11 requires both CR and LF to be escaped (`\r`
→ `\r` escape sequence, LF → `\n` escape sequence); here LF is handled and CR is not.

Effect on folding: a `title` or `notes` value pasted from a Windows/CRLF source
keeps a raw `\r` (or a raw `\r\n`) inside the property. That is a real line
delimiter in iCalendar, so the emitted stream splits the property in two and a
consumer's unfold step joins them *without* restoring the original bytes — the
IMP-052 AC2 invariant ("unfolding reconstructs the original property value
byte-for-byte") therefore does not hold for such content, even though folding
itself is correct.

```
title = 'A\rB'  ->  SUMMARY:A<BEL-less raw CR>B  (the CR survives into the stream and
                     is read back as a line delimiter, so unfold does not restore it)
```

Measured directly (`itemsToICS([createItem({kind:'event', title:'A\rB', …})])`):
the export contains the literal line `SUMMARY:A\rB` and the CR is not escaped.
IMP-052's acceptance criteria and verification recipe only cover the folding
step (200-character title), so this was left alone; the one-line fix is to escape
`\r` (ideally `/\r\n|\r|\n/g` → `'\\n'`, normalising CRLF to the single `n`
escape). Pre-existing and independent of folding: an importer already breaks on
this today, folded or not.

## 2. The export does not end with CRLF

`itemsToICS` returns `…\r\nEND:VCALENDAR` with **no trailing CRLF** (verified:
`ics.endsWith('\r\n') === false`). RFC 5545
§3.1: "the iCalendar object is terminated by a final CRLF". Strict importers
(and `icalendar`'s validator) can reject a truncated last line. One-character
fix (`… + '\r\n'`) but it changes the byte length of every export and is not
implied by any IMP-052 criterion, so it was not made here.

## 3. A folded continuation can begin with a space that is *not* a fold marker

Not a defect today, but a hazard for any future consumer: because RFC 5545
encoding cannot distinguish "continuation of value" from "value that starts with
a space", a `SUMMARY`/`DESCRIPTION`/`LOCATION` whose value begins with a space
must itself be emitted space-prefixed (or the escape set extended) to stay
unambiguous. `escapeText` has no such rule today, so folding a value that starts
with a space produces output where an importer that trims the continuation space
loses a leading character. The in-app exporter is unaffected (there is no
importer), but a round-trip test added later would hit this.

## 4. Only `SUMMARY`/`DESCRIPTION`/`LOCATION` can ever exceed 75 octets

Reassurance, not a bug: every other emitted line is a fixed-width literal
(`VERSION`, `PRODID`, `CALSCALE`, `METHOD`, `UID` + 36-char UUID + `@eisenmatrix`,
`DTSTAMP`, `DTSTART`, `DTEND`, `RRULE`, `TRIGGER`, `BEGIN`/`END`, `ACTION`). The
longest generated line is `UID:<uuid>@eisenmatrix` at 52 octets (measured over a
single-event export), so folding is only ever exercised by user-authored values
plus the alarm `DESCRIPTION` — i.e. the risk surface is exactly the three text
properties plus VALARM, which is why the new tests target `SUMMARY` and
`DESCRIPTION`.

## 5. Cross-references to findings already logged elsewhere

- `discovered-IMP-014.md` §1 (timed `UNTIL` tagged `Z` against a floating
  `DTSTART`), §2 (multi-day all-day events collapse to one day — still true; no
  `DTEND;VALUE=DATE` is emitted; backlogged as `FEATURES.md` **IMP-075**, whose
  note asks that it be done in the same pass as this item) and §4
  (`recurrenceToRRule`'s defaulted flag) remain open and untouched. IMP-052 is
  the item backlogged from §3.