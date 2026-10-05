# impl-IMP-052 — Fold long ICS lines per RFC 5545

Implements `### IMP-052` (`.improve/FEATURES.md:514-529`). Source finding:
`discovered-IMP-014.md` §3 (content lines never folded). Nothing committed;
`FEATURES.md` status left `TODO`.

## Files
- `src/lib/ics.ts`
  - `MAX_LINE_OCTETS = 75` + a module-level `TextEncoder` (`:6-9`).
  - `foldLine(line)` (`:11-33`) — **new, pure, exported**. Returns the physical
    lines of one content line: `[line]` unchanged when it is already ≤75 octets,
    otherwise a first chunk of ≤75 octets followed by space-prefixed chunks of ≤74
    octets (75 minus the continuation space, so *every* physical line is ≤75).
    Iterates with `for…of`, i.e. **by code point**, and sizes each chunk with
    `TextEncoder.encode(char).length`, so a multi-byte character is never split
    across a fold.
  - `itemsToICS` (`:147`) — `lines.join('\r\n')` → `lines.flatMap(foldLine).join('\r\n')`.
    One call site covers every content line, including the `VALARM`
    `DESCRIPTION` lines from `reminderToAlarm`.
- `src/lib/ics.test.ts`: +3 tests in a new `describe('RFC 5545 line folding')`
  with local `octets()` / `physicalLines()` / `unfold()` helpers. Existing
  assertions untouched and still green.

## Acceptance criteria

| AC | How it is met | Evidence |
| --- | --- | --- |
| 1. every line folded at 75 octets, continuations space-prefixed | `foldLine` caps the first chunk at 75 octets and each continuation at 74 content octets + 1 space; `itemsToICS` folds the whole line array | test 1/2 assert `octets(line) <= 75` for *every* physical line of a real export |
| 2. unfolding reconstructs the value byte-for-byte | continuations are prefixed with exactly one space, which the `unfold` helper strips; concatenation is lossless because the chunking only inserts `\r\n ` at boundaries | test 1 `unfold(ics,'SUMMARY') === \`SUMMARY:${title}\`` for a 200-char title; test 2 does the same for a multi-byte `SUMMARY` **and** `DESCRIPTION` |
| 3. lines ≤75 octets are not folded | early return `[line]` for `octets(line) <= 75` | test 3 pins the exact 75-octet boundary (`SUMMARY:` + 67 `a`) → `[line]`, and 76 octets → `['SUMMARY:'+67a, ' a']`; also asserts a short real export contains no `\r\n ` |
| 4. existing assertions still pass | no existing test edited | 7 pre-existing ics tests green; full suite 279 → 282 |

## Verification method from the spec
Covered as written: a 200-character title, "no output line exceeds 75 octets"
(asserted over the whole export, not just `SUMMARY`), and "unfolding the
`SUMMARY` line equals the full title".

## Extra coverage beyond the spec's recipe
- **Multi-byte / octet folding** (test 2): `'café 🎯 '×20` as both title and
  notes. Asserts every physical line ≤75 octets, that every line still decodes
  under `new TextDecoder('utf-8', {fatal: true})` (so no split code point), that
  a continuation actually hits 75 *octets*, and that continuations always carry
  **fewer than 75 characters** — that last pair is what distinguishes octet
  folding from naive `slice(0, 75)`.
- **Boundary + empty line** (test 3): exact 75 vs 76 octets, and
  `foldLine('') === ['']`.
- Tests use only `TextEncoder`/`TextDecoder`, so they hold under any host
  encoding.

## Mutation checks (all reverted; `git diff` matches the intended change)

| Mutation | Result |
| --- | --- |
| **A** — revert `itemsToICS` to `lines.join('\r\n')` (no folding) | **CAUGHT** — 2 failures (both folding tests) |
| **B** — drop the continuation space (`folded.push(chunk)`) | **CAUGHT** — 3 failures; `unfold` stops at the first continuation |
| **C** — count code units instead of octets (`const size = 1`) | **CAUGHT** — 1 failure: the multi-byte test's 75-octet / <75-char assertions |
| **D** — drop the `length <= MAX_LINE_OCTETS` short-circuit | **CAUGHT** — 1 failure: `foldLine('')` returns `[]` instead of `['']` |

Note on a near-miss found while writing the tests: an earlier iteration joined
with `'\r\n '`, which folded correctly but silently dropped the continuation
space from the emitted text. Mutation B reproduces that failure, which is why
`unfold` is implemented as a real unfold rather than a re-join.

## Gates

```
npm run typecheck   exit 0
npm run lint        exit 0 (0 errors, 0 warnings)
npm run test        Test Files 29 passed (29) | Tests 282 passed (282)
npm run build       exit 0; PWA injectManifest emitted dist/sw.js, precache 18 entries (610.37 KiB)
```

Baseline 279 → **282** (+3, all in `src/lib/ics.test.ts`). `npx prettier --check`
clean on both touched files. Benign `--localstorage-file` warning unchanged.

## Notes / impact
- Export-only change: `itemsToICS` has exactly one consumer
  (`src/features/settings/SettingsView.tsx:90`) and there is no ICS *importer*, so
  nothing in-app consumes folded text. Folding is invisible for any value whose
  `NAME:value` fits in 75 octets, which covers every line this exporter emits
  except user-authored `SUMMARY`/`DESCRIPTION`/`LOCATION` and alarm
  `DESCRIPTION`.
- `foldLine` is exported although only `itemsToICS` and the test use it; that
  mirrors `recurrenceToRRule`, and is the same export-only surface
  `discovered-IMP-014.md` §4 already flagged for that function.
- Adjacent ICS defects found while in the file are **not** fixed here; they are
  recorded in `.improve/reports/discovered-IMP-052.md`.