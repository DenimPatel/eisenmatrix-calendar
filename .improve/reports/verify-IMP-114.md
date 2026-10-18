# verify-IMP-114 — independent review of IMP-114 + IMP-115 + IMP-117

Reviewer: independent (did not author the change). Scope: working-tree diff on
`improve/auto-20261017` vs the acceptance criteria for IMP-114, IMP-115 and IMP-117 in
`.improve/FEATURES.md` (lines 1823–1885), plus the five gates. Source not modified; probes
were throwaway and deleted.

## Verdict

**PASS.** All explicit acceptance criteria are met and the five gates are green. Two
bookkeeping/scope notes below (neither fails a criterion).

## What the diff does

- `src/lib/ics.ts` `escapeText`: `.replace(/\r\n?/g, '\n')` runs first, so CRLF/CR become
  LF and are then escaped to `\n`; the remaining escape order (`\`, `;`, `,`, `\n`) is
  unchanged. `itemsToICS` still builds each logical line already escaped and only then
  `flatMap(foldLine).join('\r\n')` — escaping precedes folding, CRLF separates records.
- `src/lib/ics.ts` timed branch: `DTEND` emitted only when `end.getTime() > start.getTime()`
  (omitted for equal/inverted ranges). The all-day branch is untouched (exclusive
  `DTEND;VALUE=DATE` = end + 1 day, omitted when `dateOnly(end) <= dateOnly(start)`).
- `src/pwa/ReminderRuntime.tsx` `tick`: a bare `catch {}` added before the existing
  `finally { ticking.current = false }`. The `window.setInterval`/`visibilitychange`
  registration is outside `try`, so the interval is untouched. The SW `OPEN_ITEM`
  `itemRepo.get(...).then(...)` chain gains a terminal `.catch(() => {})`.
- Tests added in `src/lib/ics.test.ts` (CRLF normalisation; inverted/equal/forward DTEND)
  and `src/pwa/ReminderRuntime.blockedStorage.test.tsx` (due-reminder tick; blocked
  SW-click message; `afterEach` drains the module-level item source).

## IMP-114 — criteria check

1. `escapeText` normalises `\r\n`/`\r` to a single escaped `\n` first — **met**
   (`src/lib/ics.ts:40`). Ordering is correct: CR→LF happens before backslash escaping, so
   a literal `\r` (backslash + `r`) is not matched and `\n` cannot be double-escaped.
2. Export test asserts no CR other than the CRLF separators — **met**
   (`src/lib/ics.test.ts:32`, `ics.replace(/\r\n/g,'')` has no `\r`; SUMMARY/DESCRIPTION/
   LOCATION carry `\n`).
3. No folding regression — **met**. Probe: a title of 40 commas (40 raw octets, 88 octets
   after escaping) folds into a space-prefixed continuation whose unfold equals
   `\,`×40, proving fold-after-escape; every physical line ≤ 75 octets. The IMP-052
   octet-folding tests stay green.

## IMP-115 — criteria check

1. `itemsToICS` omits `DTEND` when the resolved end is not later than the start — **met**
   (`src/lib/ics.ts:148`). Probe over forward/equal/inverted timed events: the only
   emitted `DTEND` is strictly after its `DTSTART`; equal and inverted emit none. A timed
   range crossing midnight (`23:00 → next-day 01:00`) still emits `DTEND` (absolute
   instant compare, not string).
2. Editor prevents/flags, **or** export is documented source of truth — **met via the
   "or" branch**: the free `datetime-local` End field is unchanged, and the export comment
   (`src/lib/ics.ts:145-147`) documents the omission as the chosen behaviour.
3. Test asserts every emitted `DTEND` is strictly after its `DTSTART` — **met**
   (`src/lib/ics.test.ts:51-83`).

All-day semantics preserved: multi-day emits exclusive `DTEND` (end+1); single-day and
inverted all-day omit `DTEND` (single-day DATE + no DTEND = 1 day). Probe confirms exactly
one `DTEND` across the multi/single/inverted set.

## IMP-117 — criteria check

1. No `ReminderRuntime` async path can produce an unhandled rejection with IndexedDB
   unavailable (tick, `deliver`, SW message handler each settle) — **met**. Independent
   probe: mounted the runtime with `reminderLogRepo.wasFired` rejecting and captured
   `process.on('unhandledRejection')` → `[]`; the same probe then invoked the captured
   interval callback three more times and observed `wasFired` called again, i.e. the
   interval keeps running and `ticking.current` is released by `finally` after a throwing
   tick.
2. Blocked-storage test extended with a due reminder asserting zero unhandled rejections —
   **met** (`ReminderRuntime.blockedStorage.test.tsx:143-157`), plus the SW-click case
   (`:173-196`).
3. Happy-path delivery and the boot storage toast unchanged — **met**. The boot
   `STORAGE_UNAVAILABLE_MESSAGE` toast is reported in `App.tsx:48-50` from `ensureDbOpen`,
   a path the tick `catch` cannot reach; the delivery suite stays green.

Note (not a criterion): the tick `catch {}` is unconditional and logs nothing, so a
non-storage programming error inside `tick` would be silenced. Scope is the blocked-storage
settle, so this is acceptable; flagging for future hardening.

## Bookkeeping note (not a criterion)

`git diff .improve/FEATURES.md` flips **IMP-112** to `DONE` (a leftover from the prior
commit `10a6c07`), while IMP-114, IMP-115 and IMP-117 remain `TODO`. No functional impact,
but the statuses for the three reviewed items were not marked done.

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build`
— all pass (typecheck/lint clean; **46 files / 526 tests**; Prettier clean; Vite build +
injectManifest service worker succeed). Throwaway probes deleted; the working tree holds
only the five changed files and the two report files.
