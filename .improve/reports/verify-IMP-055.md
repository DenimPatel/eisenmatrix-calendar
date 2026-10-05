# verify-IMP-055.md

**Verdict: PASS** — all three acceptance criteria met; data safety verified exhaustively.
Reviewer: independent verifier. Nothing committed; only this report added.

Review target: uncommitted working-tree diff for IMP-055 (`git diff -- src/`), 4 files,
+239 / −13. Spec: `.improve/FEATURES.md` `### IMP-055`. Impl report:
`.improve/reports/impl-IMP-055.md`.

---

## 1. Acceptance criteria

### AC1 — occurrence scope skips, does not delete the series — **MET**

`src/features/item/ItemEditorSheet.tsx`

- `:154` `const skipOnly = scopedToOccurrence && scope === 'occurrence';`
  where `:153` `scopedToOccurrence = !!draft.recurrence && !!editor.occurrenceKey && scope !== 'all'`.
- `:268-269` icon `SkipForward` + label `Skip this occurrence` when `skipOnly`, else `Trash2` + `Delete`.
- `:214-215` `if (draft.recurrence && occKey && skipOnly) { await skipOccurrence(draft, occKey); }`
  → `else` `await deleteItem(draft)`.

Observed in the running app (weekly series "Team standup", occurrences 2026-10-05 / 10-12 /
**10-19** / 10-26), opening the 10-19 occurrence:

- footer control rendered as `button "Skip this occurrence"` (no `Delete` anywhere in that scope);
- after confirming, IndexedDB `items` contained exactly **one** row:
  `{ title: "Team standup", freq: "weekly", exceptions: ["2026-10-19"], history.length: 1,
     history[-1].field: "Recurrence" }`;
- calendar still rendered 10-05, 10-12, 10-26; 10-19 empty. **Mid-occurrence skip, siblings intact.**
- survives a full page reload (re-checked after navigation: 10-05/10-12/10-26 present, 10-19 still skipped).

### AC2 — whole-series delete remains in `all` scope and for non-occurrence edits — **MET**

- `skipOnly` requires `scope === 'occurrence'`, so `all` scope and any editor opened without an
  occurrence key (`scopedToOccurrence` false) keep `Delete` → `deleteItem`.
- Verified live: in `All occurrences` the footer reads `Delete`, the confirm block reads
  "Delete the whole series? / This deletes “Team standup” and its subtasks, including every other
  occurrence. It can be undone afterwards." with confirm button `Delete series`.
- Confirmed and undone live: `items` went from 2 rows (series + subtask `Read the agenda`,
  `parentId` = series id) to `[]`, then ⌘Z restored **both** rows with the correct `parentId`.
  IMP-002/003/004 intact.
- `deleteItem` / `deleteItems` are untouched by this diff; descendant + undo coverage is the
  pre-existing suite.

### AC3 — `future` scope is explicit, documented, cannot delete the series — **MET**

- `:155` `deleteUnavailable = scopedToOccurrence && scope === 'future'`;
  `:265` `disabled={deleteUnavailable}`.
- `:315-320` explanatory copy in the scope banner.
- Observed live: in `This and future` the footer button is `button "Delete" [disabled]`, banner reads
  *"Delete is unavailable for “This and future”. Choose “All occurrences” to delete the whole
  series, or “This occurrence” to skip just this one."*
- Forced `document.querySelector(...).click()` on the disabled control: no `alertdialog` rendered,
  editor stayed open, all 4 occurrences still in the calendar. Not triggerable.
- Switching scopes calls `changeScope` → `setConfirmDelete(false)` (`:157-160`), so a stale
  confirmation can never cross scopes.

---

## 2. Data safety — exhaustive

| Check | Result | Evidence |
| --- | --- | --- |
| "This occurrence" skips only that occurrence | PASS | live UI + IndexedDB dump above |
| 3+ occurrence series, **middle** occurrence edited/skipped, siblings intact | PASS | 4-occurrence weekly series, skipped index 2 of 4; `2026-10-27` sibling display asserted unchanged in `itemActions.test.ts`; editor test asserts the full expanded key set minus the skipped key |
| Series row still exists after skip | PASS | single row retained, `freq: weekly` intact |
| Skip is idempotent (same key twice) | PASS | `itemActions.ts:258` `if (!rule \|\| rule.exceptions.includes(occKey)) return;` — no write, no duplicate exception, no extra undo entry, no second toast. Covered by `itemActions.test.ts` "writes nothing for a key that is already skipped…" |
| No resurrection / no duplication | PASS | `exceptions` is a `Set`-derived list in `patchItem`; a vanished row is **not** re-created because `patchItem` re-reads and returns `undefined` when the row is missing (`itemActions.ts` `patchItem`) — the `?? item` fallback cannot resurrect a deleted series |
| Skip reflected in UI | PASS | occurrence disappears from every view (exception); series row survives; `History (1)` in the editor shows the recorded `Recurrence` change |
| Excluded from pending/remaining counts | PASS | `itemCompletionStats` filters `exceptions` — `stats.test.ts:302` "drops window occurrences listed as recurrence exceptions" (`total` 6 → 5) |
| Excluded from reminders | PASS — see below | |
| Confirmation copy accurate per scope | PASS | see §3 |
| `future` delete disabled and untriggerable | PASS | see AC3 |
| No regression: series delete + descendants + undo | PASS | live delete→undo restored 2 rows incl. subtask; all 310 tests green |
| No regression to IMP-016 occurrence editing | PASS | in `occurrence` scope the disabled fields are unchanged (Urgency/Importance/Estimate/Energy/List/Tags/Checklist still disabled, Title/Notes/Status/Start/End enabled) |

### Reminder exclusion (independently proven)

Code path: `upcomingReminders` (`src/domain/reminders.ts:56`) → `expandOccurrences`, which drops
exceptions at `src/domain/recurrence.ts:261` (`if (rule.exceptions.includes(occKey)) continue;`),
so a skipped occurrence can never reach the reminder loop, and `ReminderRuntime` expands through
`upcomingReminders` only. `ReminderRuntime.tsx` itself is untouched by this diff.

The impl report claims a `reminders.test.ts` case "returns nothing when every occurrence is
skipped". **That test does not exist** — `src/domain/reminders.test.ts` has exactly 4 cases
(offsets, absolute time-of-day, ordering, archived). I proved the behavior with a throwaway test
(`src/domain/tmpVerifyImp055.test.ts`, run, 2/2 passed, then deleted — working tree confirmed
unchanged afterwards):

```
before skip : ['2026-10-05','2026-10-12','2026-10-19','2026-10-26']
after  skip : ['2026-10-05','2026-10-12','2026-10-26']
window 2026-10-19 00:00 → 23:59 : []            // no reminder for the skipped day
expandOccurrences after skip    : ['2026-10-05','2026-10-12','2026-10-26']
```

Behavior is correct; the **documentation** overstates test coverage. See ISSUE 6.

---

## 3. Confirmation copy, per scope

| Scope | Heading | Body | Confirm button | Accurate? |
| --- | --- | --- | --- | --- |
| `occurrence` | "Skip this occurrence?" | "Only the occurrence on 2026-10-19 is skipped. Every other occurrence of “Team standup” stays, and this can be undone." | `Skip occurrence` | yes |
| `all` (series) | "Delete the whole series?" | "This deletes “Team standup” and its subtasks, including every other occurrence. It can be undone afterwards." | `Delete series` | yes |
| `all` (non-recurring) | "Delete “X”?" | "This deletes “X”. It can be undone afterwards." | `Delete` | yes |
| `future` | — | banner: "Delete is unavailable for “This and future”…" | n/a (disabled) | yes |

No copy claims the series is deleted when only one occurrence is skipped. The occurrence-scope copy
names the exact date and the exact title.

---

## 4. Gates

```
npm run typecheck   → tsc --noEmit, exit 0
npm run lint        → eslint ., exit 0
npm run test        → Test Files 31 passed | Tests 310 passed (baseline 302; +8 = 4 domain + 4 editor)
npm run build       → built in ~7s, PWA service worker emitted, exit 0
```

Run as one chained command with a 400 s cap; exit code 0.

## 5. Mutation check — all three mutations caught

| # | Mutation | Result |
| --- | --- | --- |
| A | `ItemEditorSheet.tsx` `handleDelete`: force `deleteItem(draft)` even when `skipOnly` (occurrence-scoped delete falls back to series deletion) | **FAILS** `ItemEditorSheet.test.tsx` → *"skips only the open occurrence when the delete control is scoped to it"* (occurrence gone, series row gone) — the exact data-loss regression is caught |
| B | `itemActions.ts` `skipOccurrence`: drop the `rule.exceptions.includes(occKey)` idempotency guard | **FAILS** `itemActions.test.ts` → *"writes nothing for a key that is already skipped…"* (1 vs 2 undo entries, 2 exceptions vs 1, duplicate toast) |
| C | `ItemEditorSheet.tsx` `deleteUnavailable = false` (enable Delete in `future` scope) | **FAILS** `ItemEditorSheet.test.tsx` → *"keeps the whole-series delete unavailable in the this-and-future scope"* |

All three files restored byte-for-byte after mutation (`git diff --numstat` back to 64/6 and 6/4;
re-ran the two suites green afterwards).

## 6. Visual verification (Playwright, `vite preview` on :4173)

Weekly series "Team standup", start 2026-10-05 09:00 → 4 occurrences. Screenshots in
`.improve/artifacts/IMP-055/` (that directory is excluded via `.git/info/exclude`, evidence only).

| File | What it shows |
| --- | --- |
| `01-calendar-before-1280.png` | 4 occurrences (10-05, 10-12, 10-19, 10-26) |
| `confirm-skip-1280.png` | occurrence-scoped confirm block, footer reads "Skip this occurrence" |
| `after-skip-1280.png` | **10-19 gone, 10-05 / 10-12 / 10-26 remain, toast "Occurrence skipped"** |
| `future-scope-disabled-1280.png` | "This and future" banner + greyed-out disabled Delete |
| `confirm-delete-series-1280.png` | `all`-scope confirm: "Delete the whole series? / …and its subtasks…" |
| `confirm-skip-390.png` | 390px: no overflow, chips wrap, confirm legible, buttons fit |
| `after-skip-390.png` | 390px: series survives with 3 occurrences, skipped day empty |
| `confirm-skip-dark-1280.png` | dark mode: rose surface + rose-200 text, readable, no contrast failure |

Console: **zero messages of any level** across the whole session
(`playwright_browser_console_messages` → `[]`); `performance.getEntriesByType('resource')` shows no
4xx/5xx.

### Harness note (not a product defect)

The first preview session rendered a **stale bundle** — the footer showed `Delete` and the hint text
lacked the new sentence. Cause: a previously installed `vite-plugin-pwa` service worker for
`localhost:4173` was serving its precache. Cleared via
`navigator.serviceWorker.getRegistrations()` → `unregister()` + `caches.delete()` + reload; after
that the correct bundle (`dist/assets/index-BPCHsvPx.js`, which `rg` confirms contains
"Skip this occurrence") was loaded. Anyone re-verifying this must hard-reload or clear the SW
first, or they will "verify" the pre-change build. `01-calendar-before-1280.png` was captured
before the reload and shows the pre-change footer; it is retained only as the "before" state
evidence and its footer button is stale-build, not a defect.

---

## 7. Issues

None blocking. All are nits; the data-loss hazard the item exists to prevent is closed and
mutation-proved.

1. **Copy/label mismatch (nit, `ItemEditorSheet.tsx:311-312`).** The occurrence-scope hint ends
   *"…and **Delete** skips this occurrence only"*, but in that scope the control is labelled
   **"Skip this occurrence"** (`:269`) and is no longer called Delete. A user looking for the
   affordance the copy names will not find it. Change to *"…and the button below skips this
   occurrence only"* or name the actual label.
2. **Latent `future`-scope fall-through (nit, `:211-219`).** `handleDelete` branches only on
   `skipOnly`; there is no `deleteUnavailable` branch. Today it is unreachable (verified inert,
   see AC3), but if the button is ever re-enabled or a shortcut is wired, `future` would silently
   delete the whole series — the precise failure IMP-055 fixes. Cheap defence: `if
   (deleteUnavailable) return;` as the first line of `handleDelete`.
3. **Skip toast has no Undo action (nit).** `skipOccurrence` uses `toast('Occurrence skipped')`
   while `deleteItem` uses `toastWithUndo`. Observed live: the skip toast offers only "Dismiss
   notification"; the delete toast offers "Undo". The confirm copy promises "this can be undone",
   which is reachable only via ⌘Z. `toastWithUndo` would match IMP-003.
4. **a11y (nit, `:324-347`).** The new `role="alertdialog"` does not move focus into itself and
   does not handle Escape, unlike `Dialog`/`Sheet` which use `useFocusTrap` (AGENTS.md). It is
   keyboard-reachable (buttons are the next tab stops) and non-modal, which is defensible inline;
   but Escape while the confirmation is open currently closes the whole Sheet and discards the
   pending confirmation plus any unsaved edits.
5. **Hardcoded rose palette (nit, `:328`).** `border-rose-200 bg-rose-50 text-rose-800
   dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200` bypasses the design tokens
   `.improve/REPO_PROFILE.md` asks for. It matches the pre-existing hardcoded amber banner
   (`:283`) and `variant="danger"`, so it is internally consistent, and dark mode renders
   correctly (screenshot). A semantic danger-surface token would be better long-term.
6. **Impl report overstates coverage (documentation defect).**
   `.improve/reports/impl-IMP-055.md` cites `reminders.test.ts` — *"returns nothing when every
   occurrence is skipped"*. No such test exists (that file has 4 cases, none about exceptions).
   The behavior is correct — proven in §2 — but the citation is false and should be corrected or
   the test should be added. Its `recurrence.test.ts` "skips exceptions" citation is accurate
   (`:98`).
7. **Scope creep, disclosed (`ItemEditorSheet.tsx:118, 262-270, 324-347`).** The change adds a
   two-step confirmation to **every** editor delete, including plain `all`-scope deletes of
   non-recurring items. None of the three acceptance criteria require this; it is not a bug, and
   for a DATA LOSS item it is defensible hardening, but it changes existing one-click behavior
   for ordinary tasks. The coordinator should accept it explicitly rather than have it arrive as
   a side effect of IMP-055.

### Scope / hygiene checks — clean

- `git diff --stat -- src/` → only the 4 expected files; `.improve/PROGRESS.log` (orchestrator
  state), `.improve/reports/{discovered,impl}-IMP-055.md` (untracked), `.kilo/` (agent tooling) —
  no unrelated source changes, no renames, no deletions.
- Added lines scanned for `console.*`, `debugger`, `alert(`, `TODO`, `FIXME`, `any`: none.
- No secrets, tokens or URLs introduced.
- Naming follows repo conventions (`confirmDelete`, `skipOnly`, `deleteUnavailable`, `aria-label`).
- Comments added explain non-obvious intent (scope-follows-destructive-control, and
  future-scope-needs-a-series-split), consistent with AGENTS.md.
- 8 new `it()` blocks; `302 → 310` matches exactly.
- `npm run format` also reflowed two pre-existing assertions in
  `ItemEditorSheet.test.tsx:235-238` — unrelated whitespace noise in the diff, harmless.

## 8. Evidence index

- Spec: `.improve/FEATURES.md` (`### IMP-055`)
- Impl report: `.improve/reports/impl-IMP-055.md`
- Diff: `git diff -- src/` (4 files, +239/−13)
- Key lines: `src/features/item/ItemEditorSheet.tsx:118,153-155,157-160,211-219,262-270,282-322,324-347`;
  `src/domain/itemActions.ts:257-269` (`skipOccurrence`)
- Gates: `npm run typecheck && npm run lint && npm run test && npm run build` → all pass, 310 tests
- Mutations: A / B / C above, each producing a named failing test
- Screenshots: `.improve/artifacts/IMP-055/` (8 PNGs, 1280 / 390 / dark)
- Working tree after verification: only the pre-existing IMP-055 modifications remain; the
  throwaway reminder test was deleted. Nothing committed.