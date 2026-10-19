# verify-IMP-140 — Independent verification

**Verifier role:** independent, skeptical verifier (did not author the change)
**Repo:** `/Users/pvrun/Desktop/Denim/git/eisenmatrix-calendar` @ branch `improve/auto-20261018`, working tree
**Spec:** `.improve/FEATURES.md` §IMP-140; `.improve/reports/impl-IMP-140.md`; `.improve/reports/discover4-quality.md` C2
**Change under test:** uncommitted `src/domain/reminders.ts` (+4), `src/domain/reminders.test.ts` (+62), `.improve/FEATURES.md`

## Verdict: PASS

Every acceptance criterion is met and independently reproduced. One out-of-scope
pre-existing limitation (C3) and one benign bookkeeping edit are noted below; neither
blocks the change.

---

## 1. Acceptance criteria — independently reproduced

Method: throwaway probe `/tmp/kilo/repro/probe.test.ts` run through
`/tmp/kilo/repro.config.ts` (`root` = repo, `@` → `src`, repo `setup.ts`), so no repo file
was created or modified. All 9 probe cases pass. The probe drives the **real**
`upcomingReminders` + `expandOccurrences` + `createItem` helpers, not mocks.

Daily task "Take medicine" at `2026-10-18T09:00`, one occurrence key `2026-10-18`, window
`2026-10-18T00:00:00`–`23:59:59`.

| Case | relative `offsetMinutes:0` | time-of-day `'09:00'` |
| --- | --- | --- |
| `todo` | fires `09:00` | fires `09:00` |
| `doing` | fires `09:00` | fires `09:00` |
| `done` | **no reminder** | **no reminder** |
| `cancelled` | **no reminder** | **no reminder** |
| skipped exception | no reminder | no reminder |

- **AC1** (no reminder for resolved `cancelled`/`done`): **met**. Both reminder kinds, plus
  a non-recurring task (`item.status` done/cancelled) and an `overrides[key].status`
  cancelled override, all suppressed. `todo`/`doing` produce exactly the prior single fire
  time (`1792328400000` = `2026-10-18T09:00`), so nothing else changed.
- **AC2** (skipped stays suppressed, `todo` unchanged): **met**. `recurrence.exceptions`
  drops the occurrence before the status check; `todo`/`doing` unaffected.
- **AC3** (existing reminder tests pass): **met** (see §3).

**Series-status fallback.** `resolveOccurrenceStatus` (`src/domain/recurrence.ts:217-226`)
special-cases series `cancelled` (`:224`) but lets series `done` fall through to `todo`
(`:225`). Reproduced: a recurring series with `item.status = 'cancelled'` is suppressed; a
series with `item.status = 'done'` still fires, because its resolved occurrence status is
`todo`. This is **consistent with AC1 as worded** ("resolved status") and is the exact gap
tracked separately as C3 (`discover4-quality.md` §C3, *"Not in FEATURES.md"*) — deliberately
out of IMP-140 scope. Flagged, not a failure.

**Per-occurrence override.** `occurrences['2026-10-18'] = done`,
`occurrences['2026-10-19'] = todo`, window spanning both days → only `2026-10-19T09:00`
fires. **Met.**

## 2. Seam, no double-filtering, no unrelated behavior change

- The filter sits in `upcomingReminders` (`src/domain/reminders.ts:80`), the single function
  `ReminderRuntime` uses to build candidates (`src/pwa/ReminderRuntime.tsx:111-115`). The
  runtime's only extra predicate is a redundant `fireAt <= now + 30_000` window filter; it
  never re-reads status. **Correct seam, no duplication.**
- Cross-midnight negative offset (`-600` on a next-day occurrence) still fires at the
  pre-midnight instant for `todo` and is suppressed only when that occurrence is `done` —
  fire-time math (`offsetMinutes`, `timeOfDay`, cross-midnight, `absolute`) is untouched.
- Absolute reminders now follow the same rule: an `absolute` reminder is returned per
  occurrence, so a `done` occurrence's copy is suppressed while a `todo` copy still fires.
  This is a *consistent consequence of AC1*, not a regression; it is the only observable
  behavior change beyond "done/cancelled stop notifying".
- **No scope creep:** source diff is exactly the 4-line guard; no other source file changed.

## 3. Gates (all pass)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run test` | **74 files / 751 tests passed** |
| `npm run format:check` | all files formatted |
| `npm run build` | built; `dist/sw.js` generated (PWA injectManifest) |

Health delta vs. `discover4-quality.md` baseline (72 files / 707 tests): +2 files / +44 tests
(IMP-139 split tests + this suite), 0 failures.

## 4. Mutation check (falsification)

Removed the two-line guard (lines 77-80) and ran `src/domain/reminders.test.ts`:
**6 tests fail**, all in the new suite:

- `upcomingReminders occurrence status > relative offset > status done schedules: false`
- `… > relative offset > status cancelled schedules: false`
- `… > time of day > status done schedules: false`
- `… > time of day > status cancelled schedules: false`
- `… > relative offset > returns nothing once the occurrence is done or cancelled`
- `… > time of day > returns nothing once the occurrence is done or cancelled`

Restored from a byte-for-byte backup; `shasum -a 256` of the restored file equals the
pre-mutation hash (`718808bebce1bc1da30de3c6ddb208c95f2e2f76e125289d161f6004447705e1`), and
`git diff src/domain/reminders.ts` shows only the intended 4-line addition. The suite is
load-bearing, not incidental.

## 5. State / backlog files

`git status --porcelain`: only `.improve/FEATURES.md`, `src/domain/reminders.ts`,
`src/domain/reminders.test.ts` modified; `.improve/reports/impl-IMP-140.md` untracked.
`STATE.md`, `PROGRESS.log`, `HANDOFF.md`, `CHANGELOG.md`, `DECISIONS.md` are **unchanged**.

- The IMP-140 status flip `TODO → IN-PROGRESS` is present as expected.
- **Minor, benign:** the same `FEATURES.md` hunk also updates IMP-139's note
  `Commit pending. → Commit 2378f61.` (commit `2378f61` exists: *"fix(recurrence): partition
  occurrence state on series split [IMP-139]"*). This is post-commit bookkeeping for the
  previous item, not a change to any IMP-140 state. Not a blocker.

## 6. Browser check

Skipped by design: this is a pure `domain` change consumed only by the reminder delivery
tick; no UI/rendering path or new user-visible control is introduced. The one UI-adjacent
effect (a completed/cancelled occurrence stops notifying) is fully exercised at the domain
seam the runtime calls.

## Files / evidence

- Impl: `src/domain/reminders.ts:76-80`; tests `src/domain/reminders.test.ts:146-204`.
- Independent probe: `/tmp/kilo/repro/probe.test.ts` + `/tmp/kilo/repro.config.ts` (9/9 pass).
- Mutation backup: `/tmp/kilo/reminders.impl.ts` (hash-verified restore).
