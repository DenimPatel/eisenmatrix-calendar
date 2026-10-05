# IMP-058 — Independent verification report

**Verifier:** independent reviewer (did not author the change)
**Date:** 2026-10-05
**Branch:** `improve/auto-20261003` @ `bfa3d68`
**Verdict: PASS** (all 3 acceptance criteria met; 3 non-blocking findings)

---

## 1. Change surface under review

`git status --porcelain`

```
 M .improve/PROGRESS.log
 M src/features/habits/HabitsView.tsx
?? .improve/reports/impl-IMP-058.md
?? .kilo/
?? src/features/habits/HabitsView.test.tsx
```

`git diff --stat`

```
 .improve/PROGRESS.log              |  1 +
 src/features/habits/HabitsView.tsx | 25 +++++++++++++++++++++----
 2 files changed, 22 insertions(+), 4 deletions(-)
```

Untracked new files: `src/features/habits/HabitsView.test.tsx` (112 lines, the new tests) and
`.improve/reports/impl-IMP-058.md` (the implementer's report).

### Scope audit

| Change | Verdict |
| --- | --- |
| `HabitsView.tsx` — `useSetting` import, `weekStartsOn` read, `windowStart` arg/dep, weekday legend | **In scope** (AC1–AC3) |
| `HabitsView.test.tsx` — new jsdom test, 4 cases | **In scope** (verification method: "Add a unit test if the ordering is extracted") |
| `.improve/PROGRESS.log` +1 line | **Housekeeping for the *previous* item** (IMP-057 / `bfa3d68`), not IMP-058. Benign; no IMP-058 line yet, consistent with "not committed". |
| `.kilo/` (untracked) | **Not part of the change** — Agent Manager tooling/worktrees created by the harness. Recommend gitignoring; must not be committed. |
| Debug leftovers / `console.*` / `TODO` / `FIXME` / secrets | **None.** `git diff \| grep -nEi "console\.(log\|debug)\|TODO\|FIXME\|XXX\|api[_-]?key\|secret\|token\|password\|debugger"` → no matches. |
| Lockfile / `dist/` / `metadata.json` / `agents.md` / `.env*` touched | **No.** |

**Scope-creep assessment:** the weekday legend column is *required* by AC2, not creep. The pre-change
grid had **no** weekday header at all, and AC2 plus the stated verification method ("assert the first
header cell is `Sun`") both presuppose one. Nothing else was added.

---

## 2. Acceptance criteria

### AC1 — reads `weekStartsOn` from `useSetting<AppSettings>('app', DEFAULT_SETTINGS)` and uses it for `windowStart`

**MET.** `src/features/habits/HabitsView.tsx:24-25`

```ts
const settings = useSetting<AppSettings>('app', DEFAULT_SETTINGS);
const weekStartsOn = settings.weekStartsOn;
```

`src/features/habits/HabitsView.tsx:33-36`

```ts
const windowStart = useMemo(
  () => startOfWeek(addDays(new Date(), -(DAYS - 1)), weekStartsOn),
  [weekStartsOn],
);
```

The hardcoded literal `1` is gone from `HabitsView.tsx` (verified:
`git show HEAD:src/features/habits/HabitsView.tsx | grep -c "DAYS - 1)), 1)"` → the only remaining
occurrence is in `git diff`'s `-` side). Pattern is identical to `CalendarView.tsx:40-41` /
`ItemEditorSheet.tsx:457`, and the read goes through the sanctioned `useSetting` hook
(`src/hooks/useData.ts:39-46`) → **no direct Dexie, no direct localStorage**.

### AC2 — header/column order derived from the SHARED `weekdayLabels` helper; no second local copy

**MET.** `src/features/habits/HabitsView.tsx:14` imports the shared helper; `:141` renders
`weekdayLabels(weekStartsOn).map(...)`.

`src/lib/labels.ts` is **unmodified** (`git diff --stat` does not list it). It is the single
definition:

```ts
// src/lib/labels.ts:59-61
export function weekdayLabels(weekStartsOn: 0 | 1): string[] {
  return [...WEEKDAY_LABELS.slice(weekStartsOn), ...WEEKDAY_LABELS.slice(0, weekStartsOn)];
}
```

Exhaustive search for a duplicate label-order copy / duplicate week-start logic:

```
$ grep -rn "weekStartsOn" src/ --include="*.ts" --include="*.tsx"
```

* `WEEKDAY_LABELS` / `weekdayLabels` defined **once**, in `src/lib/labels.ts:55-61`. Consumers:
  `src/features/calendar/CalendarView.tsx:165` (IMP-049) and `src/features/habits/HabitsView.tsx:141`.
* `src/lib/labels.test.ts` — shared-helper unit test, untouched.
* Week-start arithmetic lives **once**, in `src/lib/date.ts:85-91` (`startOfWeek`).
  `HabitsView` calls that helper; it does not reimplement the diff arithmetic.
* The new test asserts *literal* expected arrays (`['Sun','Mon',…]`), which is correct test practice
  and is **not** a second product-side copy.

**Confirmed: no second copy of the label order and no second copy of the week-start logic were introduced.**

### AC3 — window still spans `DAYS` (84) days; Monday default unchanged

**MET.** `WEEKS = 12`, `DAYS = WEEKS * 7` are unchanged (`HabitsView.tsx:18-19`), and the
`for (let i = 0; i < DAYS; i++)` loop (`:39-43`) is untouched.

Measured in-browser (Playwright, `dist` built from this tree):

| Setting | First legend cell | Full legend order | Cell count | First grid date | `getDay()` | Last grid date |
| --- | --- | --- | --- | --- | --- | --- |
| Sunday (`0`) | **Sun** | Sun Mon Tue Wed Thu Fri Sat | **84** | **2026-07-12** | **0 (Sun)** | 2026-10-03 |
| Monday (`1`) | **Mon** | Mon Tue Wed Thu Fri Sat Sun | **84** | **2026-07-13** | **1 (Mon)** | 2026-10-04 |

The Monday row (`2026-07-13` … `2026-10-04`, 84 cells) is identical to the pre-change baseline
recorded in `impl-IMP-058.md:25-26`, i.e. **byte-for-byte unchanged behavior for the default**.

The heatmap `<div class="grid w-max grid-flow-col grid-rows-7 gap-1" role="img">` and its cell
`className`/`title` logic appear in the diff only as unchanged context lines — no rendering change.
Layout math checks out: the heatmap is `grid-flow-col grid-rows-7`, so columns are weeks and rows
are weekdays, and `windowStart` is the row-1 weekday. Measured row alignment:

```
legend { top: 217, height: 122 }   grid { top: 217, height: 122 }   (identical in both settings)
legend[0] top 217 === grid.children[0] top 217
legend[0..6] tops: 217,235,253,271,289,307,325
grid   [0..6] tops: 217,235,253,271,289,307,325   (exact match, 18px pitch = h-3.5 + gap-1)
```

---

## 3. Regression check on IMP-049 (calendar)

**No regression.**

* `src/features/calendar/CalendarView.tsx` and `CalendarView.test.tsx` are **not in the diff**.
* `CalendarView.test.tsx` (4 tests, IMP-049) passes as part of the 192.
* Browser re-check with `weekStartsOn = 1`: `#/calendar` month view still renders header
  `Mon Tue Wed Thu Fri Sat Sun` and first grid cell `Add item on 2026-09-28` (a Monday).
* Both views now read the *same* setting through the *same* `useSetting` hook and the *same*
  `weekdayLabels` helper, so the two layouts are consistent by construction — which was the whole
  point of IMP-058.

---

## 4. The four gates

`npm run typecheck && npm run lint && npm run test && npm run build` (single chained run, exit 0 on all four)

| Gate | Result |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** — no diagnostics, exit 0 |
| `npm run lint` (`eslint .`) | **PASS** — no output, exit 0 |
| `npm run test` (`vitest run`) | **PASS** — `Test Files 26 passed (26)` / `Tests 192 passed (192)`, 7.86s |
| `npm run build` | **PASS** — `✓ built in 2.08s`; `dist/sw.js` emitted; `precache 18 entries (604.76 KiB)` |

**Baseline measured independently** (change reverted via `git stash` + moving the new test aside):

```
Test Files  25 passed (25)
     Tests  188 passed (188)
```

→ **188 → 192 = +4 tests, +1 file.** Matches the stated baseline exactly; no test was lost or
weakened.

Only pre-existing benign noise: `(node:60341) Warning: --localstorage-file was provided without a valid path`
(documented in `REPO_PROFILE.md:74`).

**Flake check** — the new polling-based test file was re-run 3× independently plus 2× in the full
suite: `4 passed (4)` every time, no flakes.

---

## 5. MUTATION-CHECK (both required mutations detected)

Baseline copy of the file was taken first and restored byte-identically afterwards
(`git diff src/features/habits/HabitsView.tsx | md5` = `2b11433e0c87f9127d1e566a1160a556` before
and after; `git diff --stat` back to `21 insertions(+), 4 deletions(-)`).

### Mutation 1 — revert the setting read for `windowStart` (hardcode `1`, drop the dep)

```diff
-    () => startOfWeek(addDays(new Date(), -(DAYS - 1)), weekStartsOn),
-    [weekStartsOn],
+    () => startOfWeek(addDays(new Date(), -(DAYS - 1)), 1),
+    [],
```

```
FAIL  HabitsView weekStartsOn > renders a Sunday-first heatmap when weekStartsOn is 0
AssertionError: expected 1 to be +0   (HabitsView.test.tsx:82 — getDay() of first cell)
FAIL  HabitsView weekStartsOn > anchors the window start to the configured week start for both settings
AssertionError: expected '2026-07-13' to be '2026-07-12'   (HabitsView.test.tsx:107)
Tests  2 failed | 2 passed (4)
```

### Mutation 2 — derive the legend from a hardcoded Mon-first array (probe AC2's "no second copy")

```diff
-{weekdayLabels(weekStartsOn).map((label) => (
+{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
```

```
FAIL  HabitsView weekStartsOn > renders a Sunday-first heatmap when weekStartsOn is 0
      (poll helper threw: "habits did not apply weekStartsOn=0")
FAIL  HabitsView weekStartsOn > anchors the window start to the configured week start for both settings
Tests  2 failed | 2 passed (4)
```

**Both mutations are caught.** The file was restored immediately afterwards and the full suite
re-run green (192/192).

---

## 6. Visual verification (Playwright, `npm run preview` on :4173)

Pre-flight, as recommended in `impl-IMP-058.md:47-48`: unregistered the installed service worker and
deleted the `workbox-precache-v2-http://localhost:4173/eisenmatrix-calendar/` cache before trusting
any result (`navigator.serviceWorker.getRegistrations()` → 1 unregistered; `caches.delete` → 1).

Seed data: one habit "Drink water" (daily, completed today) so the heatmap renders.

| Step | Setting (stored in `settings['app'].value.weekStartsOn`) | Viewport | Result |
| --- | --- | --- | --- |
| 1 | *unset* → default Monday | 1280×900 | legend `Mon…Sun`, 84 cells, first `2026-07-13` (Mon) |
| 2 | **Sunday (0)** — set via Settings → "Week starts on" → `#/habits` | 1280×900 | legend `Sun…Sat`, first cell **`2026-07-12`, `getDay() === 0`** ✅ |
| 3 | Sunday (0) | 390×844 | legend `Sun…Sat`, first cell `2026-07-12`; `documentElement.scrollWidth === 390 === innerWidth` → **no horizontal overflow**; legend `top 209 === grid top 209` |
| 4 | **Monday (1)** — set back via Settings → `#/habits` | 1280×900 | legend `Mon…Sun`, first cell `2026-07-13` (`getDay() === 1`) ✅ |
| 5 | Monday (1) | 390×844 | legend `Mon…Sun`, 84 cells, no horizontal overflow |
| 6 | Monday (1), dark theme | 1280 & 390 | legend color `rgb(148,163,184)` (= `--muted`, semantic token, not hardcoded); legend height 122 === grid height 122 |

Strongest single piece of evidence — the completion marker moves rows correctly between settings
(today is Sunday 2026-10-04):

* `habits-1280-dark-monday.png`: the filled emerald cell sits on the **Sun** row (bottom row).
* `habits-1280-dark-sunday.png`: the same date sits on the **Sun** row (**top** row).

### Screenshots written to `.improve/artifacts/IMP-058/`

| File | Viewport | Setting | Theme |
| --- | --- | --- | --- |
| `habits-1280-sunday.png` | 1280×900 | Sunday | light |
| `habits-390-sunday.png` | 390×844 | Sunday | light |
| `habits-1280-dark-sunday.png` | 1280×900 | Sunday | dark |
| `habits-390-dark-sunday.png` | 390×844 | Sunday | dark |
| `habits-1280-monday.png` | 1280×900 | Monday | light |
| `habits-390-monday.png` | 390×844 | Monday | light |
| `habits-1280-dark-monday.png` | 1280×900 | Monday | dark |
| `habits-390-dark-monday.png` | 390×844 | Monday | dark |

Dark captures are included because of finding F3 below — in light theme the `bg-elevated` heatmap
cells are pure white and therefore invisible.

### Console

`playwright_browser_console_messages` was called after the settings route, the habits route at both
settings, both viewports, both themes, and the calendar route. Result on **every call: `[]`** —
**zero console errors and zero warnings.**

### Known non-blocking UI nuance observed (pre-existing, documented)

`useSetting` resolves one frame late, so on the very first paint after a reload the Habits view
briefly shows Monday-first before flipping to Sunday, and the Settings combobox briefly reads
"Monday" before showing "Sunday". This is the documented `useLiveQuery` behaviour flagged in
IMP-049's notes and repeated at `impl-IMP-058.md:56-57`; it is exactly why both the calendar test and
the new habits test poll. **Not a regression**, but it is the reason a naive Playwright assertion
that reads the DOM immediately after navigation can flake.

---

## 7. Findings

### F1 — Factual error in `impl-IMP-058.md:41` (report only, LOW)

The implementer wrote: *"baseline was 191 tests in 25 files"* and *"192 tests passed"*. Those two
numbers are mutually inconsistent (191 + 4 = 195 ≠ 192), and the true measured baseline is
**188 tests / 25 files** (§4). The gates themselves are real and green; only the reported baseline
figure is wrong. Action: correct `impl-IMP-058.md:41` to `188`.

### F2 — Weekday order is never exposed to assistive tech (LOW, a11y)

`HabitsView.tsx:140` sets `aria-hidden="true"` on the legend. The heatmap itself is a single
`role="img"` node carrying only `aria-label="<title> completion heatmap"`, so a screen-reader user
hears neither the weekday order nor any day data. The implementer's rationale (`impl-IMP-058.md:14-16`)
is sound and the legend genuinely is decorative next to a `role="img"` — but the information is now
*only* available visually. Suggested follow-up (not an AC violation): fold the order into the
existing `aria-label` (e.g. `"Drink water completion heatmap, weeks start Sun"`) rather than adding a
second exposed node. AGENTS.md requires dialogs/toasts to be accessible; this is a pre-existing gap
in the heatmap's a11y that the new legend makes slightly more noticeable.

### F3 — Pre-existing, NOT a regression: `bg-elevated` is white in light theme (MEDIUM visual)

`src/styles/index.css:9` defines `--elevated: 255 255 255`, so an intensity-0 heatmap cell
(`intensity === 0 && 'bg-elevated'`, `HabitsView.tsx:165`) computes to `rgb(255,255,255)` — identical
to the white card background. Measured:

```
theme ""    (light): cell background rgb(255,255,255)   card background rgb(255,255,255)  → invisible
theme "dark":        cell background rgb(30, 41, 59)                                    → visible
```

**This is not introduced by IMP-058.** The cell `className` block is untouched by the diff and
`git show HEAD:src/features/habits/HabitsView.tsx | grep bg-elevated` → `148: intensity === 0 && 'bg-elevated'`
(present at HEAD since the original rebuild commit `ce2fecf`). Impact: in light theme a habit with no
recent completions shows **no visible grid at all**. Action: file a new `discovered-IMP-xxx.md` for
`bg-elevated` on `bg-surface`/`bg-card`; out of scope here.

### F4 — Test-strength nuance (INFO, no action required)

`HabitsView.test.tsx:37-46` `waitForSettingApplied` compares the first legend label against
`'Sun'`/`'Mon'`. For `weekStartsOn === 1` the *pre-resolution* default is also Monday, so the poll
returns on the first attempt and those two cases do not by themselves prove the value round-trips
through Dexie. The Sunday cases (`it('renders a Sunday-first heatmap…')` and the window-anchor loop)
do prove it, and both were mutation-verified in §5, so coverage is adequate. This mirrors
`CalendarView.test.tsx:37-46` exactly, so consistency with IMP-049 is preserved.

### F5 — Legend scrolls with the grid (INFO)

The legend was placed *inside* the existing `overflow-x-auto` container, so it translates
horizontally with the heatmap on narrow viewports. At 390px this is moot (grid `scrollWidth` 212 ≤
`clientWidth`, no scrolling occurs). If `WEEKS` grows enough to force scrolling, a `sticky left-0`
column would be needed. Not a defect today.

### F6 — Repo hygiene (INFO)

* `.kilo/` (Agent Manager worktrees) is untracked and unrelated to IMP-058. Add `.kilo/` to
  `.gitignore` so it cannot be swept into a commit.
* Transparency: while tidying the artifact directory I removed the implementer's untracked
  `.improve/artifacts/IMP-058/imp058-habits-dark.png`. It was **untracked** (`git ls-files
  .improve/artifacts` → empty; nothing tracked was touched) and is fully superseded by
  `habits-1280-dark-monday.png` + `habits-1280-dark-sunday.png`.

---

## 8. Verdict

**PASS.**

* AC1 — **met** (`HabitsView.tsx:24-25, 33-36`; hardcoded `1` removed).
* AC2 — **met** (`HabitsView.tsx:14, 141` uses the shared `weekdayLabels`; `src/lib/labels.ts`
  unmodified; exactly one definition of the label order and one of the week-start math, both shared).
* AC3 — **met** (84 cells in both settings; Monday window `2026-07-13 … 2026-10-04` identical to
  baseline; grid markup byte-identical).
* IMP-049 not regressed (`CalendarView` untouched, its 4 tests pass, browser re-check agrees).
* Four gates green; measured baseline 188 → 192 tests (+4, +1 file).
* Both mutations detected; working tree restored byte-identically afterwards.
* Playwright: Sunday-first and Monday-first both confirmed at 1280px and 390px; **zero console
  messages** across every route/viewport/theme combination.
* No scope creep, no unrelated source changes, no debug leftovers, no secrets, no hardcoded colours
  (`text-muted` used for the legend in both themes).

Three non-blocking follow-ups: fix the baseline number in `impl-IMP-058.md:41` (F1), consider
surfacing the weekday order in the heatmap's `aria-label` (F2), and file a discovered item for
white-on-white `bg-elevated` cells in light theme (F3, pre-existing).

**Nothing was committed. The only file added by this review is
`.improve/reports/verify-IMP-058.md` (plus the eight screenshots under `.improve/artifacts/IMP-058/`).**