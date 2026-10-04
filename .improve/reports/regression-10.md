# Regression Sweep — commit 10 (branch `improve/auto-20261003`)

Repo: `/Users/denimpatel/Desktop/git/eisenmatrix-calendar`
Date: 2026-10-04
Baseline: `b9d2324` (10 commits compared: `b9d2324..HEAD`)
Runner env: macOS (darwin), node v25.6.1, npm 11.9.0
Role: regression sweeper — prove nothing regressed across the 10 commits and hunt for
gaps the per-item verifications missed. **No application code was changed; nothing
committed.** Only this report + screenshots were added.

## VERDICT: CLEAN

All four gates pass, no pre-existing failure was introduced, no test was deleted or
weakened, console-error count matches the recon baseline exactly (0), and every
behavior changed by the branch was verified live in the browser.

---

## 1. Full gate run

`npm run typecheck && npm run lint && npm run test && npm run build` — all exit 0.

| Gate | Exit | Detail |
|---|---|---|
| `npm run typecheck` | **0** | `tsc --noEmit`, no diagnostics |
| `npm run lint` | **0** | `eslint .`, no output |
| `npm run test` | **0** | **16 test files / 118 tests, all passed** |
| `npm run build` | **0** | `tsc --noEmit` + `vite build` + PWA `injectManifest` → `dist/sw.js`, precache 18 entries (602.81 KiB) |

Test duration ~10s. No `Errors` line in the final run.

### Test-count comparison vs baseline

| | Files | Tests |
|---|---|---|
| Baseline `b9d2324` (measured, not assumed) | 10 | 49 |
| HEAD | 16 | 118 |
| Delta | **+6** | **+69** |

Baseline numbers were **re-measured** by creating a detached git worktree at
`b9d2324` (symlinked `node_modules`) and running the suite there — not taken on
trust from `REPO_PROFILE.md`. Baseline reproduced 10 files / 49 tests clean, matching
the recorded profile.

### One-off unhandled rejection (investigated, not a regression)

The **first** `npm run test` invocation of the session reported all 118 tests passing
but also:

```
⎯⎯ Unhandled Rejection ⎯⎯
TypeError: storage.getItem is not a function
 ❯ runLegacyMigration src/db/migrations/legacyTasks.ts:219:23
This error originated in "src/test/app.smoke.test.tsx" test file.
 Test Files  16 passed (16)
      Tests  118 passed (118)
      Errors  1 error
```

Analysis:

- It originates in `src/test/app.smoke.test.tsx` + `src/db/migrations/legacyTasks.ts`,
  **neither of which is modified anywhere in `b9d2324..HEAD`** (confirmed via
  `git log b9d2324..HEAD -- <paths>` → empty).
- It is **non-deterministic**: it did not recur in **6 subsequent full-suite runs**
  (3× `npx vitest run`, 3× `npm run test`), nor in a targeted
  `vitest run src/test/app.smoke.test.tsx`, nor in the final gate run.
- Root cause is a pre-existing teardown race: `runLegacyMigration` reads
  `typeof localStorage !== 'undefined' ? localStorage : undefined` asynchronously
  (`legacyTasks.ts:209`), and on a cold first run the global can resolve to Node's
  native Web Storage shim (the same run also emitted the pre-existing benign
  `--localstorage-file was provided without a valid path` warning) rather than jsdom's
  `Storage`, which has no `getItem`. Baseline never surfaced it in 4 runs, but the
  code path is identical, so this is **latent and pre-existing**, merely exposed once.
- **Not attributable to any of the 10 commits.**

**Forward-looking risk (not a regression, but relevant to the new CI gate):** Vitest
reports unhandled errors and, depending on version/config, can fail the run even when
every assertion passes. Commit `bd39729` (IMP-005) added a CI quality-gate workflow
that runs `npm run test`. If this race fires in CI it could red-line the gate for a
non-deterministic reason. Recommend (future, not done here) either awaiting the
migration in the smoke test or guarding `storage.getItem` behind a
`typeof storage.getItem === 'function'` check.

---

## 2. Baseline comparison / test integrity

`git diff b9d2324..HEAD --stat`: 57 files changed, 5642 insertions(+), 32 deletions(-).

- **No test file was deleted or renamed.**
- **No tests were skipped.** Grepping every added line in `src/**/*.test.ts(x)` for
  `.skip(`, `.only(`, `it.todo`, `describe.skip` → **NONE**.
- Across all test files the **only deleted line** is an import statement being
  *widened*:

  ```diff
  -import { parseQuickAdd } from './quickadd';
  +import { parseQuickAdd, splitNoteDraft, NOTE_TITLE_MAX } from './quickadd';
  ```

- `src/domain/quickadd.test.ts` reviewed in full: all 6 original `parseQuickAdd`
  tests are intact and unmodified; 7 new `splitNoteDraft` tests were appended, all
  of them **stronger** than the behavior they cover (e.g. asserting
  `title + notes === text` for a 200-char input, i.e. lossless).
- Per-file new test counts: `stats.test.ts` 36, `useData.test.tsx` 8,
  `repository.test.ts` 9, `itemActions.test.ts` 5, `CalendarView.test.tsx` 4,
  `NotesView.test.tsx` 3, `labels.test.ts` 3.
- No pre-existing failure was introduced: baseline was fully green on all four gates,
  and HEAD is fully green on all four gates.

---

## 3. Playwright pass (live app, `npm run preview` on :4173)

App served from the **production build** at
`http://localhost:4173/eisenmatrix-calendar/`. Desktop 1280×800 and mobile 390×844.

All 10 nav routes rendered successfully: Today, Calendar, Matrix, Lists, Goals,
Habits, Bills, Shopping, Notes, Settings. Calendar exercised in **all four** granularities
(day/week/month/year).

### Console errors / warnings

**0 console errors and 0 console warnings across the entire session.** Verified by
polling `playwright_browser_console_messages` at four separate points (initial load,
mid seed, after cascade delete/undo, at mobile) — the tool returned an empty list every
time.

### Failed network requests

**None.** `playwright_browser_network_requests` returned no failed/erroring requests.

### Screenshots

Canonical copies in `.improve/artifacts/regression-10/` (the Playwright MCP sanitizes
nested output paths into `.playwright-mcp/`, so the files were copied to canonical
names, matching the recon convention):

- `desktop-01-today.png`
- `desktop-02-calendar-week-sunday.png`
- `desktop-03-calendar-year.png`
- `desktop-04-calendar-month-sunday.png`
- `desktop-05-matrix.png`
- `desktop-06-habits.png`
- `desktop-07-goals.png`
- `desktop-08-bills.png`
- `desktop-09-shopping.png`
- `desktop-10-command-palette.png`
- `mobile-390-01-today.png`
- `mobile-390-02-calendar-sunday.png`
- `mobile-390-03-habits.png`

---

## 4. Console-error comparison vs recon baseline

| Source | Console errors | Console warnings |
|---|---|---|
| `.improve/reports/recon-experience.md` baseline | **0** | **0** |
| This sweep | **0** | **0** |

**No new console error. Matches baseline exactly.** (Recon used the dev server; this
sweep used the production preview build, which is the stricter test — the PWA service
worker registered and `ReminderRuntime` ticked with no output.)

---

## 5. Spot-checks of changed behaviors

All five requested behaviors were exercised live and **all behave correctly**.

### 5a. Habit streak (IMP-001, `a20b684`) — PASS
Created habit "Daily reading" (target 1×/day) via Habits → New habit.
- Initial: `0 day streak`, `Best 0`.
- After clicking "Complete today": `1 day streak`, `Best 1`, button flips to
  "Undo today" with a ✓, heatmap rendered.
- On mobile Today the card read `1 day streak · best 1` — streak persists across
  viewport changes and route changes.

The specific IMP-001 fix (best streak resetting across *missed periods*) cannot be
exercised through the UI without backdating completions; it is covered by 36 unit
tests in `src/domain/stats.test.ts`, all passing.

### 5b. Descendant delete (IMP-002/003/004) — PASS
Seeded a 3-level chain plus a control directly into IndexedDB
(`eisenmatrix` → `items`): `reg-parent` ← `reg-child` ← `reg-grand`, plus `reg-other`
(no parent). The editor correctly listed `REG Child` under **Subtasks** for
`REG Parent`, confirming the parent link is real.

| Step | Items | Result |
|---|---|---|
| Seeded | 7 | parent, child, grandchild, unrelated + 3 UI-created |
| Delete `REG Parent` | **4** | parent **+ child + grandchild** all removed (transitive cascade); `REG Unrelated` survived |
| Click "Undo" on the Deleted toast | **7** | **all three** restored |

This confirms all three fixes end-to-end in the real app: transitive descendant
deletion, cascade in bulk delete, and undo restoring descendants (not just the parent).

### 5c. Note quick-add long text (IMP-007, `4ac86f9`) — PASS
Tested the actual fixed path — the Notes view inline composer, which now routes
through `splitNoteDraft`. Input was a 95-char first line plus a second body line:

- Stored title = `AAABBBCCCDDDAAABBBCCCDDDAAABBBCCCDDDAAABBBCCCDDDAAABBBCCCDDDAAABBBCCCDDDEEEFFFGG`
  — **exactly 80 chars**, correctly capped at `NOTE_TITLE_MAX`.
- Stored body = `GHHHOVERFLOWTAIL second body line here` — the **overflow characters
  and the second line are both preserved**, i.e. nothing is silently dropped.

Previously the overflow was discarded outright. Side observation: the *global* Quick add
dialog (`C`) does **not** apply the 80-char cap — a 110-char note created there stored
the full 110-char title with no truncation and no body split. That is not a regression
(it is the pre-existing `quickAddToItem` path, untouched by this branch) and is arguably
better behavior, but the two note-capture entry points now have **different** title
length semantics. Worth a conscious decision; not a blocker.

### 5d. Calendar week start honors setting (IMP-049, `6eeaab9`) — PASS
Set Settings → Appearance → "Week starts on" from Monday to Sunday:

- **Month view**: header flipped `Mon…Sun` → `Sun…Sat`, and the grid correctly
  re-flowed from `Sep 28 – Nov 1` (6 rows) to `Sep 27 – Oct 31` (5 rows).
- **Week view**: range became `Sep 27 – Oct 3, 2026` with `Sun` first — Sep 27 2026 is
  indeed a Sunday, so the arithmetic is right.
- **Mobile 390px**: also `Sun…Sat`, 5 rows ending Sat Oct 31.
- Item placement stayed correct throughout: the Oct 3 chips remained inside the
  `Add item on 2026-10-03` cell in both Monday- and Sunday-first layouts (no off-by-one
  when the week start shifts).
- Year view is week-start agnostic and rendered correctly (October shows the 6 items,
  `+1 more`).

### 5e. Item edit / undo — PASS
Renamed `REG Unrelated` → `REG Unrelated EDITED` in the editor, clicked Save:
row updated, "Saved" toast shown. Pressed `⌘/Ctrl+Z`: title reverted to
`REG Unrelated`, "Undone" toast shown. Edit + undo both work.

Note: the **"Saved" toast offers no Undo button** (only Dismiss) — undo is reachable
only via the `⌘Z` shortcut. Pre-existing and unchanged by this branch, but it is an
asymmetry worth noting since the **Deleted** toast *does* offer Undo.

---

## 6. Findings

### Not regressions (pre-existing, confirmed unchanged by this branch)

These were all recorded in `recon-experience.md` / `REPO_PROFILE.md` and all still
reproduce identically. None is attributable to any of the 10 commits.

1. **False empty state before `useLiveQuery` resolves** (recon #4). Reproduced twice:
   navigating to Lists showed `All items 0` + "No items match" with 7 items in the DB,
   flipping to `All items 7` ~1s later. **This now also affects the calendar week
   start**: on navigating to Calendar the month grid briefly painted Mon-first and then
   flipped to Sun-first once the `app` settings row resolved (observed on mobile). It
   is the same class of bug, newly *visible* because IMP-049 made the setting
   user-visible in the calendar. Cosmetic flicker, but arguably more noticeable now.
2. **Overlays focus the Close button first** (recon #2). Re-confirmed on Quick add,
   Command palette and the item editor (`Close dialog` / `Close panel` carried
   `[active]`).
3. **Mobile bottom nav overflows at 390px** (recon #1). Still only Today, Calendar,
   Matrix, Lists, Goals, Habits, Bills visible; Shopping, Notes and Settings remain
   off-screen with no scroll affordance. `document.scrollWidth == clientWidth == 390`
   so there is no *document*-level overflow — the clipping is confined to the nav
   scroller, as before.
4. **Quick-add trailing preposition** (recon #3) — unchanged code path.
5. **"Saved" toast has no Undo** — see 5e.

### New observations (neither caused by nor fixed in this branch)

6. **Toast host can block the item editor's Save button.** `ToastHost` renders at
   `fixed bottom-20 right-4 z-[60]` with `w-[min(92vw,22rem)]`, which geometrically
   overlaps the editor sheet's footer action row. Reproduced **twice**: Playwright's
   click on **Save** timed out after 5s with
   `<div class="pointer-events-auto …"> … subtree intercepts pointer events`.
   A human user would likely just click slightly off-center and hit it, but it is a
   genuine hit-target/z-index collision between two overlays. Neither `ToastHost` nor
   `Sheet` is touched by `b9d2324..HEAD`, so it is pre-existing — but note that the
   branch **adds more toast-producing actions** (delete + undo toasts), so it is now
   easier to hit. Severity: LOW–MEDIUM.

### Confirmed-not-a-bug (investigated so nobody re-chases it)

7. **Raw IndexedDB writes do not notify `useLiveQuery`.** While seeding test data I
   wrote straight to the `eisenmatrix` DB via `page.evaluate`; the Lists view kept
   showing 3 items while the DB held 7. Cause: Dexie's `liveQuery` observability does
   not see writes that bypass Dexie, and navigating between `#/…` routes is a
   same-document hash change, so no reload occurred. A hard reload showed all 7
   immediately. **This is a property of my test harness, not an application defect** —
   all app-driven mutations updated the UI reactively and correctly throughout.

---

## 7. Coverage notes / limits of this sweep

- Exercised the production **preview** build, not the dev server. This is stricter
  (real SW registration, minified bundle) and matches the recorded baseline URL.
- The descendant-delete chain was seeded directly into IndexedDB because the item
  editor exposes **no "parent" field** — only a subtask checkbox for existing children.
  There is still no UI to re-parent an arbitrary task. Pre-existing; out of scope here.
- `IMP-001`'s missed-period best-streak reset and the full `expandOccurrences`
  recurrence semantics are not reachable through the UI in a single session; they rest
  on the 36 `stats.test.ts` unit tests, all passing.
- The `preview` server was left running in the background at the end of the sweep.

## 8. Bottom line

Ten commits, four gates green, tests grew 49 → 118 with nothing removed, skipped or
weakened, console errors still 0, and every one of the five changed behaviors verified
working in the real app. **No regression.** The only new-ish risk is a rare,
pre-existing, non-deterministic unhandled rejection in `app.smoke.test.ts` that could
intermittently red the newly added CI test gate.