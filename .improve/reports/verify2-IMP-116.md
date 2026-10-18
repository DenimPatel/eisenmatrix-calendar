# verify2-IMP-116 — Preserve a recurring item's wall-clock end across DST

**Reviewer:** independent, second attempt (did not author the change)
**Change under review:** `src/domain/recurrence.ts` (modified), `src/domain/recurrence.test.ts` (modified), `src/domain/recurrence.dst.test.ts` (new, untracked)
**HEAD baseline:** `8be093a`

## VERDICT: PASS

The prior failure (verify-IMP-116 Issue 1) is **resolved**. The non-DST differential vs HEAD is
now **zero mismatches** in both `TZ=UTC` and `TZ=Asia/Kolkata`, the DST fix is confirmed in
`TZ=America/New_York`, and every gate passes including `npm run build`. No new issues found.

---

## Change as reviewed

- `durationMs` (real elapsed ms) → `wallClockLengthMinutes`: `differenceInCalendarDays(end, start)
  * 1440 + (endClockMinutes − startClockMinutes)`; a date-only endpoint contributes `0` minutes
  (`slice(11,16)` empty ⇒ `Number('')||0`), so the inconsistent date-only-start/timed-end series
  matches HEAD's real-elapsed length outside DST. Returns `null` for a non-forward range.
- `deriveOccurrenceEnd` adds those wall-clock minutes to the *resolved* start via local
  date-part construction (`new Date(y, m, d, h, min + minutes)`), keeping the clock time stable
  across a DST transition in both directions.
- The `hasTimeComponent` guard that caused Issue 1 is **gone** from the current tree (confirmed
  by reading `recurrence.ts:124-143` and the diff).

## Differential vs HEAD (independent harness)

Harness imported `git show HEAD:src/domain/recurrence.ts` (copied to
`src/domain/__imp116_head.ts` for `@/` alias resolution) and the working-tree `./recurrence`,
comparing full `expandOccurrences` projections (`occKey|start|end|allDay`):
**12 item shapes × 18 rules × 4 windows = 864 checks** per zone.

| Zone | Checks | Mismatches |
| --- | --- | --- |
| `TZ=UTC` | 864 | **0** |
| `TZ=Asia/Kolkata` | 864 | **0** |
| `TZ=America/New_York` | 864 | 14 (all intended DST fixes) |

- Shapes covered: timed same-day, overnight, multi-day, all-day, timed-start/date-end,
  date/date, **date-start/timed-end (the Issue 1 class)**, end-before-start, timed-no-end,
  all-day-timed-end, date-no-end, long-multi-day.
- Rules covered: daily (i1/i2), weekly (+byWeekday, i2), monthly (+`-1`, `31`, i2/`15`),
  yearly (+byMonth), count, until, exceptions, and overrides (start / end / allDay).
- The 14 NY mismatches are confined to spans that cross the spring-forward transition
  (`multi-day 09:00→+2d 17:00` and `long-multi-day 23:00→+3d 01:00`): HEAD drifts the end by
  +1 h (e.g. HEAD `2026-03-08T18:00` vs NEW `2026-03-08T17:00`); the new code preserves the
  series wall-clock end. This is the intended correction.

## DST fix confirmed (America/New_York)

Direct HEAD-vs-working-tree probe, weekly `01:00–04:00` crossing the transition:

- HEAD: `2026-03-01=T04:00, 2026-03-08=2026-03-08T05:00, 2026-03-15=T04:00, 2026-03-22=T04:00`
  → the `2026-03-08` occurrence drifts to `05:00` (the bug).
- Working tree: every occurrence ends `T04:00`, including `2026-03-08`.
- Fall-back direction (`2026-10-25`): working tree keeps `T04:00` on all four occurrences.

## Gates (working tree)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 47 files, **531** tests |
| `npm run format:check` | PASS |
| `npm run build` | PASS — `tsc --noEmit` + vite build + `dist/sw.js` (18 precache entries) |
| `TZ=UTC npx vitest run` | PASS — 531 |
| `TZ=Asia/Kolkata npx vitest run` | PASS — 531 |
| `TZ=America/New_York npx vitest run` | PASS — 531 (two concurrent runs also 531/531) |

## Issues

None blocking.

- **Observation (unreproduced flake, non-blocking, not attributable to this change).** One
  isolated `TZ=America/New_York` full-suite run reported `1 failed | 530 passed`; the identity
  was not captured and it did **not** reproduce across ~42 subsequent runs (sequential,
  JSON-reported, and under two-way parallel load), all 531/531. The changed module is pure,
  timer-free recurrence logic and the new DST test is deterministic, so this is consistent with
  an existing timing-sensitive test (several suites use `setTimeout`/`settleUntil` barriers and a
  5 s window at `ReminderRuntime.test.tsx:305-306`). Worth a separate look, but not evidence
  against IMP-116.

## Evidence

- Differential results written to `/tmp/imp116-diff-{UTC,Asia_Kolkata,America_New_York}.txt`
  (`checks=864`, mismatches `0/0/14`).
- HEAD probe output `/tmp/imp116-headprobe.txt` (HEAD `2026-03-08T05:00` vs working tree
  `T04:00`; fall-back `T04:00`).
- Temporary harness files (`src/domain/__imp116_head.ts`, `__imp116_diff.test.ts`,
  `__imp116_headprobe.test.ts`) were removed; `git status` shows only the three intended paths.
- No source was modified by the reviewer.
