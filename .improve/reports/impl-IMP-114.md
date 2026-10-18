# impl-IMP-114 — ICS CRLF escaping, valid DTEND, and delivery-tick rejection handling

Covers IMP-114, IMP-115 and IMP-117 (all S3 correctness bugs from
`.improve/reports/discover3-quality.md` #5, #6 and #8).

## Files

| File | Change |
| --- | --- |
| `src/lib/ics.ts` | `escapeText` normalises `\r\n`/`\r` to `\n` before escaping (IMP-114). The timed branch only emits `DTEND` when the resolved end is strictly later than the start (IMP-115). |
| `src/lib/ics.test.ts` | CRLF-in-text export test (IMP-114); inverted/equal/forward DTEND tests (IMP-115). |
| `src/pwa/ReminderRuntime.tsx` | `tick`'s `try` gains a `catch` so a blocked-storage `deliver` rejection settles instead of escaping (IMP-117). The `OPEN_ITEM` service-worker message handler gains `.catch(() => {})`. |
| `src/pwa/ReminderRuntime.blockedStorage.test.tsx` | Due-reminder tick case and blocked SW-click-message case asserting zero unhandled rejections; afterEach drains the module item source. |

## Acceptance criteria

### IMP-114

1. `escapeText` runs `.replace(/\r\n?/g, '\n')` first, so a Windows-pasted note can no longer
   leave a raw CR inside a content line; the LF is then escaped to `\n`. §3.3.11/§3.1 satisfied.
2. A test exports an event whose `title`, `notes` and `location` contain `\r\n` and a bare `\r`,
   asserting `ics.replace(/\r\n/g, '')` contains no `\r` and the fields carry `\n` escapes.
3. Line folding is untouched: the RFC 5545 folding tests (IMP-052) stay green.

### IMP-115

1. For a timed item, `DTEND` is emitted only when `end.getTime() > start.getTime()`; an inverted
   or equal range omits it, matching the occurrence engine's start substitution. The comment
   documents the export as the single source of truth for the invalid case.
2. The editor's free `datetime-local` End field is left as-is; the export is the documented
   source of truth, satisfying the "or" branch of criterion 2 without widening the change.
3. Tests assert an inverted range omits `DTEND`, and that across inverted/equal/forward cases
   every emitted `DTEND` string is strictly greater than its `DTSTART`.

### IMP-117

1. `tick` catches its own rejection, so `void tick()`, `void tick().finally(...)`, the interval
   and the visibility caller all settle; `deliver`'s `wasFired`/`record` rejection no longer
   escapes. The SW message handler's `itemRepo.get(...).then(...)` chain gets a terminal `catch`.
2. The blocked-storage file gains a due-reminder case (`wasFired` rejecting) and a blocked
   `OPEN_ITEM` message case, both capturing `process.on('unhandledRejection')` and asserting `[]`.
3. Happy-path delivery tests and the boot storage toast are untouched and green.

## Verification

- `npm run typecheck` — PASS.
- `npm run lint` — PASS (no output).
- `npm run test` — PASS: **46 files / 526 tests**.
- `npm run format:check` — PASS.
- Non-vacuous: the due-reminder case fails without the `tick` catch (`expected [ Error: database is blocked ] to deeply equal []`); the SW case fails without the handler `.catch`.

## Scope

No schema, repository, migration or dependency changes. No commit or push.
