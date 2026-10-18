# discover3-quality — Quality + correctness audit (read-only discovery)

Scope: `src/domain` (recurrence, reminders, stats, quickadd, eisenhower, itemActions),
`src/lib` (ics, csv, backup, date), `src/db`, `src/pwa`.
Method: read all target modules, then confirmed each candidate with a throwaway Vitest repro
(fake-indexeddb where storage was involved); all repro files were deleted afterwards.
Baseline gates were green before/after: `npm run typecheck`, `npm run lint`, `npm run test`
(46 files / 508 tests).

Dedupe: checked `### IMP` titles in `FEATURES.md` (93 items, incl. DONE 085/086/090/092/093/094/096/097/082/084/043)
and the unprocessed follow-ups in `discovered-IMP-{085,086,092,093,096,036,037,038,082,084,090,043}.md`
(094/097 had no file). Items 4 and 8 below **promote** unprocessed follow-ups
(`discovered-IMP-037` #3 and `discovered-IMP-092` D1). IMP-040/041/042 are already TODO and were
not re-proposed. Findings the backlog already triaged "below the cut" (reminder-editor display,
`until`/`count` engine semantics, `timestampedName`, `lists` unvalidated on import, dead-code
removal) were not re-proposed.

---

## 1. A reminder whose fire time lands on an earlier calendar day is delivered at the start of the occurrence's day

- **Dimension:** Bugs/Correctness
- **Type:** bug-fix
- **Severity:** S2
- **Files/lines:** `src/domain/reminders.ts:48-68` (`upcomingReminders`, esp. `:56` `expandOccurrences(item, from, to)` and `:61`), `src/pwa/ReminderRuntime.tsx:101-105`
- **Evidence:** `upcomingReminders` expands occurrences **only inside the fire-time window** `[from,to]`, so a fire time that precedes the window's first day is never computed. The delivery tick passes `[now-24h, now+30s]` and `expandOccurrences` floors that to whole days (`fromDay = startOfDay(from)`), so an occurrence is only visible from midnight of its own day.
  Repro (throwaway test, `LOOKBACK_MS` from `src/pwa/delivery.ts`):
  - timed task `2026-01-05T09:00`, reminder `offsetMinutes: -1440` (the "1 day before" preset, `ReminderEditor.tsx:17`): `fireAt = Jan 4 09:00`; `upcomingReminders(items, Jan 3 09:00, Jan 4 09:00:30)` → **`[]`**; the same reminder first appears in `upcomingReminders(items, Jan 4 00:00, Jan 5 00:00:30)` → 1 hit, i.e. delivered at **Jan 5 00:00** (~15 h late).
  - timed task `2026-01-05T09:00`, reminder `offsetMinutes: -600`: `fireAt = Jan 4 23:00`; window at Jan 4 23:00 → `[]`; first hit at Jan 5 00:00 → **1 h late**.
  - control: `offsetMinutes: -10` (same-day fire) fires exactly at `Jan 5 08:50`; `timeOfDay` on an all-day item fires at `Jan 5 09:00`.
  Any negative offset that crosses midnight is affected (e.g. "3 hours before" on an early-morning event).
- **Acceptance criteria:**
  1. A reminder's fire time is evaluated for every occurrence whose fire time falls in `[from,to]`, including fire times on days before the occurrence day.
  2. Repro above: the `-1440` reminder is returned by the window whose `to` is the fire time (`Jan 4 09:00:30`) and is not first returned at `Jan 5 00:00`.
  3. Same-day offsets and `timeOfDay` reminders keep their current timing; the returned list stays sorted by `fireAt`.
- **Effort:** S
- **Impact:** 3 · **Reach:** 3 · **Confidence:** 5

---

## 2. Recurrence rules from imports are never validated: they can throw, silently expand to nothing, or fall through to yearly

- **Dimension:** Bugs/Correctness
- **Type:** bug-fix
- **Severity:** S2
- **Files/lines:** `src/domain/itemFactory.ts:114-116` (`normalizeRecurrence` is a bare passthrough), `src/lib/itemValidation.ts:46-58` (`coerceItemShape` ignores `recurrence`), `src/domain/recurrence.ts:42-43,57-68,96-119,195,267`
- **Evidence:** `csvToItems` (`src/lib/csv.ts:168`) and `parseBackup` (`src/lib/backup.ts:76`) accept any JSON object as a rule, and `normalizeItem` copies it verbatim. Three verified consequences (throwaway test):
  1. rule without `exceptions` → `expandOccurrences` **throws** `TypeError` at `recurrence.ts:267` (`rule.exceptions.includes`) — every card/calendar render of that row crashes. Same class at `:195` (`item.recurrence?.overrides[occKey]`) for a rule without `overrides`.
  2. weekly rule with `byWeekday` but no `weekStartsOn` → `offset = (wd - undefined + 7) % 7 = NaN` at `:66`, so no candidate is ever emitted; the generator runs to `MAX_ITERATIONS = 200_000` and returns `[]` (**99 ms** per call, per render) — a silent empty series plus a CPU sink.
  3. `freq: 'hourly'` (or any unknown value) skips the daily/weekly/monthly branches and is expanded by the **yearly** fallback at `:96-119` → one occurrence a year instead of an error.
  Also `Math.max(1, rule.interval)` with a missing `interval` yields `INTERVAL=NaN` in ICS.
- **Acceptance criteria:**
  1. A rule crossing the import/normalize seam is coerced to a complete `RecurrenceRule` (`freq` ∈ the 4 known values, numeric `interval ≥ 1`, `weekStartsOn ∈ {0,1}`, `exceptions: []`, `overrides: {}`), or the row is rejected/flagged like an invalid item.
  2. `expandOccurrences` does not throw for a rule lacking `exceptions`/`overrides`.
  3. A weekly rule without `weekStartsOn` expands using the default (Monday) instead of returning `[]` and burning the iteration guard.
  4. An unknown `freq` never silently expands as yearly.
- **Effort:** M
- **Impact:** 4 · **Reach:** 2 · **Confidence:** 5

---

## 3. ICS export can emit `COUNT` and `UNTIL` in the same RRULE after a "this and future" split

- **Dimension:** Bugs/Correctness
- **Type:** bug-fix
- **Severity:** S2
- **Files/lines:** `src/lib/ics.ts:74-79` (`recurrenceToRRule`), `src/domain/recurrence.ts:424-428` (`splitSeries` head)
- **Evidence:** `splitSeries` stops the head with `until: headUntil` while keeping the original `count` untouched. RFC 5545 §3.3.10: "The UNTIL or COUNT rule parts are OPTIONAL, but they MUST NOT occur in the same 'recur'". The editor keeps them mutually exclusive (`RecurrenceEditor.tsx:139-147`), so only a split produces this shape — and a split is the normal "This and future" flow on a count-limited series.
  Repro (throwaway test): series `{freq:'daily', count:5}` split at `2026-01-03` →
  `head.recurrence = {"freq":"daily","interval":1,"count":5,"until":"2026-01-02",...}` and
  `recurrenceToRRule(head.recurrence, true) = "FREQ=DAILY;INTERVAL=1;COUNT=5;UNTIL=20260102"`.
  `itemsToICS` writes that verbatim. Importers (Google Calendar, Apple Calendar, Outlook) reject or
  misinterpret a rule carrying both; the head row is persisted (`itemActions.ts:427`).
- **Acceptance criteria:**
  1. `recurrenceToRRule` never emits `COUNT` and `UNTIL` together (emit the tighter bound, or drop `UNTIL` when `count` is present).
  2. `splitSeries` produces a head whose `count`/`until` combination survives the ICS round trip as one bound.
  3. An existing test asserts the head RRULE contains at most one of `COUNT=`/`UNTIL=`.
- **Effort:** S
- **Impact:** 3 · **Reach:** 3 · **Confidence:** 5

---

## 4. "This and future" silently discards a recurrence-rule edit (promoted from `discovered-IMP-037` #3)

- **Dimension:** Bugs/Correctness
- **Type:** bug-fix
- **Severity:** S2
- **Files/lines:** `src/features/item/ItemEditorSheet.tsx:67-84` (`seriesPatch` omits `recurrence`), `:210-231` (`handleSave`), `src/domain/itemActions.ts:411-421` (`tailPatch`/`tailPatched.recurrence`)
- **Evidence:** `seriesPatch()` returns title/notes/status/…/data but **not** `recurrence`, and `handleSave` routes every `scope !== 'all'` through `updateRecurring`. `updateRecurring('future')` then builds `tail.recurrence` from the **stored** rule (`tailPatch.recurrence` is `undefined` → `tail.recurrence`), and the head is built from `stored` too, so an edited rule never reaches storage — while the toast still says "Series split".
  Repro (throwaway test, using the real `updateRecurring` and a `seriesPatch`-shaped patch): stored `{freq:'daily'}`, draft edited to `{freq:'weekly', byWeekday:[1,3]}` + title `standup v2`, split at `2026-01-10` →
  `2026-01-05T09:00 title=standup  freq=daily byWeekday= until=2026-01-09`
  `2026-01-10T09:00 title=standup v2 freq=daily byWeekday= until=null`
  The title applied to the tail; the rule change was dropped on both rows.
- **Acceptance criteria:**
  1. A recurrence-rule edit made in the editor is persisted when scope is "This and future" (tail carries the edited rule; the head keeps the pre-split rule with its implied anchor fields).
  2. A rule edit made while scope is "This occurrence" still does not touch the series.
  3. A test covers an edited rule on "This and future" and asserts the persisted tail rule.
- **Effort:** S
- **Impact:** 4 · **Reach:** 2 · **Confidence:** 5

---

## 5. ICS `escapeText` does not escape a carriage return, so CRLF notes produce malformed content lines

- **Dimension:** Bugs/Correctness
- **Type:** bug-fix
- **Severity:** S3
- **Files/lines:** `src/lib/ics.ts:35-41` (`escapeText`), used at `:128-131,105`
- **Evidence:** `escapeText` escapes `\`, `;`, `,`, `\n` but not `\r`. A note pasted from Windows (CRLF) leaves a raw CR inside the content line, and RFC 5545 §3.3.11 TEXT/§3.1 content lines do not permit a bare CR (it is the first octet of the line terminator).
  Repro (throwaway test): item `notes = 'line1\r\nline2'` →
  `DESCRIPTION:line1\r\\nline2` in the output (`JSON.stringify` of the full ICS shows the raw `\r` before `\\n`). A parser reading that line sees the record end early and a stray line beginning with `\nline2`.
- **Acceptance criteria:**
  1. `escapeText` normalises `\r\n`/`\r` to a single escaped `\n` before escaping, so no raw CR can reach the output.
  2. A test exports an item whose `notes`/`title`/`location` contain CRLF and asserts the result has no CR other than the CRLF record separators.
  3. No long-line folding regression (IMP-052 stays green).
- **Effort:** S
- **Impact:** 3 · **Reach:** 2 · **Confidence:** 5

---

## 6. ICS export can emit a `DTEND` earlier than `DTSTART` for a timed item with an inverted end

- **Dimension:** Bugs/Correctness
- **Type:** bug-fix
- **Severity:** S3
- **Files/lines:** `src/lib/ics.ts:133-144`, `src/features/item/ItemEditorSheet.tsx:642-655` (End input has no `> Start` validation), `src/domain/recurrence.ts:122-128` (`durationMs` returns `null` for an inverted range)
- **Evidence:** The End field is a free `datetime-local` input; setting a timed event's start to `10:00` and its end to the same day's `00:00` stores `end = '2026-01-05T00:00'`. `itemsToICS` writes the stored `end` verbatim for timed items. Meanwhile the occurrence engine silently substitutes the start (`durationMs` → `null` → `deriveOccurrenceEnd` returns `startStr`), so the card and the exported file disagree.
  Repro (throwaway test): `start '2026-01-05T10:00'`, `end '2026-01-05'`, `allDay:false` → `DTSTART:20260105T100000` / `DTEND:20260105T000000`. RFC 5545 §3.8.2.2: "The value MUST be later in time than the value of the DTSTART property."
- **Acceptance criteria:**
  1. `itemsToICS` omits `DTEND` (or clamps it) when the resolved end is not later than the start, so no VEVENT has `DTEND <= DTSTART`.
  2. The editor prevents or flags an end earlier than the start for timed items (or the export is the single source of truth and is documented).
  3. A test asserts every emitted `DTEND` is strictly after its `DTSTART`.
- **Effort:** S
- **Impact:** 3 · **Reach:** 2 · **Confidence:** 4

---

## 7. DST: an occurrence's end is a real-time duration added to a wall-clock start, so the wall-clock end shifts on the transition day

- **Dimension:** Bugs/Correctness
- **Type:** bug-fix
- **Severity:** S3
- **Files/lines:** `src/domain/recurrence.ts:122-128` (`durationMs`), `:159-167` (`deriveOccurrenceEnd`)
- **Evidence:** `durationMs` subtracts two local wall-clock instants (real elapsed time), then `deriveOccurrenceEnd` adds that elapsed time to a freshly constructed local start, so the result is expressed in wall-clock terms that differ across a DST boundary.
  Repro (throwaway test, America/New_York):
  - series `2026-03-01T01:00`–`04:00`, weekly → the `2026-03-08` occurrence (spring-forward day) is `01:00`–**`05:00`**, not the series' `04:00`.
  - series starting **on** the transition day `2026-03-08T01:00`–`04:00` (real elapsed 2 h) → every later occurrence is `01:00`–**`03:00`**: `occ = [{"k":"2026-03-08","s":"...01:00","e":"...04:00"},{"k":"2026-03-15","s":"...01:00","e":"...03:00"},{"k":"2026-03-22",...,"e":"...03:00"}]`.
  So the stored wall-clock `end` is not preserved for recurring items across a DST change, in both directions.
- **Acceptance criteria:**
  1. A recurring timed item's occurrence end preserves the series' **wall-clock** end time (start's clock time + the series' wall-clock length), including on DST transition days.
  2. Both repro cases above yield `end === '…T04:00'` for every occurrence.
  3. Non-DST days and all-day items are unchanged; existing recurrence tests stay green.
- **Effort:** M
- **Impact:** 2 · **Reach:** 2 · **Confidence:** 4

---

## 8. The delivery tick can still reject on blocked storage (promoted from `discovered-IMP-092` D1)

- **Dimension:** Bugs/Correctness
- **Type:** bug-fix
- **Severity:** S3
- **Files/lines:** `src/pwa/ReminderRuntime.tsx:150-152` (`void tick().finally(...)` with no `catch`), `:163` (`void itemRepo.get(...).then(...)` with no rejection handler), `src/pwa/delivery.ts:89,92-93,108-109` (`deliver` awaits `reminderLogRepo.wasFired`/`record`)
- **Evidence:** IMP-092 hardened the prune passes and the undelivered count, but the tick itself is fire-and-forget: with a reminder actually due **and** storage unavailable, the first `wasFired` rejection escapes as an unhandled rejection. Same class for the `notificationclick` service-worker message path (`itemRepo.get(...).then(...)`). The blocked-storage preview has no due reminders, so IMP-092's acceptance check passes while the path stays unguarded.
- **Acceptance criteria:**
  1. No `ReminderRuntime` async path can produce an unhandled rejection when IndexedDB is unavailable (tick, `deliver`, and the SW message handler each settle).
  2. The existing blocked-storage test is extended with a due reminder and asserts zero unhandled rejections.
  3. Happy-path delivery and the boot storage toast are unchanged.
- **Effort:** S
- **Impact:** 3 · **Reach:** 2 · **Confidence:** 4

---

## 9. No tests for the notification / service-worker boundary (`notifications.ts`, `register.ts`, `sw.ts`)

- **Dimension:** Tests/Tooling
- **Type:** test
- **Severity:** S3
- **Files/lines:** `src/pwa/notifications.ts:9-58` (13.6 % stmts / 15.4 % branch), `src/pwa/register.ts:9-27` (28.6 %), `src/pwa/sw.ts:6-40` (0 %, excluded from `tsc`)
- **Evidence:** v8 coverage over the audit scope: `notifications.ts` 13.63 % statements / 15.38 % branches; `register.ts` 28.57 %; `sw.ts` 0 %. `showAppNotification` (the permission gate, the registration-vs-`new Notification` fallback, the `catch` → `false`) and `sendSkipWaiting` are the exact boundary where IMP-019/021/036/086/092 bug classes live, and they have no direct test.
- **Acceptance criteria:**
  1. `showAppNotification` is tested for: permission ≠ granted → `false` and no call; registration present → `registration.showNotification` called with the payload; no registration → `new Notification`; a throwing API → `false` (never throws).
  2. `sendSkipWaiting` is tested for a missing `serviceWorker`, a registration without `waiting`, and a `waiting` worker (posts `SKIP_WAITING`).
  3. The `notificationclick` handler is exercised (client present → focus + `postMessage`; no client → `openWindow`), either by unit-testing the handler body or by extracting it.
- **Effort:** M
- **Impact:** 3 · **Reach:** 3 · **Confidence:** 4

---

## 10. Reminder helpers untested: `fireTimesForOccurrence`, `formatReminderLabel`, and the `timeOfDay` fire path

- **Dimension:** Tests/Tooling
- **Type:** test
- **Severity:** S3
- **Files/lines:** `src/domain/reminders.ts:31-41` (`fireTimesForOccurrence`, 0 %), `:135-152` (`formatReminderLabel`), `:24-29` (`timeOfDay` branch)
- **Evidence:** Coverage lists `reminders.ts` lines `31-41, 137, 152` uncovered (80 % stmts / 70.96 % branch). `fireTimesForOccurrence` has no reference outside its own module (`grep` shows only the definition) and no test, so its de-dup/sort contract is unverified; `formatReminderLabel`'s `1440 → "1 day"`, `60 → "1 hour"`, minutes, `At start`, and absolute branches are untested; the `timeOfDay` branch is only reachable through `pruneExpiredAbsolute` tests.
- **Acceptance criteria:**
  1. `fireTimesForOccurrence` is tested with mixed reminders (absolute + offset + timeOfDay + duplicate offsets + a reminder with no trigger) asserting sorted, de-duplicated epoch values.
  2. `formatReminderLabel` is tested for `absolute`, `timeOfDay`, `0`, `±1440`, `±60`, `±30` and the no-trigger fallback.
  3. `reminderFireTime` is tested for the `timeOfDay`-on-a-timed-occurrence case and for `null` when no trigger is present.
- **Effort:** S
- **Impact:** 2 · **Reach:** 3 · **Confidence:** 5

---

## 11. The shared week-start label helper has no test (`labels.ts` 0 % branch coverage)

- **Dimension:** Tests/Tooling
- **Type:** test
- **Severity:** S3
- **Files/lines:** `src/lib/labels.ts:64-77` (`weekdayLabels`, `statusClasses`, `priorityBadgeClasses`) — 64.7 % stmts / **0 % branch** / 33.3 % funcs
- **Evidence:** v8 coverage: `labels.ts` reports 0 % branch coverage, with lines `64-77` uncovered. `weekdayLabels(weekStartsOn)` is the single shared helper introduced by IMP-049 and reused by IMP-058 for the Sunday/Monday setting; an off-by-one there would regress both views with no test to catch it. `src/lib/labels.test.ts` exists but covers only the other maps.
- **Acceptance criteria:**
  1. `weekdayLabels(0)` === `['Sun','Mon',…,'Sat']` and `weekdayLabels(1)` === `['Mon',…,'Sun']` are asserted.
  2. `statusClasses` returns a distinct class string for each of `done`/`doing`/`cancelled`/`todo` and every variant carries a `dark:` class.
  3. `priorityBadgeClasses('high')` and `('low')` are asserted distinct and dark-mode-safe.
- **Effort:** S
- **Impact:** 2 · **Reach:** 3 · **Confidence:** 5

---

## 12. Untested `date.ts` helpers and backup DOM/`backupRepo` glue

- **Dimension:** Tests/Tooling
- **Type:** test
- **Severity:** S3
- **Files/lines:** `src/lib/date.ts:61-67` (`dateKeyOf` fallback), `:130-141` (`withTime`, `setTimeOnDateString`, `stripTime`), `src/lib/backup.ts:146-176` (`downloadFile`, `readTextFile`, `pickFile`) — 83.1 % / 71.1 % and 78.8 % / 64.3 % funcs, `src/db/repository.ts:296,302-311` (`backupRepo.all/latest/remove/prune`), `:159-165` (`replaceAll`)
- **Evidence:** Coverage: `date.ts` lines `64-66, 109, 131-140` uncovered; `backup.ts` lines `148-156, 169-174`; `repository.ts` lines `296, 302-311`. `withTime` has no reference outside `date.ts`, so it is untested dead code (worth either a test or removal — removal alone is explicitly below the backlog cut). `backupRepo.prune(keep)` is the retention guard for the migration backups and is never exercised.
- **Acceptance criteria:**
  1. `dateKeyOf` is tested for a date-only value, a datetime value, a non-ISO parseable value, and an unparseable value (`null`).
  2. `setTimeOnDateString`/`stripTime`/`withTime` are tested (or `withTime` is removed and the others covered).
  3. `backupRepo.prune(keep)` is tested with more rows than `keep` asserting the newest `keep` survive; `replaceAll` is tested to clear then bulk-put inside one transaction.
  4. `readTextFile` is tested with a stubbed `FileReader` (resolve + `onerror` reject).
- **Effort:** S
- **Impact:** 2 · **Reach:** 2 · **Confidence:** 4

---

## Coverage gaps noted but not itemised

`src/db/sync/SyncAdapter.ts` 0 % (documented unimplemented seam), `src/domain/quickadd.ts:502-506`
(`chipId`, `isValidParsedDate`), `src/domain/itemFactory.ts:107-111` (`isScheduledKind`,
`isRecurringKind`), `src/domain/bills.ts:7`, `src/pwa/ReminderRuntime.tsx:166-167,184`
(snooze/`openEditor` message branches).

## Checked and found correct (no item)

- `calendarDaysBetween` across US spring-forward (returns 2 for Mar 7→9); `startOfWeek` for both
  `weekStartsOn` values; `clampDayOfMonth` incl. `-1` and December; monthly `byMonthDay: [-1]`
  (Jan 31 → Feb 28 → Mar 31 → Apr 30); yearly Feb 29 clamping to Feb 28 in non-leap years
  (matches the documented "clamped, never skipped" convention).
- `stats.habitStreak` for day/week/month targets (verified a monthly-target habit over
  Jan/Feb/Mar → `current: 3, best: 3`); `activeDayStreak`; `goalProgress`.
- `pruneItemReminders` end-to-end on fake-indexeddb: prunes only expired absolutes, keeps a
  due-inside-window absolute, leaves `history` untouched (it does bump `updatedAt`).
- `parseCSV`/`toCSV` round trip with embedded commas, quotes and CRLF; `mergeImportedItems`
  duplicate remap of `parentId` (and a dangling `parentId` left alone).
- `upcomingReminders` for same-day negative offsets, `timeOfDay` and positive offsets.
- `eisenhower.ts` mapping is correct (note: the `priorityScore` doc comment says "4 = important+urgent"
  while the function's range is 0–3 — comment-only, not reported).
