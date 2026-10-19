# Verify IMP-141 — Make a toast's Undo revert the action it labels

**Verdict: PASS** (independent verification; I did not author the change)

Scope: `.improve/FEATURES.md` §IMP-141; `.improve/reports/impl-IMP-141.md`;
`.improve/reports/discover4-followups.md` F1; `REPO_PROFILE.md`; `AGENTS.md`.
Uncommitted diff inspected: `src/store/useUiStore.ts`, `src/domain/itemActions.ts`,
`src/store/useUiStore.test.ts` (new), `src/domain/itemActions.test.ts`, `.improve/FEATURES.md`.

## 1. Design & call-site audit

- `pushUndo(entry)` now returns `full.id` (`useUiStore.ts:155-159`); `UndoEntry.id` was already
  present and is now surfaced. Return type widened `void → string`.
- `undo(id?)` (`useUiStore.ts:161-173`): with no id → `index = stack.length - 1` (⌘Z pop, unchanged);
  with an id → `findIndex`; `index < 0` returns `false` **without** running anything or mutating the
  stack; a found entry is removed by identity and run. Empty stack still returns `false`.
- `toastWithUndo(message, undoId)` (`itemActions.ts:35-45`) awaits `undo(undoId)` and, on `false`,
  pushes a neutral **"Undo expired"** toast — no revert, no new undo entry.
- **Every** `pushUndo`/`toastWithUndo`/`undo` call site audited:
  - 9 `pushUndo` sites (`createItemPersisted` 73, `createItemsPersisted` 82, `saveItem` 99/106,
    `patchItem` 130, `patchItemAtomic` 149, `deleteItem` 159, `deleteItems` 179,
    `updateRecurring` split 468). Only `deleteItem`/`deleteItems` consume the returned id; the rest
    ignore it (no behaviour change).
  - `toastWithUndo` is defined once and called only from `deleteItem`/`deleteItems`, each with the id
    of the entry it just pushed. No other toast carries an Undo action (`actionLabel: 'Undo'` appears
    only at `itemActions.ts:39`; `register.ts`/`bootFailure.ts` actions are unrelated).
  - `⌘Z` (`useKeyboardShortcuts.ts:36`) calls `undo()` with no id → newest entry. `ToastHost.tsx:50`
    invokes `toast.onAction()`; the new async body is compatible.

No regressions found in keyboard undo or unrelated toasts.

## 2. `deleteItems` count wording / IMP-061

`deleteItems` labels the entry and toast with `deleted.length` — selection **plus** every
newly-collected descendant (`itemActions.ts:167-183`). Test `deleteItems` (parent + 2 descendants)
asserts `Delete 3 items` / `Deleted 3 items` (`itemActions.test.ts:308-319`). The IMP-061 early
return `if (!items.length) return;` is untouched, and the empty-selection no-op test
(`itemActions.test.ts:276-289`: no new undo entry, no toast, storage unchanged) passes.

## 3. Gates — all PASS

| Gate | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run test` | **75 files / 760 tests passed** (+9 vs IMP-140's 751) |
| `npm run format:check` | all files formatted |
| `npm run build` | built; `dist/sw.js` generated (injectManifest) |

## 4. Browser check (isolated preview)

`npm run preview -- --port 4187 --strictPort`, viewport 1280x800, SW registrations unregistered and
`workbox-precache-v2-…` cache deleted, then a real document reload (per AGENTS.md).

Scenario on the Lists view: created Alpha/Beta (quick add) →
1. Deleted **Alpha** → toast **"Deleted 1 items · Undo"** appeared.
2. Undoable action **B** = bulk **Complete** on Beta (pushes a `Change "Beta"` entry; a faster
   stand-in for the editor edit — the editor's Save takes ~4.1 s of Playwright wall time, which
   outlives the 4 s toast, so the editor-edit variant is covered by the unit test instead).
3. Clicked **Alpha's toast Undo** → **Alpha restored (To Do) AND Beta still Done** (B preserved).
4. Pressed **⌘Z** → newest entry (Beta completion) undone → **Beta back to To Do, Alpha still present**.

Observed row states (STATUS column): after delete `[Beta: To Do]`; after B `[Beta: Done]`; after
toast Undo `[Alpha: To Do, Beta: Done]`; after ⌘Z `[Alpha: To Do, Beta: To Do]`. **0 console errors**
(0 errors/warnings, all messages). Screenshot:
`.improve/artifacts/IMP-141/delete-toast-undo.png` (shows the "Deleted 1 items" toast with Undo).

## 5. Mutation check

Reverted `toastWithUndo`'s `undo(undoId)` to the global `undo()` → **2 tests fail**
(`toast Undo scoping > invokes the undo entry its own action pushed…` and `…safe no-op when the entry
was evicted by the stack cap`). Restored; `git diff | shasum -a 256` =
`da400205ee8513a3bb4916f4aa8b11dca0b681eda8a18a609bff795e5b0035c6`; the two affected test files
re-run green (69 passed). Diff intact (4 files, +87/−16).

## 6. State/backlog files

`git status` shows only `.improve/FEATURES.md` modified among `.improve/` — the IMP-141 status flip
(`TODO → IN-PROGRESS`). `STATE.md`, `PROGRESS.log`, `HANDOFF.md`, `LOCK` are unchanged. New untracked
files are the expected workflow artifacts (`reports/impl-IMP-141.md`, `reports/discovered-IMP-141.md`,
`src/store/useUiStore.test.ts`).

## Acceptance criteria

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Toast Undo invokes its own entry by id, not the top | PASS |
| 2 | Delete A → action B → A's toast Undo: B kept, A restored | PASS (test + browser) |
| 3 | `⌘Z` pops newest; `deleteItems` reports rows actually deleted | PASS |
| 4 | Evicted/expired entry = safe no-op or "Undo expired", no revert / no new entry | PASS |

## Non-blocking observations

- Cosmetic pluralization: a single-row delete now reads "Deleted 1 items" / "Delete 1 items"
  (already logged in `discovered-IMP-141.md`; same style as `createItemsPersisted`).
- `undo(id)` reads the stack snapshot before awaiting `entry.run()`, so two same-tick `undo(id)` calls
  could both write from the same snapshot — latent only, logged in `discovered-IMP-141.md`.
- `.improve/FEATURES.md` was flipped to **IN-PROGRESS**, while the impl report says done; the status is
  not yet DONE (the status flip itself is the only `.improve` change, as required).

**Health delta:** +9 tests (751 → 760), 0 failures; all five gates green; no behavioural regression
found; no state/backlog files touched beyond the FEATURES status flip.
