# IMP-018 — Verification report

**Verdict: PASS** (3/3 acceptance criteria met; 1 non-blocking observation for the backlog)

Reviewed: working-tree diff vs `HEAD` (`2dc439d`) on `improve/auto-20261003`.
Nothing was committed. The only file I added is this report.

---

## 1. Change surface — diffed against every acceptance criterion

`git diff HEAD --stat` — **3 files, +43 / −2**:

| File | Δ | In scope? |
| --- | --- | --- |
| `src/domain/quickadd.ts` | +2 / −1 | yes — the whole behaviour change |
| `src/domain/quickadd.test.ts` | +40 / −1 | yes — new `describe('quickAddToItem')`, 4 cases |
| `.improve/PROGRESS.log` | +1 | bookkeeping (see note below) |

The production change is one statement, `src/domain/quickadd.ts:432-433`:

```ts
// A habit only makes sense as a series; default it to daily so streaks are computable.
item.recurrence = parsed.recurrence ?? (parsed.kind === 'habit' ? baseRule('daily') : null);
```

`baseRule` (`src/domain/quickadd.ts:73`) is the module's own factory, so the default is
shape-identical to a parsed `every day` rule: `{ freq:'daily', interval:1, weekStartsOn:1,
exceptions:[], overrides:{} }`. No new helper, no new file, no edit to `parseQuickAdd`,
`itemFactory`, the Dexie schema, the store, or any component.

### Acceptance criteria

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. `kind === 'habit'` + no parsed recurrence ⇒ daily, `interval: 1` | **MET** | §3 probe 1; repo test *"defaults a habit to a daily rule…"*; stored row in §5 |
| 2. An explicit recurrence is preserved | **MET** | §3 probes 2–3, 5; repo test *"keeps an explicit recurrence…"*; mutant B in §4 |
| 3. The habit shows today and expands for the coming week | **MET** | §3 probes 6–8 (real `expandOccurrences`); §5 Today + Calendar + Habits; screenshots |

### Scope creep / style / hygiene

- **Scope creep: none.** No file outside `quickadd.ts` / `quickadd.test.ts` is touched.
  No schema, migration, `itemActions`, repository, hook, store or UI edit.
- **Convention compliance** (REPO_PROFILE §5, AGENTS.md):
  - Persistence seam untouched — no Dexie in a feature, no `localStorage`, no new dates
    (`parsed.start` reused, never `toISOString()`).
  - Enums remain lowercase slugs (`'daily'`, `'habit'`); no display copy added.
  - No styling, so no token/a11y/light-dark surface. Nothing to regress there.
  - Dependency direction respected: the change stays inside `src/domain/`.
  - The single comment explains non-obvious **intent** ("a habit only makes sense as a
    series") rather than restating the code — allowed by AGENTS.md, not a violation.
  - No new import needed; `baseRule` is module-local. No dependency added.
- **Debug leftovers: none.** No `console.*`, no `debugger`, no `.only`, no commented-out
  code, no `TODO`/`FIXME`, no stray temp files (`git status --short` is exactly the 3
  modified + 2 untracked reports + `.kilo/`).
- **Secrets: none.** No key, token, URL with credentials, or `.env` reference anywhere in
  the diff. `GEMINI_API_KEY` was never printed.
- **Note (non-blocking, not a defect):** the one added `.improve/PROGRESS.log` line records
  commit `2dc439d` for `IMP-017-BLOCKED`, i.e. it belongs to the previous item rather than to
  IMP-018. Harmless bookkeeping, correctly placed in the log. It does not alter the 4-gate
  result.

---

## 2. CRITICAL — no trace of the blocked IMP-017 work reintroduced

**CONFIRMED CLEAN.** The diff only adds the habit-recurrence default.

1. `git diff HEAD --name-only` → exactly three paths: `.improve/PROGRESS.log`,
   `src/domain/quickadd.test.ts`, `src/domain/quickadd.ts`. **Nothing else.**
2. `src/domain/quickadd.ts` is `+2 / −1`; the only behavioural line is `:433`. The whole
   parse path (`parseQuickAdd`, `baseRule`, `TIME_OR_DATE_PREP`, `removeExpression`,
   title cleanup at `:337-340`) is **byte-identical to `HEAD`** — the diff hunk starts at
   `:429`, inside `quickAddToItem`, after `createItem`.
3. Forbidden identifiers absent repo-wide:
   - `rg -n "trimDanglingTail" .` → **0 matches / 113 files searched**
   - `rg -n "extractedDateOrTime" .` → **0 matches**
   - `rg -n -i "preposition|\bat$|\bin$|\bon$|\bfor$|\bto$" src/domain/quickadd.ts`
     → **0 matches** — no trailing-preposition trimming logic of any shape.
4. Behavioural proof that nothing was *fixed* or *re-added* — the two IMP-017 defect
   signatures still behave exactly as at `HEAD`:
   | input | title at this tree |
   | --- | --- |
   | `dentist on 3pm` | `"Dentist on"` (trailing preposition **kept** ⇒ no `trimDanglingTail`) |
   | `Call dentist at ,` | `"Call dentist at ,"` |
   | `Log in 3pm` | `"Log in"` |
   | `Look at 3pm` | `"Look at"` |
   | `Check in tue` | `"Check in"` |
5. The preceding commit `2dc439d` ("mark IMP-017 blocked") contains **no `src/` hunk**
   (`git show 2dc439d -- src/` is empty); it only touched `FEATURES.md`, `PROGRESS.log`,
   `STATE.md` and added `verify-IMP-017.md`. So the tree I reviewed is the restored HEAD
   tree plus this item's one-line default.

---

## 3. Semantics — independent probes

I wrote a throwaway Vitest file (`src/domain/zz-verify-imp018.test.ts`, **deleted
afterwards** — `git status` is clean of it) that drives the real `parseQuickAdd` →
`quickAddToItem` → `expandOccurrences` chain rather than trusting the shipped tests.
**10/10 passed:**

| # | Assertion | Result |
| --- | --- | --- |
| 1 | `habit: meditate` ⇒ full rule `toEqual({freq:'daily', interval:1, weekStartsOn:1, exceptions:[], overrides:{}})`, `start === '2026-10-05'` | pass |
| 2 | `habit: stretch every 3 days` ⇒ `freq:'daily'`, `interval:3` (not overwritten) | pass |
| 3 | `habit: gym mon/wed/fri` ⇒ `freq:'weekly'`, `byWeekday:[1,3,5]` | pass |
| 4 | non-habits with no recurrence stay `null`: `write report`, `pay rent 5th`, `buy milk`, `event: standup` | pass |
| 5 | non-habit **with** explicit rule keeps it: `standup every day` ⇒ `freq:'daily'` | pass |
| 6 | `expandOccurrences` over `2026-10-05 … 2026-10-11` ⇒ exactly `['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']` | pass |
| 7 | start defaults to **today** (`2026-10-05T23:30` ⇒ `start '2026-10-05'`) and today yields exactly 1 occurrence ⇒ shows immediately | pass |
| 8 | `habit: meditate tomorrow` ⇒ `start '2026-10-06'`, 0 occurrences on `2026-10-05` (no phantom back-dating) | pass |
| 9 | habit payload intact: `data.target = {count:1, per:'day'}`, `data.streak = {current:0, best:0, lastAt:null}` | pass |
| 10 | IMP-017 defect signatures unchanged (§2 table) | pass |

No `toISOString()`, no off-by-one, no month-end interaction (daily rule is immune).

---

## 4. Gates (all four, run on the exact restored tree)

```
npm run typecheck   → tsc --noEmit, no diagnostics           exit 0
npm run lint        → eslint ., no output                    exit 0
npm run test        → Test Files 26 passed / Tests 222 passed  (baseline 218, +4 new)
npm run build       → ✓ built in 2.07s · precache 18 entries (607.35 KiB) · dist/sw.js
```

Benign pre-existing warning only: `--localstorage-file was provided without a valid path`.
`dist/` is untracked, so the build dirtied nothing. **No regression.**

---

## 5. MUTATION-CHECK — the new tests really detect the change

Applied two mutants to `src/domain/quickadd.ts:433` (restored afterwards; the file's diff
hash was verified identical to the pre-mutation state, and §4 was re-run green).

**Mutant A — remove the fallback** (`item.recurrence = parsed.recurrence;`)

```
npx vitest run src/domain/quickadd.test.ts
  × quickAddToItem > defaults a habit to a daily rule so it recurs from today
  × quickAddToItem > expands a quick-added habit across the coming week
  Tests  2 failed | 21 passed (23)
```
Plus on my independent file: `Tests 2 failed | 8 passed (10)` (full rule shape + week
expansion). **The fallback removal is caught.**

**Mutant B — kind-agnostic overwrite** (`item.recurrence = baseRule('daily');`)

```
  × quickadd.test.ts > quickAddToItem > keeps an explicit recurrence from the input
  × quickadd.test.ts > quickAddToItem > leaves other kinds without a recurrence
  × zz-verify  > explicit every 3 days preserved exactly
  × zz-verify  > explicit weekday list preserved
  × zz-verify  > non-habit kinds keep null recurrence
  Tests  5 failed | 28 passed (33)
```
**AC 2 and the non-habit isolation are pinned too** — the change is not merely
"add something", it is `?? default-if-habit` exactly.

The two mutants are complementary, so all three acceptance criteria have a detector.

---

## 6. VISUAL — Playwright (`npm run preview`, :4173, dark theme, system default)

Pre-step (necessary, worth recording): the first load was served from the **stale
service-worker precache**. I unregistered the SW and deleted
`workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/` before testing, so all
observations below are against the current bundle. This matches the note already in
`impl-IMP-018.md §4`.

1. Today → **Quick add** → `habit: journal`. Dialog preview: Title `Journal`, chips
   `habit` / `2026-10-05`, Kind `Habit`, Date `2026-10-05` → **Add**. Toast `Added “Journal”`.
2. **Persisted row** (read straight out of IndexedDB `items`):
   ```json
   { "title":"Journal","kind":"habit","start":"2026-10-05","allDay":true,
     "recurrence":{"freq":"daily","interval":1,"weekStartsOn":1,"exceptions":[],"overrides":{}},
     "target":{"count":1,"per":"day"},"streak":{"current":0,"best":0,"lastAt":null} }
   ```
3. **Today** — `Today's agenda` 3 → **4**, containing `Journal` with a `Daily` badge and a
   `Mark as done` checkbox; `Habits 1 → 2` with `Journal 0 day streak · best 0`.
4. **Habits** — `Journal` row with the **streak control** `Complete today` (○), `1× per day`,
   `0 day streak` / `Best 0`, Mon–Sun week strip and a completion heatmap.
   Clicking `Complete today` ⇒ `✓`, `Undo today`, **streak 0 → 1**, `Best 0 → 1`, and
   Today's agenda `1/4 done · 25%`. The streak/done-today behaviour the item exists to fix
   now works end-to-end.
5. **Expansion for the week (and beyond)** — Calendar, Month, October 2026: `Journal`
   appears on **28 consecutive days, 2026-10-05 → 2026-11-01**. Negative control: the
   pre-existing `Drink water` habit (`recurrence: null`, `start: 2026-10-04`) appears on
   **exactly 1** day. Confirms the default is applied to quick-added habits only.
6. **Console: 0 messages** for the entire session (queried before and after every step).
7. **Screenshots** → `.improve/artifacts/IMP-018/`:
   | file | width | content |
   | --- | --- | --- |
   | `1280-today-habit-quickadd.png` | 1280 | Today, `Journal` in agenda with `Daily` badge + Habits panel |
   | `1280-habits.png` | 1280 | Habits view, `Complete today` + streak badges |
   | `1280-calendar-expansion.png` | 1280 | Month grid, Journal on every day Oct 5 → Nov 1; `Drink water` only Oct 4 |
   | `390-habits.png` | 390 | Habits at mobile width, completed `Journal` with green ✓ and `1 day streak` |
   | `390-today.png` | 390 | Today at mobile width, `Journal ✓ Daily` struck through, `1/4 done · 25%` |
8. **Cleanup:** the probe habit was deleted from the browser's IndexedDB (raw read-write
   transaction); remaining habits are back to the seeded `Drink water` only. Preview server
   stopped, browser closed, `.playwright-mcp/` scratch removed.

---

## 7. Findings

### Blocking
**None.** All three acceptance criteria are met, all four gates pass, the mutation check
proves the new tests detect the change, and the UI behaves correctly at 1280 px and 390 px
with zero console messages.

### Non-blocking, for the backlog (not a regression, not caused by the diff)

1. **Today-screen duplication, now more visible (low).** A quick-added habit renders twice
   on Today — once as `Journal ✓ Daily` inside `Today's agenda` and once in the `Habits`
   panel. Pre-existing composition; the daily default just gives the agenda copy a visible
   recurrence badge. Already noted in `discovered-IMP-018.md`.
2. **Quick-add preview chips omit the default (low).** Because the default is applied in
   `quickAddToItem` (the commit boundary) and not in `parseQuickAdd`, the dialog chips show
   only `habit` / `2026-10-05` and no `Daily` chip, even though the item will get a daily
   rule. The author chose this deliberately and defended it well: a parse-time default would
   attach "Daily" to a kind the user then changes in the dialog, and `QuickAdd.tsx` keeps
   `item.recurrence` when Kind is edited. Correct trade-off, but the preview slightly
   under-reports what will be written. Already noted in `discovered-IMP-018.md §1`.
3. **NEW, surfaced by this change (low, pre-existing bug in `HabitsView.tsx`).** The habit
   heatmap window never includes today. `HabitsView.tsx:33-43` sets
   `windowStart = startOfWeek(addDays(new Date(), -(DAYS - 1)), weekStartsOn)` and then
   draws `DAYS` cells **forward** from it. Measured in the browser: 84 cells spanning
   `2026-07-13 … 2026-10-04`, i.e. it ends **yesterday**. Consequence after completing
   `Journal` today: streak badge says `1 day streak` but the heatmap shows **zero** filled
   cells, while the older `Drink water` (completed 2026-10-04) does show a green cell.
   IMP-018 does not touch this file and the defect exists at `HEAD`; the fix merely makes
   every quick-added habit land in the missing day. Worth its own backlog item — the window
   should end on today.
4. **No back-fill (informational).** Habits created before this change keep
   `recurrence: null` and still exist on one day only; the seeded `Drink water` is the
   visible proof. The item did not ask for a migration and adding one would be scope creep.

---

## 8. Verdict

**PASS.** Ship it. Keep the one-line `??` default as written; it is the minimal correct
change, the new tests have real detection power in both directions, and no blocked IMP-017
material came back with it.