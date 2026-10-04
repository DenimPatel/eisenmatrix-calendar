# Discovered findings — IMP-011

Observed while implementing IMP-011 (`on the <N>` in quick add). **Not fixed** — out of scope for
that item. Reproduction is `parseQuickAdd(input, new Date('2024-06-10T12:00:00'))`.

## 1. A monthly rule with `byMonthDay` still anchors `start` on today

```
'pay rent every month on the 5th' -> start 2024-06-10, recurrence { monthly, byMonthDay: [5] }
```

IMP-011's criterion 1 is scoped to "no recurrence is present", so the monthly path is untouched. The
consequence is that the anchor (`start`) disagrees with the first occurrence: expansion skips the
month-day candidates before the anchor, so the first occurrence is 2024-07-05 while the card, the
`dueAt` chip and the ICS `DTSTART` all say 2024-06-10. Same class as the `every week fri` anchor
mismatch in `discovered-IMP-010.md` §2 — one item should cover both if anchor semantics are
addressed (and that means touching `expandOccurrences`, REPO_PROFILE §6).

## 2. An unappliable day is now visible in the title instead of being dropped

```
'party on the 0th'  -> title 'Party on the 0th', start 2024-06-10
'party on the 45th' -> title 'Party on the 45th', start 2024-06-10
```

`\bon the (\d{1,2})` accepts 0-99. IMP-011 deliberately keeps the token when it cannot be applied
(criterion 3), so an impossible day now leaks into the title instead of vanishing — a regression in
appearance, not in data. Suggested hardening in a later item: restrict the pattern to 1-31 (`0?[1-9]|
[12]\d|3[01]`) or validate before deciding not to consume.

## 3. A month day alongside a lone weekday is ignored and left in the title

```
'party on fri the 5th' -> title 'Party on the 5th', start 2024-06-14 (Friday)
```

`loneWeekday` (IMP-010) wins in the date fallback, so the month day is never applied and — correctly,
per criterion 3 — stays in the title. The input is ambiguous enough that no automatic resolution is
obviously right; mentioning it only so the title residue is not mistaken for a new regression.
