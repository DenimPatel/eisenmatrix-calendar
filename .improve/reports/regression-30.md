# Regression Sweep 30

- **Branch:** `improve/auto-20261003`
- **HEAD:** `729ff0f` (`chore(progress): checkpoint sweep 20`)
- **Baseline:** `b9d2324`
- **Previous sweep:** #20 (`1c1cbd5`) — 23 files / 175 tests
- **Scope:** IMP-051, IMP-057, IMP-058, IMP-016, IMP-017 (bookkeeping), IMP-018, IMP-019,
  IMP-020, IMP-021, IMP-022, plus the deliberate IMP-017 revert
- **Verdict:** **CLEAN** — no regression found

---

## 1. Gates

All four gates pass in a single chained run at `729ff0f`.

| Gate | Command | Exit | Result |
| --- | --- | --- | --- |
| typecheck | `npm run typecheck` | 0 | clean |
| lint | `npm run lint` | 0 | clean |
| test | `npm run test` | 0 | **29 files / 258 tests passed** |
| build | `npm run build` | 0 | clean (`tsc --noEmit` + vite build incl. service worker) |

### 5 consecutive test runs

All five runs: `Test Files 29 passed (29)`, `Tests 258 passed (258)`, `Errors 0`, exit **0**.

| Run | Test Files | Tests | Errors | Unhandled | Exit |
| --- | --- | --- | --- | --- | --- |
| 1 | 29 passed | 258 passed | 0 | 0 | 0 |
| 2 | 29 passed | 258 passed | 0 | 0 | 0 |
| 3 | 29 passed | 258 passed | 0 | 0 | 0 |
| 4 | 29 passed | 258 passed | 0 | 0 | 0 |
| 5 | 29 passed | 258 passed | 0 | 0 | 0 |

Full logs retained at `/tmp/regr30/run{1..5}.log`.

---

## 2. Baseline comparison — strictly additive (confirmed)

Baseline profile claimed 10 files / 49 tests; HEAD is 29 files / 258 tests. Both numbers verified
independently rather than taken on trust.

### Test files: 10 → 29, none deleted

```
git ls-tree -r --name-only b9d2324 | grep -E '\.test\.(ts|tsx)$'   -> 10
git ls-tree -r --name-only HEAD    | grep -E '\.test\.(ts|tsx)$'   -> 29
comm -23 <baseline> <head>  ->  (empty: no test file was deleted)
```

The 10 baseline files all survive; 19 were added.

### Test counts in the 10 pre-existing files: 49 → 93 (none decreased)

| File | baseline | HEAD |
| --- | --- | --- |
| `src/domain/eisenhower.test.ts` | 4 | 4 |
| `src/domain/itemActions.test.ts` | 7 | 9 |
| `src/domain/itemFactory.test.ts` | 8 | 10 |
| `src/domain/quickadd.test.ts` | 2 | 22 |
| `src/domain/recurrence.test.ts` | 5 | 7 |
| `src/domain/reminders.test.ts` | 3 | 6 |
| `src/domain/stats.test.ts` | 4 | 6 |
| `src/lib/backup.test.ts` | 2 | 2 |
| `src/lib/csv.test.ts` | 6 | 6 |
| `src/lib/ics.test.ts` | 8 | 8 |
| **total** | **49** | **93** |

Baseline total 49 matches `REPO_PROFILE.md` exactly. `93 + 165` from the 19 new files = **258**.

### No `.only` / `.skip` / `.todo`

```
git grep -nE '\.(only|skip|todo)\b' HEAD -- '*.test.ts' '*.test.tsx'   -> no matches
grep -rnE '\.(only|skip|todo)\b' src/                                    -> no matches
```

### Removed assertions — one test rewritten, and it got *stronger*

Exactly 4 removed assertion lines exist, all in `src/domain/recurrence.test.ts`, all part of the
IMP-016 rewrite of `"applies overrides for a single occurrence"`:

- **Before (4 asserts):** `overrides[occKey] = { start, status }` → asserts expanded start, status
  (`done`), `isOverride === true`, length 1.
- **After (5 asserts):** the same test now moves `status` into `item.occurrences` (the IMP-016 fix)
  and additionally asserts `expect(occ.completedAt).toBe(7)`. The `toHaveLength(1)` check survives,
  relocated into the local `only()` helper.

Net: same test count for that case, one **added** assertion, and the legacy
`overrides[occKey].status` fallback is now pinned by two new dedicated tests in
`"occurrence status resolution"` plus the `"occurrence ranges"` describe. No assertion was relaxed,
removed without replacement, or downgraded.

---

## 3. CRITICAL — IMP-017 revert is intact

### No trimming code present

```
grep -rn "trimDanglingTail" src/            -> no matches
grep -nE "dangling|preposition|trailing|trimEnd|'at'|\"at\"" src/domain/quickadd.ts
                                            -> no matches
```

The full `b9d2324..HEAD` diff of `src/domain/quickadd.ts` contains **only additions**, all belonging
to IMP-007 (`splitNoteDraft`), IMP-010 (`loneWeekday`/`nextWeekday`), IMP-011 (`nextMonthDay`) and
IMP-018 (habit daily default). Not one line removes or trims a trailing token.

Since sweep #20 the entire `quickadd.ts` change is **3 lines**, all IMP-018:

```
+    kind === 'habit' && !weekdays.length && !rec && !recPhrase && !timeOfDay,
+      rule: { freq: 'daily', interval: 1 },
+    }));
```

### Spec sample verified — and byte-identical to baseline

`parseQuickAdd("Call dentist tomorrow at 3pm !urgent #health")` run at HEAD and at baseline `b9d2324`
(same harness, via `vite-node`, baseline in a throwaway worktree):

| | HEAD | baseline `b9d2324` |
| --- | --- | --- |
| title | **`"Call dentist at"`** | **`"Call dentist at"`** |
| start | `2026-10-06` | `2026-10-06` |
| urgency | `high` | `high` |
| tags | `["health"]` | `["health"]` |

The title ends in `"at"` — the pre-existing behavior. Confirmed a second time visually in the running
app at 390px (`m08-quickadd-trailing-at.png`): **Title "Call dentist at"**, chips
`task · 2026-10-06 · 15:00 · Urgent · #health`.

### IMP-007 / 010 / 011 / 018 all still present and green

| IMP | Function | Live in `quickadd.ts` | Tests in `quickadd.test.ts` | Result |
| --- | --- | --- | --- | --- |
| IMP-007 | `splitNoteDraft` (line 27) | yes | 6, incl. the 5 format table rows | green |
| IMP-010 | `loneWeekday` (line 190) + `nextWeekday` (line 55) | yes | 2 (`lone weekday parsed`, `kept out of title`) | green |
| IMP-011 | `nextMonthDay` (line 66) + `on the Nth` handling | yes | 4, incl. `bare 'on the 5th'` | green |
| IMP-018 | habit daily default (line 218) | yes | 4, incl. `defaults a quick-added habit to daily` | green |

---

## 4. Playwright pass

App served with `vite preview` on `:4173` at
`http://localhost:4173/eisenmatrix-calendar/` (build output, service worker active).
Screenshots: **26 files** in `.improve/artifacts/regression-30/` (`d*` = 1280px, `m*` = 390px).

### All 10 routes at both widths

| Route | 1280 | 390 | Notes |
| --- | --- | --- | --- |
| `#/today` | ok | ok | agenda, overdue, habits, bills, goal progress |
| `#/calendar` | ok | ok | Mon-first header (IMP-049/IMP-058), recurrence expansion correct |
| `#/matrix` | ok | ok | 4 quadrants present |
| `#/lists` | ok | ok | 13 items / all 6 kinds / Inbox 11 / Groceries 2 |
| `#/goals` | ok | — | `Ship regression sweep`, 0%, This month, 0/1 |
| `#/habits` | ok | ok | streak + `Best 1`, Mon–Sun heatmap |
| `#/bills` | ok | — | This month 120, Remaining 120, 2 upcoming occurrences |
| `#/shopping` | ok | — | 0/2 purchased, qty parsing correct |
| `#/notes` | ok | — | multi-line body preserved |
| `#/settings` | ok | ok | notification gate, data tools, migration info |

390px collapses the sidebar into a bottom tab bar carrying all 10 routes.

### Interactions exercised

- **Quick add** (`C` and button) — habit keyword chip + `Daily` recurrence chip, then created the item.
- **Editor save / undo** — occurrence-scoped title edit → toast "Occurrence updated" → `⌘Z` → override
  reverted to `{}`, history cleared.
- **Habit toggle / undo** — `Complete today` → streak 0→1, button became `Undo today`; `⌘Z` → streak 0,
  "Undone" toast.
- **Command palette** (`⌘K`) — opened, filtered on `regress`, rendered matching items.
- **Shortcut sheet** (header button) — all 8 bindings; initial focus lands on the dialog heading, not
  the Close button (IMP-057).
- **Settings export/import** — Export JSON downloaded; re-import round-tripped; foreign JSON rejected.

### Console / network

**0** console messages of any kind (no errors, no warnings) across the entire session, checked after
every major step. **0** failed requests. Baseline was 0 — **parity**.

### Note on a sweep artifact (not an app defect)

Early in the pass, direct `indexedDB` writes made through `page.evaluate` did **not** appear in the UI:
Dexie's `useLiveQuery` relies on Dexie's own mutation observability, which raw IDB writes bypass. For the
same reason a `goto` that only changed the hash (`…#/a` → `…#/b`) did not reload the document, so
stale renders were observed. Both are properties of the *test harness*, not the app. Once writes went
through the real repository (the editor UI) and navigation used a real document load
(`…/index.html#/route`), UI and IndexedDB matched exactly. Final verified state: **13 items**,
13 unique IDs, all 6 kinds — identical to the pre-sweep state. All probe items created during the
sweep were removed and the notification gate was returned to its original `false`.

---

## 5. Changed-behavior spot checks

### (a) Quick-added habit is recurring and shows a streak — PASS

Quick-adding `habit: Regression probe daily habit` produced preview chips `habit` + `2026-10-05` +
`Daily` **without any recurrence phrase in the input** (IMP-018). On the calendar it rendered every day
through Nov 1; in Habits it showed `0 day streak` / `Best 0`, a target line and a completion heatmap.
After toggling: `1 day streak` / `Best 1`.

### (b) Permission granted → one notification, one log row, no double-fire — PASS

Gate ON, `Notification.permission` stubbed to `granted`, `showNotification` stubbed to record, one
timed task with an `At start` reminder set 2 minutes in the past.

- Exactly **1** notification: title `Regr30 delivery probe`, body `02:58 · 2026-10-05`,
  tag `<itemId>:2026-10-05::<reminderId>`, actions Done / Snooze 10m / Snooze 1h,
  `requireInteraction: true`, `data: { itemId, occKey }`.
- Exactly **1** `reminderLog` row, keyed `<itemId>::2026-10-05::<reminderId>`.
- Then **4 additional ticks** (4 `visibilitychange` events): **0** new notifications, still exactly
  **1** log row, same `firedAt`. No double-fire.

### (c) Gate OFF → toast only, no notification; explicit `false` not overridden — PASS

Gate OFF while `permission` stayed `granted`; a second due reminder was created.

- Toast appeared: `Regr30 toast probe — 02:59 · 2026-10-05`.
- Notification attempts for this item: **0**. Total notification attempts for the whole session stayed
  at 1 (the earlier gate-ON probe only).
- The reminder **was** recorded (1 `reminderLog` row) — correct, so the toast delivery does not re-fire.

**Explicit `false` not overridden:** the pre-existing install had `notificationsEnabled: false` stored
explicitly, `permission: 'default'`, and `migration.notificationGate` **present**. Reading
`notificationGate.ts`, that is the correct outcome: the `already-decided` branch fires when the `app`
settings row already has the key — regardless of value — and marks the migration without overwriting.
The seed-to-`true` branch requires `permission === 'granted'`, which is not the case here. So the marker's
presence is not evidence of an unwanted override.

### (d) Backup round-trip and foreign-app rejection — PASS

- **Export:** payload carries identity `app: "eisenmatrix"` and `version: 2`, 14 items, 1 list
  (IMP-021 format v2). Settings surfaces "backup format v2".
- **Re-import:** "Imported 0 items · skipped 14 · overwritten 0 · duplicated 0" (conflict policy
  `Skip existing`). Post-import state verified: **14 items, 14 unique IDs, 1 list, all 6 kinds** — no
  duplication, no corruption.
- **Foreign app rejected:** `{"app": "some-other-calendar", …}` →
  toast `Import failed: Not an EisenMatrix backup (found app "some-other-calendar")`. No items imported.
- **Future version rejected:** `{"app": "eisenmatrix", "version": 99, …}` →
  toast `Import failed: Backup is format v99, but this app only imports up to v2`.

### (e) Boot migration idempotent across reloads — PASS

`migration.notificationGate` = `{ completedAt: 1791182822556 }` before reload and **byte-identical
after reload**; `app.notificationsEnabled` remained `false` both times. Re-running the same migration
on an already-marked install returns the `already-migrated` no-op without touching the stored value.

---

## 6. CI workflows — valid and consistent

Parsed each file with a real YAML parser (not eyeballed):

| File | Parse | Top-level keys |
| --- | --- | --- |
| `.github/workflows/ci.yml` | **valid** | `name, on, permissions, concurrency, jobs` |
| `.github/workflows/deploy.yml` | **valid** | `name, on, permissions, concurrency, jobs` |
| `.github/dependabot.yml` | **valid** | `version, updates` |

The new audit step is consistent with the rest of the pipeline:

- `npm audit --audit-level=critical` uses the same `node:22` runner and the same `npm ci` install as
  the other steps, and sits after the gates so it can only fail on a fresh critical advisory.
- Run locally at HEAD: **exit 0**, 12 advisories, **0 critical / 0 high / 0 moderate / 0 low** — exactly
  the counts recorded in `REPO_PROFILE.md`, so the step will not redden the build.
- `npm test` in CI resolves to the package script, which already includes `--run`, so the non-TTY CI
  run cannot hang in watch mode.
- Dependabot targets weekly npm updates plus the `github-actions` ecosystem; workflows still pin
  `actions/checkout@v4` / `actions/setup-node@v4` / `actions/upload-pages-artifact@v3` /
  `actions/deploy-pages@v4`, consistent with what Dependabot will propose bumping.

---

## Findings summary

No regression. No blocking or non-blocking defect attributable to any commit in this window.

Two **pre-existing** observations, neither a regression and neither introduced by this window — both
verified identical at baseline `b9d2324`, and recorded here only so they are not mistaken for new:

1. **Occurrence-level title overrides are stored but never displayed.** An editor edit scoped to
   "This occurrence" correctly persists to `recurrence.overrides[occKey].title` without touching the
   series (IMP-016 working as designed), but `ItemCard` renders `item.title` and `expandOccurrences`
   never populates `occ.title`, so the card keeps showing the series title. At baseline,
   `recurrence.ts` likewise contained no `title` handling and `ItemCard` likewise rendered
   `item.title`, so the visible outcome is unchanged from before this window.
2. **Single `next <weekday>` quick-add.** `"Email Bob next friday"` keeps `next friday` in the title
   and leaves the date at today, because the lone-weekday branch discards the weekday list when
   preceded by `next` (line 221) and the `nextWeekday` fallback at line 297 does not then match.
   Measured identically at baseline `b9d2324` (title `"Email Bob next friday"`, start today), so
   IMP-010 did not cause it. No test covers the single-`next`-weekday case.

**Test-harness notes** (harness properties, not app behavior, already described in §4): raw
`indexedDB` writes bypass Dexie's `useLiveQuery` observability, and hash-only `goto` does not reload the
document. Write through the UI and use a real document load when verifying live queries.

**Verification-only run.** No source file, test, workflow or configuration was modified. No commit was
created. The only additions are this report and the 26 screenshots in
`.improve/artifacts/regression-30/`. The throwaway baseline worktree used for the parity comparison was
removed, and browser state was restored to its pre-sweep shape (13 items, notification gate `false`).