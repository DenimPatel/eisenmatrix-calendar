# verify-IMP-116 — Preserve a recurring item's wall-clock end across DST

**Reviewer:** independent (did not author the change)
**Change under review:** `src/domain/recurrence.ts` (modified), `src/domain/recurrence.dst.test.ts` (new, untracked)
**HEAD baseline:** `8be093a`

## VERDICT: FAIL (narrow, low severity)

The DST fix itself is correct, the new test is meaningful, and all gates pass. However the stated
requirement — *non-DST results must be byte-identical to HEAD* — is **not** met: one input class
produces different occurrence ends in non-DST zones (`TZ=UTC` and `TZ=Asia/Kolkata`). See Issue 1.

---

## What was reviewed

- `git diff src/domain/recurrence.ts`: replaces `durationMs` (real elapsed ms) with
  `wallClockLengthMinutes` (calendar days × 1440 + clock-minute delta) and reconstructs the
  occurrence end via local date-part construction.
- New `src/domain/recurrence.dst.test.ts` (pins `process.env.TZ = 'America/New_York'`).
- `git status`: only `recurrence.ts` modified; the DST test and `impl-IMP-116.md` untracked.

## Gates (all run on this working tree)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 47 files, 530 tests |
| `npm run format:check` | PASS — "All matched files use Prettier code style!" |
| `npm run build` | PASS — `tsc --noEmit` + vite build + SW (53 modules, precache 18 entries) |
| `TZ=America/New_York npm run test` | PASS — 47 files, 530 tests |
| `TZ=Pacific/Auckland npm run test` | PASS — 47 files, 530 tests |

## Non-DST differential vs HEAD (requirement)

Harness imported `git show HEAD:src/domain/recurrence.ts` (copy in `/tmp/imp116/head-recurrence.ts`)
and the working-tree `./recurrence`, comparing `expandOccurrences` projections across
12 item shapes × 16 rules × 4 windows (912 checks), plus a `dueAt` matrix. Run under `TZ=UTC`
and `TZ=Asia/Kolkata`.

- `TZ=UTC`: **3 / 912** mismatches. `TZ=Asia/Kolkata`: **3 / 912** mismatches. Both are the
  **same** single class (Issue 1); all `dueAt` checks identical.
- Shapes explicitly checked and **identical** to HEAD: overnight (`22:00→02:00`), multi-day
  (`09:00→+2d 17:00`), all-day/date-only, timed start + date-only end, date-only start +
  date-only end, and end-precedes-start (`10:00→09:00`, both fall back to start).
- DST-zone cross-check (`TZ=America/New_York`): 23/912 differences, all confined to occurrences
  whose span crosses a transition (overnight / multi-day / full-day) plus Issue 1's class; these
  are the intended corrections (wall-clock end preserved, lengths equal).

The new DST test is meaningful: with `TZ=America/New_York`, HEAD yields
`2026-03-08T05:00` for the weekly `01:00–04:00` transition-day occurrence, so the new
`T04:00` assertions fail on HEAD (confirmed with a temporary HEAD-importing probe) and pass on
the working tree.

## TZ pinning / worker isolation

- Default `vitest.config.ts` has no `pool`/`isolate` overrides → Vitest 4 default
  (`pool: 'forks'`, `isolate: true`). Two temporary probe files recorded **different PIDs**
  under `TZ=Pacific/Auckland`, proving each test file runs in its own child process, so the
  DST file's `process.env.TZ` cannot leak to other files under `npm run test`.
- Latent (not currently observable): `afterAll` restores via `process.env.TZ = ORIGINAL_TZ`,
  and when `ORIGINAL_TZ` is unset Node coerces the assignment to the string `"undefined"`
  (verified: offset becomes 0 = UTC) rather than deleting it. Harmless only because of per-file
  process isolation; it would leak UTC if isolation were ever disabled (`--no-isolate`).

## Issues

1. **Non-DST behavior change for an inconsistent series** (`recurrence.ts:131`). The added guard
   `if (!hasTimeComponent(item.start) || !hasTimeComponent(item.end)) return null;` short-circuits
   a series whose `start` is date-only but `end` is timed. Old `durationMs` had no such guard, so
   for such a series it computed a positive duration from midnight; the new code returns `null`
   and the occurrence end falls back to its start.
   - Counterexample (identical in UTC and Asia/Kolkata), item `start='2026-01-05'`,
     `end='2026-01-05T10:00'`, daily rule with override `2026-01-06: { start: '2026-01-06T18:30' }`:
     - HEAD occurrence end: `2026-01-07T04:30`
     - new occurrence end: `2026-01-06T18:30`
   - Trigger requires a date-only series start + timed series end **and** a per-occurrence timed
     start override; the base (non-override) occurrence is unaffected.
   - Reachability: `normalizeItem` (`src/domain/itemFactory.ts:120-137`) passes `partial.start`/
     `partial.end` through unchanged, so an imported/normalized record can hold this inconsistent
     pair (the repo's own `ItemEditorSheet.test.tsx:313-315` already stores a date-only start with
     a timed end). The editor itself keeps `allDay=false` ⇒ timed start, so hand-editing is safe.
   - Note: the impl report's claim "Non-DST days are unchanged" is therefore imprecise — the
     change is DST-independent and comes from the new guard, not from wall-clock arithmetic.
   - Impact: low (malformed data; the new fallback is arguably more defensible), but it violates
     the explicit "identical to HEAD in non-DST zones" acceptance criterion.

No other issues found. The impl report's other claims (DST spring-forward and fall-back
preservation, all-day path unchanged, `null` fallback for non-forward ranges) were reproduced.

## Evidence

- Differential harness: 12 shapes × 16 rules × 4 windows (+`dueAt` matrix); `TZ=UTC` 3/912,
  `TZ=Asia/Kolkata` 3/912, all Issue 1.
- HEAD probe under `TZ=America/New_York`: `2026-03-08T05:00` (bug) vs working tree `04:00`.
- Isolation probes: distinct PIDs per file; `process.env.TZ = undefined` ⇒ `"undefined"` ⇒ UTC.
- Temporary probe/harness files were removed; working tree contains only the three intended paths.
