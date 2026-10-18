# Verify IMP-037 — "This and future" split: head from persisted row + undo

**Reviewer:** independent (did not author the change)
**Verdict: FAIL** — the normal path is fixed and gated, but the change introduces a
reachable regression (silent recurrence loss + undo deletes the item) when the persisted
row has no recurrence yet. See F1.

## Scope reviewed

`git diff` + untracked: `src/domain/itemActions.ts`, `src/features/item/ItemEditorSheet.tsx`,
`src/domain/itemActions.test.ts`; reports `impl-IMP-037.md`, `discovered-IMP-037.md`.
No other files touched — no scope creep, no leftovers.

## Gates (all run on the working tree)

| Command | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run test` | 43 files / **477 passed** (baseline 474, +3) |
| `npm run format:check` | clean |
| `npm run build` | success (PWA precache 18 entries) |

## Acceptance criteria

1. **Head built from persisted original; only tail patched — PASS (normal case).**
   `src/domain/itemActions.ts:359-360` reads `stored` before `splitSeries` and passes it;
   `tailPatched` receives the patch. A throwaway probe calling
   `updateRecurring(patchedDraft, 'future', …)` (the real editor shape) confirmed
   `head.title === 'Standup'` while `tail.title === 'Standup (retro)'`, and that
   `splitSeries(draft, …)` (the old path) *would* have patched the head.
2. **Single undo entry restoring original + removing tail — PASS for the normal case,
   FAIL for the null-recurrence case (F1).** Exactly one `pushUndo` runs on the future
   path; probe confirmed `undo()` restores `itemRepo.all()` byte-equal to the pre-split
   snapshot and a second undo is a no-op. But when `stored.recurrence` is null the closure
   deletes the item instead of restoring it.
3. **Past occurrences before `occKey` unchanged — PASS.** Head keeps the stored
   `recurrence.overrides`/`exceptions` (probe verified), so pre-split occurrences resolve
   to their original values.
4. **`count` follows IMP-023 — PASS.** Untouched; the existing count test still passes.

## Findings

### F1 (High) — Reachable regression: future-split of a just-added recurrence drops the rule and undo deletes the item

`splitSeries` short-circuits when `item.recurrence` is null:
`return { head: item, tail: item }` (`src/domain/recurrence.ts:379`) — the tail keeps the
**same id** as the head. In the future branch (`src/domain/itemActions.ts:359-381`) the
stored row can have `recurrence: null` while the draft carries a newly added rule.

Reachable path (no hand-crafted data needed): open a plain, non-recurring task from Today
or Calendar (`expandOccurrences` yields one occurrence, so `occurrenceKey` is set), add a
recurrence in the editor (the "This and future" tabs appear once `draft.recurrence` is
truthy), pick **This and future**, Save. `stored.recurrence` is still null, so:

- `head` and `tail` are the same row; `itemRepo.create(head)` then
  `itemRepo.create(tailPatched)` write the **same id** → one row, and the new recurrence is
  **silently dropped** (the probe: 1 row, `recurrence: null`).
- The new undo closure runs `itemRepo.create(stored)` then
  `itemRepo.remove(tailPatched.id)` where `tailPatched.id === item.id` → **undo deletes the
  user's item**. Probe output: `rows after split: 1 ['p']` → `undo result: true rows after
  undo: 0` → `itemRepo.get('p') === undefined`.

This is a regression introduced by the diff: pre-fix the head was built from the draft, so
the rule survived (at the cost of patching past occurrences) and there was no undo entry to
delete the row. `discovered-IMP-037.md` §1 notes the degenerate split but calls it "low
severity, no test covers it" and does **not** disclose that the new undo now destroys the
item — so criterion 2 ("restores the original item") is violated in this case.

Suggested guard: only split when `stored.recurrence` is present; otherwise fall back to
treating the scope as `all` (patch the stored row) or abort with a message — and never
`remove` an id that was not actually created as a new tail.

### F2 (Med) — The two "head untouched" tests do not exercise the bug

`src/domain/itemActions.test.ts:844-871` pass the **unpatched persisted row** as the `item`
argument and the patch separately. The editor passes the **patched draft** as `item`. With
an unpatched `item`, `splitSeries(item, …)` and `splitSeries(stored, …)` are identical, so
reverting line 360 to `splitSeries(item, …)` leaves all three tests green — the mutation is
not caught. The undo test (line 873) *is* sensitive (it fails pre-fix because no entry was
pushed). Add a case that passes `{ ...stored, title: 'Standup (retro)' }` as `item`.

### F3 (Low) — Undo closure is not atomic

The closure performs two independent repository calls (`create(stored)` then
`remove(tailPatched.id)`); elsewhere the codebase wraps multi-row mutations in one
`db.transaction` (`repository.ts:82`, `:96`, `:119`). A failure between the two would leave
both head and tail. Not in the acceptance criteria; noted for robustness.

## Positive observations

- Criterion 1/3/4 hold in the normal case; probe with the real patched-draft shape passed.
- Exactly one undo entry on the future path; second undo is a no-op; exact-state restore.
- Toast consolidation is correct: `ItemEditorSheet` no longer double-toasts a split, and
  `updateRecurring`'s single `toast('Series split', 'success')` is authoritative; occurrence
  scope keeps its own toast. (Side effect: scope `all` no longer mislabels a save as
  "Occurrence updated".)
- No scope creep; backlog state intentionally left untouched by the implementer.

_Throwaway probe (`src/domain/__probe_imp037.test.ts`) was deleted after use; working tree
contains only the three tracked modified files and the two report files._
