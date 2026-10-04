# Verify report — IMP-007 (Stop note quick-add truncating long first lines)

**VERDICT: PASS**

Reviewer: independent verification pass. Branch `improve/auto-20261003`, HEAD `6eeaab9`,
working-tree change under review (uncommitted). Nothing was committed; no source file was
left modified by this review.

---

## 1. Change under review

```
git status --porcelain=v1
 M .improve/PROGRESS.log
 M src/domain/quickadd.test.ts
 M src/domain/quickadd.ts
 M src/features/notes/NotesView.tsx
?? .improve/reports/discovered-IMP-007.md
?? .improve/reports/impl-IMP-007.md
?? .kilo/
?? src/features/notes/NotesView.test.tsx
```

Diffstat of source (`git diff --stat -- src`): `quickadd.ts` +15, `NotesView.tsx` 4+/2-,
`quickadd.test.ts` +44, plus new `src/features/notes/NotesView.test.tsx` (109 lines).

Production change is 2 files / 19 lines:

- `src/domain/quickadd.ts:344-357` — new pure `NOTE_TITLE_MAX = 80`, `NoteDraft`,
  `splitNoteDraft(text)`:
  ```ts
  const [firstLine = '', ...restLines] = text.split('\n');
  const title = firstLine.slice(0, NOTE_TITLE_MAX);
  const overflow = firstLine.slice(NOTE_TITLE_MAX);
  return { title, notes: overflow ? [overflow, ...restLines].join('\n') : restLines.join('\n') };
  ```
- `src/features/notes/NotesView.tsx:31` — `addNote` now
  `createItemPersisted(createItem({ kind: 'note', ...splitNoteDraft(text) }))`; the inline
  `firstLine.slice(0, 80)` and manual `split('\n')` are gone.

No other production file touched. `createItem` accepts `title`/`notes` directly
(`src/domain/itemFactory.ts:28-29, 51-52`), so the spread is type-correct and cannot
collide with `data` (`:73`).

## 2. Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| AC1 | Single-line note >80 chars stored in full, no characters dropped | **met** | Overflow moves into `notes`; `title + notes === input`. Unit: `quickadd.test.ts:59-64` (`'x'.repeat(200)` → `title` 80 + `notes` 120). Property fuzz (10 000 cases, §3). Live app: 222-char single line → 80 + 142 = 222 (§6). |
| AC2 | Multi-line maps first line → `title`, rest → `notes` | **met** | `quickadd.test.ts:73-78`; `NotesView.test.tsx:88-97`; live app: `'Groceries\nmilk\neggs\n\nand bread'` → title `Groceries` (9), notes `milk\neggs\n\nand bread` (20) — interior blank line preserved. |
| AC3 | 200-char single line re-read from Dexie returns all characters across title+notes | **met** | `src/features/notes/NotesView.test.tsx:76-86` mounts the real `NotesView`, types into the textarea, clicks **Add note**, then polls `itemRepo.all()` (real Dexie + fake-indexeddb) and asserts `note.title + note.notes === text`. Passes. |

Short notes are unchanged: `splitNoteDraft('tiny')` → `{title:'tiny', notes:''}`, and live
app stored title `tiny` / notes `""`. Exactly-80-char line is not truncated
(`quickadd.test.ts:68-72`) and live app confirmed 80 `B`s → title only, body preserved as
`body line`.

## 3. Character-preservation (independent, not the author's tests)

Temporary suite `src/domain/__tmpReview007.test.ts` (written by this reviewer, run, then
deleted — `git status` confirms the tree is clean):

```
npx vitest run src/domain/__tmpReview007.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

Covers, all green:

1. 5 000 randomized single-line strings (len 0–259, alphabet incl. space, tab, é, 😀, `.`)
   → `title + notes` strictly equals input.
2. 5 000 randomized multi-line strings → all non-newline characters preserved, `title` is
   always a prefix of the input, `title.length ≤ 80`.
3. Cap boundaries 0/1/78/79/80/81/82/160 → exact round-trip; 200 → 80 + 120.
4. Interior blank lines (`'a\n\n\nb'` → `{a, '\n\nb'}`), leading whitespace preserved
   (`'  lead\nbody'` → title `'  lead'`), over-cap first line + indented following line.
5. CRLF (`'w'×100 + '\r\nsecond\r\n'`) and trailing newline both round-trip exactly.
6. Uniform reconstruction invariant: `title + notes === text` holds for **every** input,
   including multi-line and over-cap-first-line cases (no separator is inserted because the
   overflow continues line 1).

One reviewer-side correction worth recording: my initial assertion `title + '\n' + notes ===
text` for an over-cap first line was **wrong** and failed — the implementation is right
(overflow continues line 1, so `title + notes` is the correct reconstruction). I fixed my
test, not the source.

Whitespace handling: `addNote` still calls `draft.trim()` before the split, exactly as
before the change, so leading/trailing whitespace of the whole draft is trimmed
(pre-existing, unchanged behaviour). Interior leading whitespace on line 1 is now preserved
verbatim (`'  lead'`), which the old code also did.

## 4. Mutation check — the new tests genuinely pin the fix

Three separate mutations, each reverted immediately and verified reverted
(`git diff --stat` back to `quickadd.ts +15 / NotesView.tsx 6`):

| Mutation | Change | Result |
|---|---|---|
| A — old bug restored | `notes: restLines.join('\n')` (drop overflow) | **8 failures**: `quickadd.test.ts` "never drops characters from a long single line" (notes len 0, expected 120), "preserves every character when the first line overflows the cap", `NotesView.test.tsx` "stores a 200-character single line…" |
| B — off-by-one, loses 1 char | `firstLine.slice(NOTE_TITLE_MAX + 1)` | **3 failures**, incl. "expected 'xxx…' to have a length of 120 but got 119" and the Dexie round-trip test — a single dropped character is caught |
| C — view ignores body | `NotesView` → `createItem({kind:'note', title: splitNoteDraft(text).title})` | **2 failures**: 200-char test and "maps a multi-line draft to title and body" (`expected '' to be 'milk\neggs'`) |

The committed tests are not vacuous. After restoring, the full suite is green again.

## 5. Gates

```
npm run typecheck   -> tsc --noEmit, no diagnostics
npm run lint        -> eslint ., no output
npm run test        -> Test Files 15 passed (15) | Tests 110 passed (110)   (baseline 100/14)
npm run build       -> built in 68ms; dist/sw.js emitted; precache 18 entries (602.78 KiB)
npx prettier --check src/domain/quickadd.ts src/domain/quickadd.test.ts \
  src/features/notes/NotesView.tsx src/features/notes/NotesView.test.tsx
                    -> All matched files use Prettier code style!
```

Only the known benign Node `--localstorage-file` warning appears. No new failures.

## 6. Visual check (dev server, Playwright)

`npm run dev` on :3000, route `#/notes` (dev server used to sidestep the stale-service-worker
trap documented in `discovered-IMP-007.md`). Typed a 222-char single line
(`AAAA-0123456789abcdef-…-ENDOFNOTE-xyz`), clicked **Add note**:

- Card renders the 80-char title, and the body paragraph begins exactly where the title ends
  (`789abcdef-…-ENDOFNOTE-xyz`) and terminates correctly — nothing dropped or duplicated.
- Direct IndexedDB read of the persisted row: `titleLen 80`, `notesLen 142`, `total 222`,
  `endsCorrectly true`.
- Multi-line `Groceries\nmilk\neggs\n\nand bread` → title `Groceries`, notes
  `milk\neggs\n\nand bread`. Short `tiny` → title only. Exactly-80 + `\nbody line` → title 80,
  notes `body line`.
- Draft cleared after add; the button re-disables.
- **Console: zero errors/warnings** — only `[vite] connecting/connected` DEBUG and the React
  DevTools INFO banner.
- Screenshot: `.playwright-mcp/improve-imp007-notes-long-note.png` (dark theme; that path is
  excluded via `.git/info/exclude:52`). Test data deleted from IndexedDB afterwards.

## 7. Scope, style, and hygiene findings

No scope creep in production code, no debug leftovers, no secrets
(`git diff | grep -Ei "api[_-]?key|secret|token|password|Bearer"` → none; `.env.local`
untouched). Comments are limited to two that explain non-obvious intent (the helper's
JSDoc and the async-Dexie-write note), which AGENTS.md permits. No new `localStorage`, no
direct Dexie in production code, no date/`toISOString` handling, no hardcoded slate/white,
styling untouched.

Issues found — all minor, none blocking:

1. **Unrelated change in the diff: `.improve/PROGRESS.log`.** The only modified line is the
   IMP-049 bookkeeping row (`2026-10-04T03:07Z | IMP-049 | done | 6eeaab9 | …`), a leftover
   from the *previous* item that was never committed. It is not IMP-007 work and will be
   swept into this commit. Action: keep it (it is a legitimate delayed log append) but be
   aware it is not part of IMP-007; or split it into a bookkeeping commit.
2. **`.kilo/` is untracked and not gitignored** (`git check-ignore` finds no rule for
   `.kilo/kilo.jsonc`; only `.kilo/.gitignore` covers `node_modules`, lockfiles,
   `agent-manager.json`). Action: do **not** `git add -A`; stage paths explicitly, or add
   `.kilo/` to `.gitignore`.
3. **`FEATURES.md` IMP-007 not updated** — still `Status: TODO` with an empty `Notes:`
   (every completed item has `Status: DONE` + a Notes line, e.g. IMP-006 `:121`). The impl
   report acknowledges this deliberately. Action: set `Status: DONE` and append the Notes
   line when the item is closed out.
4. **Test-only convention deviation: `src/features/notes/NotesView.test.tsx:67,72` call
   `db.items.clear()` and `db.delete()` directly.** AGENTS.md / REPO_PROFILE §5 say "no
   direct Dexie outside `src/db/`". This is the only test file that does so
   (`CalendarView.test.tsx` uses `settingsRepo`). Action: use `itemRepo.replaceAll([])` for
   the reset (`src/db/repository.ts:116`), and drop the `db.delete()` teardown, which no other
   test file has and which is unnecessary with fake-indexeddb. No functional impact — the
   suite is green — but it is a one-line cleanup that keeps the layering rule intact.
5. **Polish (non-blocking, agree with the author's own note):** the overflow is prepended to
   the body mid-word, so a long unbroken first line is split at an arbitrary character
   (`…0123456` / `789abcdef…` in the card). Lossless, but a word-boundary split would read
   better. Out of scope for a correctness fix; already captured in
   `discovered-IMP-007.md` #2 (the 80-char cap is quick-add-only; the editor title field has
   no `maxLength`).

Cross-checks on the author's claims in `impl-IMP-007.md`: "110 tests in 15 files" —
confirmed. "`prettier --check` clean" — confirmed. "negative check makes the 200-char test
fail" — reproduced independently (mutations A/B/C). "Playwright: 230-char line stored as
80 + 150" — reproduced in kind at 222 chars (80 + 142).

## 8. Files inspected

`src/domain/quickadd.ts:341-357`, `src/domain/quickadd.test.ts:57-100`,
`src/features/notes/NotesView.tsx:28-33`, `src/features/notes/NotesView.test.tsx:1-109`,
`src/domain/itemFactory.ts:26-76`, `src/db/repository.ts:35-128`,
`src/features/calendar/CalendarView.test.tsx:1-45`, `src/test/setup.ts`,
`.improve/FEATURES.md:140-154`, `.improve/REPO_PROFILE.md`, `.improve/STATE.md`,
`.improve/PROGRESS.log`, `.improve/reports/impl-IMP-007.md`,
`.improve/reports/discovered-IMP-007.md`, `vitest.config.ts`, `.gitignore`/`check-ignore`.

**No commit was made.** The only file this review added is this report.
