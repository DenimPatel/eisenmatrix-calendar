# verify-IMP-102.md — Independent verification of IMP-102 + IMP-103

Reviewer: independent skeptical pass. Source **not modified**.
Impl under review: `.improve/reports/impl-IMP-102.md`.
Diff: `src/domain/nextUp.ts` (new), `src/domain/nextUp.test.ts` (new),
`src/features/today/TodayView.tsx`, `src/features/today/TodayView.test.tsx`.

**VERDICT: PASS with one minor a11y issue** (no acceptance-criterion failure).

---

## IMP-102 — "What's next" prefers timed, actionable occurrences

Criteria (`.improve/FEATURES.md:1640-1643`):

1. Banner never promotes an untimed item while a timed occurrence is pending today — **MET.**
   `selectNextUp` (`src/domain/nextUp.ts:22`) partitions pending occurrences by
   `hasTimeComponent(occ.start)`; the all-day branch is only reached when no timed
   occurrence survives filtering.
2. Non-actionable kinds (`note`) excluded or labelled — **MET.** `isActionableOccurrence`
   rejects `note` plus `done`/`cancelled` (`nextUp.ts:9-14`). Notes still render in the
   agenda list, only the banner excludes them.
3. All-day only → no implied time — **MET.** All-day branch returns the occurrence
   unchanged (date-only `start`); the banner only prints a clock when `start` contains
   `T` (`TodayView.tsx:150`).

Skeptical edge checks (task brief):

- **Past-time-today timed items:** not suppressed. When every timed occurrence is in the
  past, the fallback picks the most recently due one (`nextUp.ts:31`). A missed 09:00 task
  at 14:00 still headlines as "next" — defensible, since it is still `todo` (pending), and
  criterion 1 speaks of a "pending" timed item, not a future one. Behaviour is a design
  choice, not a defect.
- **Already-started / overdue timed item:** `start >= nowStamp` excludes it from
  "upcoming", so it lands in the fallback branch and is still shown — correct.
- **Completed/cancelled excluded:** covered by unit test and by `agenda` filter; a done
  item in the agenda cannot win the banner.
- **Ordering ties:** `upcoming` sorts by `start` only (stable), so equal timestamps keep
  input order — deterministic for a given input; acceptable. All-day ties break on
  `title` (`nextUp.ts:40`), so the all-day result is fully deterministic.
- **Timezones/dates:** uses `formatISODateTime(now)` (local `YYYY-MM-DDTHH:mm`) and
  `hasTimeComponent` from `src/lib/date.ts`; no `toISOString()`/UTC path. Minute-precision
  string comparison is valid because both sides share the same local format.

## IMP-103 — "+N more" affordance on truncated sections

Criteria (`.improve/FEATURES.md:1657-1659`):

1. Hidden rows get a `+N more` control that reveals them — **MET.** `MoreControl`
   (`TodayView.tsx:30-49`) toggles `+N more` ⇄ `Show less` per section; wired to Overdue,
   Bills due soon and Goal progress.
2. Badge count always equals reachable items — **MET.** Overdue uses `overdue.length`,
   Bills now uses the full `unpaidBills.length` (previously the already-capped
   `billsThisWeek.length`), Goals uses `goals.length`. Each is fully reachable via expand.
3. Verified for Overdue, Bills due soon, Goal progress — **MET** (unit + browser below).

### a11y issue (minor, not a criterion failure)

`MoreControl` renders a valid `<button type="button">` but **omits `aria-expanded`**.
The calendar's IMP-053 control it claims to mirror sets `aria-expanded={expanded}`
(`CalendarView.tsx:239,366`). So the expand/collapse state is not exposed to assistive
tech, and no test asserts it. Fix: add `aria-expanded={expanded}` (optionally
`aria-controls`). This is an inconsistency with the referenced pattern, not a breach of
the stated IMP-103 acceptance criteria.

---

## Gates (all run at HEAD, working tree = diff under review)

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS (0 warnings) |
| Tests | `npm run test` | PASS — 58 files / 594 tests |
| Format | `npm run format:check` | PASS |
| Build | `npm run build` | PASS (PWA `injectManifest`, `dist/sw.js` generated) |

## Browser verification (`npm run preview` @ 4173)

Fresh Playwright context (the MCP default context has IndexedDB disabled — `indexedDB`
was `undefined`), viewport 1280×800. SW registrations unregistered and all caches
deleted, then `about:blank` → real document load. Seeded 7 overdue tasks, 7 unpaid bills,
5 goals, 1 all-day note, 1 timed task (09:00). Preview server stopped after the run.

| Measurement | Before | After `+1 more` | After `Show less` |
| --- | --- | --- | --- |
| Overdue header | `Overdue7` | `Overdue7` | `Overdue7` |
| Overdue rows | 6 | 7 | 6 |
| Overdue control | `+1 more` (`aria-expanded` absent) | `Show less` | `+1 more` |
| Bills header / rows | `Bills due soon7` / 6 | — | — |
| Goals header / rows | `Goal progress5` / 4 | — | — |
| Banner | `What's next Timed task 09:00` | — | — |

Console errors in the fresh context: **0**. Banner correctly promotes the timed task over
the all-day note; badge counts (7/7/5) equal the reachable rows after expansion.

## Summary of findings

- IMP-102: correct; all three acceptance criteria met, dates/timezone handling via
  `src/lib/date.ts`, no source mutation, tests meaningful.
- IMP-103: correct; all three acceptance criteria met in unit and browser checks.
- Only defect: `MoreControl` lacks `aria-expanded` (a11y parity with IMP-053), untested.
  Non-blocking.
