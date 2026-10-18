# Verify (2) IMP-037 — "This and future" split: head from persisted row + undo

**Reviewer:** independent, skeptical (fresh; second attempt — did not author the change)
**Verdict: PASS** — all three issues from the prior failure (F1/F2/F3) are genuinely fixed,
all four acceptance criteria hold, and no reachable regression remains. One new *latent,
UI-unreachable* degenerate path is noted as a low-severity follow-up (R1), plus one
out-of-scope behavior change (R2). Neither blocks.

## Scope reviewed

`git diff` (working tree) + untracked reports: `src/db/repository.ts`,
`src/domain/itemActions.ts`, `src/domain/itemActions.test.ts`,
`src/features/item/ItemEditorSheet.tsx`; `.improve/reports/discovered-IMP-037.md`,
`impl-IMP-037.md`, `verify-IMP-037.md`. No other tracked files changed. No leftovers:
the throwaway probe was deleted after use (`git status` clean apart from the four modified
files and the report files).

## Gates (working tree)

| Command | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run test` | 43 files / **478 passed** (baseline 474; +4) |
| `npm run format:check` | clean ("All matched files use Prettier code style!") |
| `npm run build` | success (PWA precache 18 entries, 625.63 KiB) |

## Prior failure issues — each re-checked

### F1 (High) — null-recurrence future split dropped the rule and undo deleted the item → **FIXED**

`src/domain/itemActions.ts:359-369` reads `stored` first and, when `!stored.recurrence`,
applies the draft's rule + patch to the row via `patchItem(..., { silent: true })` instead of
splitting. Independent probe (`updateRecurring(draftWithNewRule, 'future', '2026-07-13', …)`
on a persisted recurrence-less row): **1 row**, `recurrence.freq === 'weekly'` persisted,
**exactly 1** undo entry, and undo restored `itemRepo.all()` byte-equal to the pre-save
snapshot (row present, `recurrence: null`). The regression test
`patches the row instead of splitting when the stored row has no recurrence` covers it.

### F2 (Med) — "head untouched" tests did not exercise the bug → **FIXED**

The new tests (`itemActions.test.ts:844-871`) now hand the **already-patched draft** as the
`item` argument (`{ ...before, title: 'Standup (retro)', notes: 'retro notes' }`) while the
patch is separate, matching the editor shape. Reverting `splitSeries(stored, …)` to
`splitSeries(item, …)` would make `head.title === 'Standup (retro)'`, failing
`expect(head.title).toBe('Standup')` — the mutation is now caught.

### F3 (Low) — undo closure was not atomic → **FIXED**

New `itemRepo.putAndRemove(put, remove)` (`src/db/repository.ts:111-118`) does
`bulkPut` + `bulkDelete` inside one `db.transaction('rw', db.items)`, matching the
`replaceAll`/`removeWithChildren` style. The split undo (`itemActions.ts:388-390`) uses it;
the split itself uses one `createMany`. No partial-apply window remains.

## Acceptance criteria

1. **Head from persisted original, only tail patched — PASS.** `stored` read at
   `itemActions.ts:359`, passed to `splitSeries` at `:370`; only `tailPatched` receives the
   patch. Test passes a patched draft and asserts `head.title === 'Standup'` /
   `tail.title === 'Standup (retro)'`.
2. **Single undo entry restores original + removes tail — PASS.** Exactly one `pushUndo` on
   the future path (`:388`). Probe: after split `itemRepo.all()` has 2 rows and the stack has
   1 entry; after undo it is **deep-equal** to the pre-split snapshot and the stack is empty;
   a second undo returns `false` and changes nothing (no phantom entry).
3. **Past occurrences unchanged — PASS.** `head` is the stored row with only
   `recurrence.until` narrowed, so stored `overrides`/`exceptions` survive. Probe confirmed
   `head.recurrence.overrides['2026-07-13']` and `exceptions` intact after a patched-draft
   split, and the existing "leaves every occurrence before the split unchanged" test passes.
4. **`count` follows IMP-023 — PASS.** Untouched; `anchors the tail on the split day and keeps
   the series total` still green (head ∪ tail == unsplit keys, length 10).

## Repository/Dexie discipline

`putAndRemove` is the only new Dexie call and lives in `src/db/repository.ts`.
`grep` for `getDb|db.items|db.transaction` outside `src/db/` (excluding tests) returns
nothing; `src/domain/itemActions.ts` imports only `itemRepo`/`ItemPatch` from the repository.
The undo touches Dexie only through `putAndRemove`. AGENTS.md rule satisfied.

## Other checks (probes, deleted afterwards)

- **Double undo / redo:** the store has no redo API (`useUiStore` exposes only
  `pushUndo`/`undo`/`clearUndo`). Double undo is safe: the split contributes exactly one
  entry; with a prior entry on the stack the second undo runs that prior entry and does not
  resurrect or re-delete the tail. Re-split after undo yields the same two rows (same titles,
  fresh tail id) and undoes cleanly.
- **Toast consolidation:** `ItemEditorSheet.handleSave` now toasts only for `occurrence`
  scope; `future` relies on `updateRecurring`'s single `Series split`, and the null-recurrence
  fallback toasts `Series updated`. No double toast; scope `all` no longer mislabels as
  "Occurrence updated".

## Residual observations (non-blocking)

- **R1 (Low, latent — unreachable via the UI).** `splitSeries` still returns
  `{ head: item, tail: item }` (same id) when `parseLocalDate(fromKey)` is null
  (`src/domain/recurrence.ts:381`). If a *recurring* stored row is handed a non-date `occKey`,
  `createMany([head, tail])` writes one row and the new undo's
  `putAndRemove([stored], [tailPatched.id])` puts then deletes the same id → **the item is
  deleted on undo** (probe: after undo 0 rows). Not reachable today: every `occurrenceKey`
  comes from `formatISODate` (`occ.occKey`) or the notification `data.occKey`, both valid
  `YYYY-MM-DD`. The F1 guard only covers `recurrence === null`, not an invalid key. Cheap
  hardening: skip the undo (or fall back to `all`) when `head.id === tail.id`.
- **R2 (Low, out of scope — disclosed in `discovered-IMP-037.md` §3).** `seriesPatch` never
  carries `recurrence`, so a recurrence *rule* edited in the RecurrenceEditor and saved
  "this and future" is not applied to the tail (the tail keeps the stored rule). Pre-fix the
  edited rule reached both head and tail — which was the very bug this item fixes — so this is
  a deliberate behavior change, untested and outside the acceptance criteria. Worth a
  dedicated item.

## Positive observations

- Criteria 1-4 hold; exact-state restore verified independently (byte-equal `itemRepo.all()`).
- One undo entry, single-transaction undo, no phantom stack entry, idempotent re-split.
- No scope creep; backlog state intentionally untouched (IMP-037 remains `Status: TODO`).
