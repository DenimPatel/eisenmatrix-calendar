# Verify IMP-138 — Make the quick-add preview reflect the Kind/Date/Time overrides

Independent, skeptical verification of the uncommitted change. I did not write it.

- **Verdict: PASS** (all three acceptance criteria met; all five gates green; browser reproduced).
- **Artifacts:** `.improve/artifacts/IMP-138/verify-01..06*.png`.

## Scope inspected

`git status` (uncommitted):

```
 M .improve/FEATURES.md
 M src/domain/quickadd.test.ts
 M src/domain/quickadd.ts
 M src/features/quickadd/QuickAdd.test.tsx
 M src/features/quickadd/QuickAdd.tsx
?? .improve/reports/discovered-IMP-138.md
?? .improve/reports/impl-IMP-138.md
```

Diff is +210/−4 across the four source/test files plus FEATURES.md. No debug leftovers, no
`console.log`, no unrelated source edits, no lockfile/dist/schema/migration changes.

## Acceptance criteria

1. **Changing Kind updates the kind chip and hides inapplicable chips before commit — MET.**
   `quickAddPreviewChips` (src/domain/quickadd.ts:477-516) builds the kind chip from
   `overrides.kind`, drops `amount`/`quantity` when the effective kind's data payload does
   not carry the field (via `quickAddDataFor`), and drops `recurrence` for
   `NON_RECURRING_KINDS = ['note']`. Browser: `bill`→`note` = `note · date · Urgent`
   (amount and recurrence hidden); `bill`→`event`/`task` = `event|task · date · every month
   on the 5 · Urgent` (amount hidden, recurrence kept).
2. **Changing Date/Time updates the chip — MET.** Helper prefers `overrides.date`/`time`;
   browser `2026-12-25` + `14:30` produced chips `task · 2026-12-25 · 14:30 · every month on
   the 5 · Urgent`; unit + jsdom tests cover both.
3. **No override ⇒ byte-identical chips — MET.** Unit test asserts
   `quickAddPreviewChips(parsed, { kind: parsed.kind })` `toEqual(parsed.chips)`; field set,
   wording and order match `parseQuickAdd` (quickadd.ts:389-400). Browser control case
   reproduced `bill · 2026-10-18 · every month on the 5 · USD 120 · Urgent`.

## Commit-path change (the item under scrutiny)

`QuickAdd.tsx:65`: `if (effectiveKind === 'note') item.recurrence = null;`, inside the
`if (effectiveKind !== item.kind)` branch.

- **Necessary for a truthful preview?** Yes, *given the chosen preview semantics*. The
  preview hides the recurrence chip for a Note, but the pre-change commit path kept
  `parsed.recurrence` (set by `quickAddToItem`), so the stored row would have carried a
  recurrence the preview denied. Without this line the preview lies. The alternative would
  have been to *not* hide recurrence for a Note (see risk below).
- **Correctly limited to the override case?** Yes. The guard is `effectiveKind !== item.kind`,
  so a plain commit (no kind override) never enters the branch. Verified by reading and by
  the byte-identical control test.
- **Breaks an explicitly parsed rule for a Note?** No for the normal path. A parse that is
  already `note` (explicit `note:` prefix) is committed via the non-override path and keeps
  `parsed.recurrence`; the helper also shows the recurrence chip in that case
  (`kindChanged === false`). Only an *override into* `note` drops a parsed rule, and that is
  the intended override case, announced by the hidden chip.
- **Breaks any non-override commit?** No. The single added line is unreachable without a
  kind change.

## Risk / inconsistency (non-blocking)

`NON_RECURRING_KINDS = ['note']` is an assumption not encoded in the model: `BaseItem`
carries `recurrence` for every kind and `ItemEditorSheet.tsx:678-684` renders the
`RecurrenceEditor` for a Note without a kind gate. So a note created via the editor may
recur, and a note created via an explicit `note:` quick-add keeps + previews its recurrence,
while a note reached by *overriding* the kind has recurrence hidden and cleared. Notes are
excluded from `nextUp` (`NON_ACTIONABLE_KINDS`), so a stored note recurrence is largely
inert, which makes the choice defensible — but the asymmetry is a design wart the spec did
not mandate. It is adjacent to, and does not resolve, IMP-179.

## Gates (all PASS, 2026-10-19)

```
npm run typecheck   PASS
npm run lint        PASS
npm run test        74 files / 734 tests PASS
npm run format:check PASS
npm run build       PASS (dist/sw.js, 28 precache entries)
```

## Browser check (isolated preview `--port 4186 --strictPort`; SW/caches reset per AGENTS.md)

1280×800 and 390×844; sample `pay electricity $120 every month on the 5th !urgent`.

| Viewport | Action | Chips |
|---|---|---|
| 1280×800 | control (no override) | `bill · 2026-10-18 · every month on the 5 · USD 120 · Urgent` |
| 1280×800 | Kind → note | `note · 2026-10-18 · Urgent` |
| 1280×800 | Kind → event | `event · 2026-10-18 · every month on the 5 · Urgent` |
| 1280×800 | Kind → task | `task · 2026-10-18 · every month on the 5 · Urgent` |
| 1280×800 | Date → 2026-12-25, Time → 14:30 | `task · 2026-12-25 · 14:30 · every month on the 5 · Urgent` |
| 1280×800 | Kind → note (pre-commit) | `note · 2026-12-25 · 14:30 · Urgent` |
| 390×844 | control | `bill · 2026-10-18 · every month on the 5 · USD 120 · Urgent` |
| 390×844 | Kind → note | `note · 2026-10-18 · Urgent` |

Committed Note row read from IndexedDB `eisenmatrix/items`:

```json
{ "kind": "note", "title": "Pay electricity", "start": "2026-12-25T14:30",
  "allDay": false, "urgency": "high", "importance": "low", "recurrence": null,
  "dueAt": "2026-12-25T14:30", "tags": [], "data": { "pinned": false } }
```

Stored row equals the last preview (kind, no amount, date/time, urgency, recurrence null).
Unmodified-input chips unchanged. **0 console errors/warnings; all 11 requests HTTP 200.**

## Mutation checks

Source restored byte-identical after each (verified with `diff -q`).

| Mutation | Tests that fail |
|---|---|
| kind chip label `overrides.kind` → `parsed.kind` | 3: `quickAddPreviewChips > updates the kind chip and drops inapplicable chips for a Note`; `> drops the amount but keeps recurrence when the kind becomes a Task`; `QuickAdd > tracks the Kind override in the preview chips` |
| date chip ignores override (`overrides.date \|\| …` removed) | 2: `quickAddPreviewChips > reflects a date override in the date chip`; `QuickAdd > tracks the Date and Time overrides in the preview chips` |
| **commit-path** `if (effectiveKind === 'note') item.recurrence = null;` removed | **0 — full suite (74 files / 734 tests) still green** (round 1) → **1 after the fix (see Re-check)** |

Kind and date derivations are mutation-caught. In round 1 the commit-path recurrence
clearing was **not covered by any automated test** — its behavior was verified only by the
browser check. The implementer added jsdom commit tests; see the Re-check below.

## State/backlog files

Only `.improve/FEATURES.md` is modified (plus the two new IMP-138 reports). `STATE.md`,
`PROGRESS.log`, `HANDOFF.md`, `DIMENSIONS.md`, `CHANGELOG.md` are untouched.

Two observations inside FEATURES.md:

1. IMP-138 status flipped `TODO` → `IN-PROGRESS` (expected; the change is uncommitted).
2. A *second* edit in the same file: IMP-137's Notes `Commit pending.` → `Commit 058136f.`
   (HEAD is `058136f`, so the record is accurate, but it is beyond the IMP-138 status flip
   the task scoped).
3. `impl-IMP-138.md:6` claims "`.improve/FEATURES.md` status untouched", which contradicts
   the observed `TODO → IN-PROGRESS` flip — a documentation inaccuracy in the impl report.

## Health delta

No regressions. Baseline gates all green before and after; test count rose 725 → 734
(+9). No new console errors, no failed requests, no schema/migration/lockfile changes.

## Re-check (round 2) — commit-path test coverage

The implementer added three jsdom tests to `src/features/quickadd/QuickAdd.test.tsx`
(`QuickAdd.test.tsx` now +175 lines vs. +74 in round 1). Only the test file changed; the
implementation (`QuickAdd.tsx`, `quickadd.ts`) is byte-identical to round 1.

### New tests

- `drops the parsed recurrence when a bill is committed as a Note` — types the sample,
  overrides Kind to `note`, asserts chips `['note', <date>, 'Urgent']`, commits, and asserts
  the stored row `kind === 'note'`, `recurrence === null`, no `amount`. **This is the test
  that covers the commit-path guard.**
- `keeps the parsed recurrence when a Note is committed without a kind override` — types
  `note: pay electricity every month on the 5th`, commits with no override, asserts
  `kind === 'note'` and `recurrence?.freq === 'monthly'`. Genuine control: the concrete
  expectation would fail on `null`/`undefined`, so it truly asserts the parsed recurrence
  survives for a non-override Note.
- `keeps an explicitly parsed recurrence on a Task commit` — types `gym mon/wed/fri 7am`,
  commits, asserts `kind === 'task'` and `recurrence?.freq === 'weekly'`. Genuine control for
  an explicit Task rule.

### Gates (round 2, 2026-10-19)

```
npm run typecheck   PASS
npm run lint        PASS
npm run test        74 files / 737 tests PASS  (+3 vs round 1)
npm run format:check PASS
```

### Commit-path mutation re-run

Neutralized the guard (`if (effectiveKind === 'note') item.recurrence = null;` removed from
`QuickAdd.tsx`), then ran the suite, then restored the file (`diff -q` clean; guard present
at `QuickAdd.tsx:65`).

- Targeted file: 1 failed / 9 passed.
- **Full suite: 1 failed / 736 passed** — the single failure is
  `QuickAdd > drops the parsed recurrence when a bill is committed as a Note`.
- The two control tests still pass under the mutation, as expected (they exercise
  non-override paths), confirming they guard the opposite direction.

The round-1 coverage gap is closed: the commit-path change is now mutation-caught.
