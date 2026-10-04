# Discovered findings — IMP-010

Observed while implementing IMP-010 (lone weekday in quick add). **Not fixed** — out of scope for
that item. Reproduction is `parseQuickAdd(input, new Date('2024-06-10T12:00:00'))` (a Monday).

## 1. A bare `every` is never consumed and leaks into the title

```
'gym every fri'  -> title 'Gym every', start 2024-06-10, recurrence { weekly, byWeekday: [5] }
```

The recurrence lexer only recognises `every <number>? <unit>` (`every 2 days`), `every day`,
`every week`, `every month`, `every year` and the adjectives `daily`/`weekly`/`monthly`/`yearly`/
`annually` (`src/domain/quickadd.ts:157-184`). A bare `every` before a weekday therefore survives
every branch and lands in the title. Pre-existing, but IMP-010 makes it more visible because
`every` + a lone weekday is now the documented way to say "repeats on Friday". Suggested fix: strip
a leftover `\bevery\b` once a weekday recurrence has been established (or accept
`every <weekday>` as a first-class recurrence phrase). The known "quick-add leaves a trailing
preposition" defect in REPO_PROFILE §7 is the same class of problem.

## 2. `every` + a lone weekday leaves the series anchor on today, not on that weekday

```
'gym every week fri 7am' -> start 2024-06-10T07:00 (Monday), byWeekday [5]
```

The anchor is `now` (or the relative offset) even though the first occurrence is Friday. For a
weekly rule with `byWeekday`, the anchor is only used to seed the expansion window, so the first
occurrence usually lands on the right day — but any code that reads `item.start` as "the first
occurrence" (card subtitles, ICS export, `dueAt`) sees the wrong day. Fixing this means changing
anchor semantics inside `expandOccurrences`/`quickAddToItem`, i.e. the high-risk recurrence area
(REPO_PROFILE §6). Recommend a separate backlog item: snap the anchor to the first
`byWeekday` >= today when a weekday rule is created.

## 3. Only the leftmost weekday group is consumed, and single tokens are now consumed eagerly

`weekdayListRe.exec(working)` runs once, so a second weekday token survives in the title:

```
'sun the tomatoes fri' -> title 'The tomatoes fri', start 2024-06-16 (Sunday)
```

Two issues in one line. (a) Pre-existing: the single `exec` means at most one weekday group is
removed. (b) New consequence of IMP-010: `sun` used as a verb is now treated as a date, so the item
is scheduled for Sunday and the word disappears from the title. Before IMP-010 this input kept
`sun` in the title and defaulted to today — still wrong, but less silently destructive.

Suggested hardening (optional, low value for the current UX): require the lone weekday token to
look like a schedule hint — e.g. be at the end of the input, or be preceded by `on|every|at|start`,
or require the title part to be non-empty and the token to be the last one. The QuickAdd placeholder
should also advertise the accepted forms so users type `fri` as a trailing token.
