# VERIFY — IMP-012 "Show the occurrence time on item cards, not the series start"

**Verdict: PASS** (3/3 acceptance criteria met; 2 non-blocking findings + 1 process gap)

Reviewer: independent verifier (did not write the change). Branch `improve/auto-20261003`,
HEAD `9ccb94f`, change is uncommitted working-tree state.

---

## 1. Diff review against every acceptance criterion

`git diff --stat` (tracked files):

```
 .improve/PROGRESS.log                  | 1 +
 src/features/calendar/CalendarView.tsx | 1 +
 src/features/item/ItemCard.tsx         | 7 +++++--
 src/features/today/TodayView.tsx      | 1 +
 4 files changed, 8 insertions(+), 2 deletions(-)
```

Untracked (new): `src/features/item/cardTime.ts`, `src/features/item/ItemCard.test.tsx`,
`.improve/reports/{discovered,impl}-IMP-012.md`.

The entire source change is 4 hunks / 8 added lines:

| Location | Change |
|---|---|
| `ItemCard.tsx:17` | new prop `start?: string \| null` + one-line doc comment |
| `ItemCard.tsx:31` | prop destructured |
| `ItemCard.tsx:51` | `formatTime(item.start)` → `resolveCardTime(start, item.start)` |
| `TodayView.tsx:167` | `start={occ.start}` |
| `CalendarView.tsx:270` | `start={occ.start}` (inside `AgendaList`) |

### AC1 — `ItemCard` renders the resolved occurrence start when supplied, else `item.start`

**Met.** `src/features/item/cardTime.ts:7-11` is a pure helper:
`formatTime(occurrenceStart ?? itemStart)`. `??` keys on *presence*, not truthiness, which
matches "when supplied"; `formatTime` (`src/lib/date.ts:124`, signature
`string | null | undefined`) already returns `''` for date-only values, so an all-day
occurrence shows no clock label rather than inheriting the series time. Unit-pinned by
`ItemCard.test.tsx:54-68`.

### AC2 — a recurring item moved via `updateOccurrence` shows the moved time on Today and Calendar

**Met (display contract), verified in the browser.** `updateOccurrence`
(`src/domain/itemActions.ts:202-217`) is the *only* writer of a moved occurrence and it
writes exactly `recurrence.overrides[occKey].start` — the same field my fixture seeded, so
the browser check exercises the identical data shape. See §5 for the browser evidence and
§6 for the one interactive step (drag) that Playwright could not drive.

### AC3 — no visual regression for non-recurring items

**Met.** Non-recurring items resolve `occ.start === item.start` (asserted in
`ItemCard.test.tsx:105`), so their cards are unchanged. Verified in the browser for
`Pay invoice` (`item.start = 2026-10-04T11:15`) on Today, Calendar day agenda, Calendar
month cell and Matrix — all show `11:15`.

### Caller-threaded check (all `ItemCard` call sites)

`grep -rn "ItemCard" src` → exactly three consumers:

| Call site | Holds an occurrence? | `start` passed? | Renders |
|---|---|---|---|
| `src/features/today/TodayView.tsx:163` | yes (`todays` from `useOccurrences`) | **yes**, `occ.start` | resolved occurrence time |
| `src/features/calendar/CalendarView.tsx:266` (`AgendaList`, day + week modes) | yes | **yes**, `occ.start` | resolved occurrence time |
| `src/features/matrix/MatrixView.tsx:83` | no (plain `itemsInQuadrant(item)`) | no → falls back to `item.start` | series anchor 09:00 |

No occurrence-holding caller is missed, and the one non-occurrence caller falls back
correctly (Matrix showed `Review sync 09:00 Daily` while the same series showed `16:30`
on Today — see `matrix-1280.png`). Views that list occurrences with their own inline
`formatTime(occ.start)` (Calendar month grid, year month cards) were deliberately left
alone; they never used `ItemCard` and were already correct. That is in-scope discipline,
not scope creep.

### Prop name/type vs the item note

Note: *"Prefer a `start?: string` prop over prop-drilling the whole occurrence."*
Implemented as `start?: string | null` (`ItemCard.tsx:17`). `Occurrence.start` is
`string | null` (`src/types/recurrence.ts:143`) and `Item.start` is `string | null`
(`src/types/item.ts:43`), so `| null` is the correct widening — callers can pass
`occ.start` directly with no assertion. Name and shape match the note; only the occurrence
is *not* prop-drilled, exactly as instructed.

### Style / hygiene / secrets

- **Scope creep:** none. No refactors, no renames, no drive-by edits.
- **Unrelated changes:** none in `src/`. One caveat in §7 (`.improve/PROGRESS.log`).
- **Debug leftovers:** none. `grep -niE "console\.(log|debug|warn)|debugger|TODO:|FIXME|XXX"`
  over both new files → no matches.
- **Secrets:** `git diff | grep -niE "api[_-]?key|secret|token|password|Bearer|sk-[a-z0-9]"`
  → no matches. No `.env*` touched, no lockfile touched, no `dist/` committed.
- **Conventions (AGENTS.md / REPO_PROFILE §5):**
  - No direct Dexie / `localStorage` introduced; no new mutation paths.
  - `resolveCardTime` lives in `features/item/` and only imports the `lib` leaf
    (`@/lib/date`) — layered direction respected.
  - New module is a sibling of its only consumer, not a UI primitive misplacement.
  - Comments: 1 doc comment on the prop + 1 JSDoc on the helper. Both state non-obvious
    intent (what `start` means / why the helper exists), which AGENTS.md allows.
  - Styling untouched → no hardcoded colours, dark mode unaffected.
  - `npx prettier --check` on all 5 touched files → *All matched files use Prettier code
    style!*
- **New test file** follows the existing jsdom + `createRoot` + `act` + `DndContext` pattern
  from `NotesView.test.tsx`, uses `// @vitest-environment jsdom`, and calls `db.delete()`
  in `afterAll`.

---

## 2. Gates (all four, in the documented order)

```
$ npm run typecheck   → tsc --noEmit, no diagnostics           exit 0
$ npm run lint        → eslint ., no output, no new warnings   exit 0
$ npm run test        → Test Files 21 passed (21)
                        Tests      140 passed (140)             12.99s
$ npm run build       → ✓ built in 2.78s
                        dist/sw.js emitted, precache 18 entries (603.55 KiB)
```

Matches the baseline expectation (REPO_PROFILE §3: no command failures) and the
implementer's claim of 21 files / 140 tests. No new warnings from `eslint` (the
`react-refresh/only-export-components` issue that motivated the separate `cardTime.ts`
module is genuinely resolved).

---

## 3. MUTATION-CHECK (required)

Reverted the fix in `src/features/item/ItemCard.tsx:51`:

```diff
-  const time = resolveCardTime(start, item.start);
+  const time = resolveCardTime(undefined, item.start);
```

`npx vitest run src/features/item/ItemCard.test.tsx`:

```
 ❯ src/features/item/ItemCard.test.tsx (6 tests | 1 failed) 53ms
   × shows the overridden time of a moved occurrence

 FAIL  … > shows the overridden time of a moved occurrence
 AssertionError: expected 'Standup 09:00 Weekly\n    To pick up …' to contain '16:30'
 Tests  1 failed | 5 passed (6)
```

Exactly the moved-occurrence test fails, and it fails for the right reason (the card
renders the series anchor `09:00`). The other five keep passing, so the suite pins the
behaviour rather than the plumbing. File restored; `grep` confirms
`resolveCardTime(start, item.start)` is back.

**Second, extra mutation (caller wiring).** I also deleted `start={occ.start}` from *both*
`TodayView.tsx` and `CalendarView.tsx`:

```
$ npm run test  →  Test Files 21 passed (21) / Tests 140 passed (140)
```

So the wiring is **not** covered by any automated test — the unit tests exercise `ItemCard`
directly. Both caller files were restored byte-for-byte (`git diff --stat` back to
`4 files changed, 8 insertions(+), 2 deletions(-)`; suite green again). See §7.

---

## 4. Browser setup (why the numbers below are discriminating)

The impl report warns that a stale service worker serves the old bundle. I hit the same
trap from a different angle and want it recorded:

1. `getRegistrations().unregister()` + `caches.keys()` → deleted (1 SW, 1 cache), then
   `indexedDB.deleteDatabase('eisenmatrix')`. The delete was `blocked` while the app held
   its connection, so the app kept rendering stale in-memory data.
2. **`page.goto()` to a URL that differs only in hash (`#/matrix` → `#/today`) is a
   same-document navigation — it does NOT reload.** Two of my early snapshots were
   byte-identical (same `ref=e2…e175` tree) because the document never reloaded. Any
   verifier comparing snapshots must force `location.reload()`.
3. Raw `indexedDB.open('eisenmatrix')` with no version then created a **store-less v1
   database** while the app was still attached to the deleted one; the app only rebuilt
   its schema (v10) after a genuine reload. Avoid raw opens, or reload right after.

Fixture (written straight into `items`, then `location.reload()`), designed so that the
series anchor and the occurrence time **differ** — otherwise Matrix and Today would look
identical whether or not the fix works:

| id | title | `item.start` (series anchor) | recurrence | override |
|---|---|---|---|---|
| `verify-imp012-series` | Review sync | `2026-09-28T09:00` | daily/1 | `2026-10-04` → `2026-10-04T16:30` |
| `verify-imp012-single` | Pay invoice | `2026-10-04T11:15` | none | — |

Preview served `http://localhost:4173/eisenmatrix-calendar/` (port 4173 per REPO_PROFILE
§2), built from the working tree *after* the mutations were restored.

---

## 5. Visual results

| Surface | Expected | Observed (DOM text) | Screenshot |
|---|---|---|---|
| Today → Today's agenda | occurrence `16:30` | `Review sync 16:30 Daily` | `today-1280.png`, `today-390.png` |
| Today → non-recurring card | `11:15` | `Pay invoice 11:15` | same |
| Calendar → day agenda (`AgendaList`) | occurrence `16:30` | `Review sync 16:30 Daily` | `calendar-day-agenda-1280.png`, `calendar-day-agenda-390.png` |
| Calendar → week (Oct 4 cell) | occurrence `16:30` | `16:30Review sync` | `calendar-week-1280.png` |
| Calendar → month (Oct 4 cell) | occurrence `16:30` | `16:30Review sync` (+ `11:15Pay invoice`) | `calendar-month-1280.png` |
| Calendar → **non-overridden** occurrences of the same series | `09:00` | `09:00Review sync` on Sep 28 – Oct 3 and Oct 5 – Nov 1 | `calendar-week-1280.png`, `calendar-month-1280.png` |
| Matrix (no `start` prop) | series anchor `09:00` | `Review sync 09:00 Daily` | `matrix-1280.png` |

The decisive pair is **Today/Calendar = 16:30 while Matrix = 09:00 for the same series**:
only a resolved-occurrence-aware card can produce that. A bundle without the fix would
render `09:00` everywhere. The 09:00 cells on every other day additionally confirm the
fallback still resolves per occurrence rather than being globally shadowed.

Viewports: 1280×900 and 390×844. All seven PNGs in `.improve/artifacts/IMP-012/`:

```
calendar-day-agenda-1280.png  calendar-day-agenda-390.png  calendar-month-1280.png
calendar-week-1280.png        matrix-1280.png              today-1280.png
today-390.png
```

**Console: zero messages.** `playwright_browser_console_messages` returned `[]` after the
Today → Calendar (month/day/week) → Matrix tour at both viewports — no errors and no
warnings (the single `Another connection wants to delete database` warning came from my
own `deleteDatabase` call in §4, before the tour, and is not present afterwards).

Seeded rows deleted afterwards (`itemsRemaining: 0`), so no residue for the next verifier.

---

## 6. Inconclusive step (disclosed, not blocking)

AC2 names `updateOccurrence` specifically. Its only caller is the drag handler
(`AppShell.tsx:78-87`), and I could not drive it: `playwright_browser_drag` from the
`16:30 Review sync` chip to the Oct 3 cell left IndexedDB byte-identical (overrides still
just `{'2026-10-04': {start: '2026-10-04T16:30'}}`). The app configures
`PointerSensor` with `activationConstraint: { distance: 6 }` (`AppShell.tsx:49`) and the
MCP exposes only `dragTo`, which does not emit the intermediate pointermove sequence
dnd-kit needs. No side effects from the attempt.

Why the seeded fixture is a faithful stand-in: `updateOccurrence` writes
`recurrence.overrides[occKey].start` and nothing else (`itemActions.ts:212-216`) — byte-for-byte
the field the fixture set — and the browser then proves that field reaches the card through
`Occurrence.start`. What remains unverified by *interaction* is only the drag gesture
itself, which is untouched by this diff.

Side observation from reading that handler (pre-existing, out of scope, **not** a regression
from this change): a date-drag computes `timeOfDay` from `item.start`, so dragging a
moved 16:30 occurrence to another day writes an override of `<newDate>T09:00` — the series
time, not the occurrence's 16:30. Worth a separate backlog item; do not fold it into IMP-012.

---

## 7. Findings

### Blocking
None.

### Non-blocking / actionable

1. **Caller wiring has no automated coverage.** Deleting `start={occ.start}` from both
   callers leaves the suite at 140/140 (§3). The item's own verification method says
   "Unit-assert the derived time string (extract a pure helper) **and** Playwright" — the
   Playwright half is currently the only thing standing between a future refactor and a
   silent regression of exactly this bug. Cheap fix: one assertion that `TodayView`'s
   agenda card renders `occ.start` (or a shared `AgendaList`/Today test) so AC2 is
   enforced by CI, which currently runs no lint/test gate at all.
2. **`.improve/FEATURES.md` still says `Status: TODO` for IMP-012** (line 206) while the
   ten preceding implemented items are `DONE`, and there is **no** `PROGRESS.log` line for
   IMP-012. The impl report states this was deliberate pending verification; now that
   verification is PASS, whoever commits should flip the status and append the
   `PROGRESS.log` entry (the documented convention is "appended immediately after each
   commit with the resulting SHA"). I did not edit either file.
3. **Unrelated change sitting in the working tree:** `.improve/PROGRESS.log` has an
   uncommitted `IMP-011 | done | 9ccb94f` line — bookkeeping belonging to the *previous*
   item, not to IMP-012. Harmless and consistent with the convention (log after commit), but
   confirm it is intended to ride along in the IMP-012 commit rather than being folded
   into `9ccb94f`'s follow-up.

### Explicitly out of scope (correctly not fixed here)

`discovered-IMP-012.md` findings stand: (a) `updateRecurring` scope `occurrence` writes the
*series* date into the override and mutates `item.start`
(`itemActions.ts:253` — `patchItem(item.id, { ...patch, … })` where `patch.start` is the
draft's start); (b) `ItemEditorSheet` crashes on rows with no `data` payload; (c) the
stale-SW / same-hash-navigation traps in §4. Folding any of these into IMP-012 would have
been scope creep; the implementer correctly left them out.

---

## 8. Commands run

```
npm run typecheck && npm run lint && npm run test && npm run build   # all exit 0
npx vitest run src/features/item/ItemCard.test.tsx                   # mutation: 1 failed | 5 passed
npm run test                                                         # mutation (caller wiring): 140 passed  ← gap
npx prettier --check <5 touched files>                               # clean
git diff --stat / git status --porcelain                             # tree restored, nothing committed
npm run preview (port 4173) + Playwright MCP                         # stopped after verification
```

Nothing was committed. Only `.improve/reports/verify-IMP-012.md` and the seven screenshots
under `.improve/artifacts/IMP-012/` were added.