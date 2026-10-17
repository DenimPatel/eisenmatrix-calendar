# Verify IMP-062 — Normalize CRLF in quick-add line splitting

- **Verdict:** PASS
- **Reviewer:** independent verification (did not author the change)
- **Date:** 2026-10-17
- **Branch:** `improve/auto-20261017`

## Acceptance criteria

1. **CRLF and lone CR normalized before splitting — MET.** `src/domain/quickadd.ts:432`
   now does `text.replace(/\r\n?/g, '\n').split('\n')`. The regex consumes `\r\n` as one
   break and every remaining `\r` as a lone break, so no `\r` can reach `title`/`notes`
   (both are derived from the normalized string). The overflow branch is untouched.
2. **CRLF result equals LF result — MET.** `\r\n` → `\n` makes the inputs byte-identical
   before the split. The new test asserts `toEqual(splitNoteDraft(lf))` directly
   (`quickadd.test.ts:359-363`).
3. **80-char split loses no characters — MET.** `NOTE_TITLE_MAX` slicing is unchanged and
   runs after normalization. The two existing long-line/exact-cap tests still pass; a
   direct probe confirmed 80-char and 81-char first lines mint the same title/overflow as
   before, and a 80-char line followed by CRLF yields `notes: 'body'` with no lost tail.
4. **Other parsers unchanged — MET.** `git diff` touches only `splitNoteDraft`; `parseQuickAdd`
   (`:116`) and its `split(/\s*(?:\/|,|and)\s*/)` at `:241` are untouched. `splitNoteDraft`'s
   only production call site is `NotesView.tsx:31`, which passes trimmed textarea input.

## Non-vacuity (executed)

Replayed the two new tests against HEAD's implementation (`text.split('\n')`):
`"Buy milk\r\nCall mum\r\n"` → `{ title: 'Buy milk\r', notes: 'Call mum\r\n' }` (fails
`title === 'Buy milk'`, `not.toContain('\r')`, and LF equality); `"a\r\nb\nc\rd"` →
`{ title: 'a\r', notes: 'b\nc\rd' }`. Both tests genuinely fail on the old code.

## Edge probes (executed against the bundled function)

- `a\r\n\r\nb` → `{ title: 'a', notes: '\nb' }` — identical to LF `a\n\nb`, blank line kept.
- `'y'.repeat(80)` → full 80-char title, empty notes.
- `'y'.repeat(80) + '\r\nbody'` → title = 80 chars, notes = `'body'` (no char loss).
- `'y'.repeat(81) + '\r\nbody'` → title = 80 chars, notes = `'y\nbody'`.
- `a\rb` → `{ title: 'a', notes: 'b' }`, no `\r` retained.

## Gates

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run test` — PASS, 41 files / **427** tests (baseline 425 + 2 new).
- `npx prettier --check` on both changed source files — pass; `git diff --check` — clean.

## Scope / style

One-line behavioural change plus two focused tests in the existing `describe`. No
refactor, no new dependency, no style drift. The `.improve/CHANGELOG.md` and
`.improve/PROGRESS.log` edits in the worktree are uncommitted leftovers from IMP-065 and
predate this implementation; `FEATURES.md` only flips IMP-062 to IN-PROGRESS. None are
IMP-062 code scope creep. The implementation report's "state files untouched" claim is
accurate for IMP-062 itself.

## Suggested Bugs/Correctness health delta

4 → 4 (no change): this closes a latent data-hygiene defect that never surfaced in the UI,
and the dimension's acknowledged biggest gap remains concurrency (IMP-088/IMP-089). The
fix is correct and regression-tested, so no downward pressure either.
