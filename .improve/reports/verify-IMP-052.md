# verify-IMP-052 — Independent verification of `### IMP-052`

Reviewer: independent verifier (did not author the change). Item:
`.improve/FEATURES.md:514-529`. Impl report: `.improve/reports/impl-IMP-052.md`.
Conventions: `.improve/REPO_PROFILE.md`. Branch `improve/auto-20261003`, HEAD
`7c85fc7`. Nothing committed by this review; only this report was added.

## Verdict

**PASS** — all four acceptance criteria are met, the folding is correct at the
octet level, and 5/5 mutations are caught. Two pre-existing (not-introduced)
defects remain open and are correctly disclosed rather than silently shipped:
raw `\r` in values, and a missing final CRLF.

---

## 1. Scope of the diff

```
 src/lib/ics.test.ts | 71 ++++++++++++++++++++++++++++++   (3 new tests + 1 import)
 src/lib/ics.ts      | 30 +++++++++++++++++++++++++++++++   (foldLine + 1 call site)
```

| File | Change | In scope? |
| --- | --- | --- |
| `src/lib/ics.ts:6-33` | `MAX_LINE_OCTETS`, module `TextEncoder`, exported pure `foldLine` | yes — AC1/AC2/AC3 |
| `src/lib/ics.ts:147` | `lines.join('\r\n')` → `lines.flatMap(foldLine).join('\r\n')` | yes — single call site, covers every content line incl. VALARM `DESCRIPTION` |
| `src/lib/ics.test.ts:105-173` | new `describe('RFC 5545 line folding')` with local `octets`/`physicalLines`/`unfold` helpers | yes — spec verification method |

- **No scope creep.** Nothing outside `ics.ts`/`ics.test.ts` is touched by the
  change itself. `.improve/PROGRESS.log` has one **unrelated** uncommitted line
  (`DISCOVERY-1 … ff5cb5b`, a leftover of the already-committed discovery round),
  not produced by IMP-052 — flagging only so the eventual commit does not sweep
  it in unnoticed.
- **No unrelated changes, no debug leftovers, no secrets.** `grep` for
  `console.log|debug`, `TODO`, `FIXME`, `XXX` in both files: zero hits.
- **Style:** only two short comments, both carrying non-obvious intent (the RFC
  §3.1 octet cap), consistent with `AGENTS.md` "no comments unless non-obvious".
  `npx prettier --check src/lib/ics.ts src/lib/ics.test.ts` → clean. No
  hardcoded colors, no new deps, no `lib → non-leaf` dependency edge (only
  `./date` + `@/types` as before).
- **Export surface:** `foldLine` is exported but used only by `itemsToICS` and
  the test. Disclosed in the impl report; mirrors the existing
  `recurrenceToRRule` precedent. Acceptable.
- `itemsToICS` has exactly one consumer (`src/features/settings/SettingsView.tsx:90`)
  and there is no ICS **importer** anywhere in `src`, so folded text cannot
  break in-app behavior.

## 2. Acceptance criteria

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. every content line folded at 75 octets, continuations space-prefixed | **met** | §3 strict validator: 12,974 physical lines over 408 exports, max = **exactly 75** octets, every continuation begins with a space; `foldLine` caps chunk 1 at 75 and continuations at 74 + 1 fold space (`src/lib/ics.ts:22`) |
| 2. unfolding reconstructs the value byte-for-byte | **met** | §3 differential proof: `unfold(new) === HEAD-export` **byte-for-byte** for 408 fuzz exports (emoji, ZWJ, flags, CJK, Hangul, combining marks, ZWSP, NBSP, escapes) |
| 3. lines ≤75 octets not folded | **met** | `src/lib/ics.ts:13` early return; `src/lib/ics.test.ts:154-163` pins 75 → `[line]`, 76 → `['SUMMARY:'+67a, ' a']`; my unit sweep confirms every ≤75-octet input comes back as a single identical line (incl. `''` → `['']`) |
| 4. existing `ics.test.ts` assertions still pass | **met** | no existing assertion edited; 7 pre-existing tests green; suite 279 → **282** |

## 3. Rigorous folding validation (independent, no repo test involved)

No offline ICS parser is available (`icalendar`, `recur_ical`, `icalBuddy`,
`khal`, `node-ical` all absent), so I built one:

- `esbuild`-bundled the **modified** `src/lib/ics.ts` and the **HEAD**
  (`git show HEAD:src/lib/ics.ts`) exporter side by side, plus `createItem`.
- Validators (`/var/folders/.../kilo/imp052/verify.mjs`):
  1. **Octet-level framing** — encode the export to a `Buffer`, split on
     `0x0D 0x0A` **bytes**, then assert every chunk is ≤ 75 bytes and
     `new TextDecoder('utf-8',{fatal:true}).decode(chunk)` succeeds. A code
     point split across a fold makes this throw → **no split code points**,
     verified on the actual octets, not on JS strings.
  2. No stray CR/LF counts (`crlf === lf === cr`).
  3. **Unfold** = strip `CRLF` + exactly one space → compared to the **HEAD
     exporter's output** for the same item (differential round-trip).
  4. Structure: `BEGIN/END` nesting stack balanced, first/last line
     `BEGIN:VCALENDAR`/`END:VCALENDAR`, VEVENT count, and every
     `SUMMARY`/`DESCRIPTION`/`LOCATION` value equal to an independently
     re-implemented `escapeText`.

Result: `corpus=408 export lines checked=12974`, `max octets among all
lines=75`, **`ALL STRICT CHECKS PASSED`** (exit 0).

Extra properties confirmed:
- Fold is **greedy**: for every continuation except the last, adding the next
  code point would exceed 75 octets (`foldLine` fills maximally; a 71-octet
  chunk followed by a 4-byte emoji stops at 71 — valid, not maximal-punishing).
- **No empty continuation** is ever emitted (the `if (chunk) push(chunk)`
  tail guard is correct; a line ending exactly on a boundary yields
  `[75-oct chunk, ' x']`, never `[…, '']`).
- **End-to-end byte safety**: `downloadFile` uses
  `new Blob([content], {type:'text/calendar;charset=utf-8'})`
  (`src/lib/backup.ts:124-126`) — UTF-8, **no BOM**, no newline translation, so
  folded bytes and CRLF reach disk unchanged.
- Test's discriminating assertions genuinely bite (measured for the exact test
  input `'café 🎯 '×20`): continuations = 6, octets `[72,75,9,75,75,12]`,
  chars `[47,48,5,48,47,8]` → `some(octets===75)` **true**,
  `every(chars<75)` **true**. So the "octets not chars" pair is real, not vacuous.

### Correctness notes on `foldLine` (`src/lib/ics.ts:12-33`)
Iterating `for…of` walks **code points**, and each is sized with
`utf8.encode(char).length`, so a multi-byte sequence can never straddle a fold.
The `chunk &&` guard prevents an infinite/oversized chunk if a limit were ever
smaller than one character; unreachable with the current constants. Lone
surrogates keep their original code units in the output (round-trip exact) even
though `TextEncoder` measures them as 3 octets — a measurement-only skew, not
corruption, and out of scope.

## 4. Gates (fresh run by this reviewer)

| Gate | Exit | Detail |
| --- | --- | --- |
| `npm run typecheck` | **0** | `tsc --noEmit`, no diagnostics |
| `npm run lint` | **0** | no output, 0 errors/warnings |
| `npm run test` | **0** | `Test Files 29 passed (29)` / `Tests 282 passed (282)` (baseline 279, +3) |
| `npm run build` | **0** | `✓ built in 55ms`; PWA `injectManifest` → `dist/sw.js`, precache 18 entries (610.37 KiB) |

Benign `--localstorage-file` warning unchanged from baseline
(`REPO_PROFILE.md` §7).

## 5. Mutation checks (5/5 caught, all reverted; `diff -q` vs pristine = IDENTICAL)

| # | Mutation | Result |
| --- | --- | --- |
| A | `lines.flatMap(foldLine).join` → `lines.join` (**folding removed**) | **CAUGHT** — 2 failures (both folding tests) |
| B | `folded.push(chunk)` (**continuation space removed**) | **CAUGHT** — 3 failures |
| C | `const size = utf8.encode(char).length` → `char.length` (**chars, not octets**) | **CAUGHT** — 1 failure (multi-byte test's 75-octet / <75-char pair) |
| D | delete the `length <= MAX_LINE_OCTETS` early return (**no ≤75 short-circuit**) | **CAUGHT** — 1 failure (`foldLine('')` → `[]`) |
| E | *(extra, mine)* continuation budget `74` → `75` (**fold space not reserved**) | **CAUGHT** — 2 failures (both `octets(line) <= 75` assertions) |

Mutation B is the exact near-miss the impl report describes (join with `'\r\n '`
instead of space-prefixing chunks); it is caught because `unfold` is a real
unfold rather than a re-join.

## 6. Issues (none blocking)

1. **Pre-existing, disclosed — raw `\r` is not escaped** (`src/lib/ics.ts:35-41`,
   `discovered-IMP-052.md` §1). Confirmed empirically: a title `'A\rB'` emits
   the literal `SUMMARY:A\rB`, so a consumer sees a line break where folding did
   not put one, and AC2's byte-for-byte invariant cannot hold for CR-bearing
   content. Independent of this change (it breaks importers today, folded or
   not), and outside every AC. One-line fix available (`/\r\n|\r|\n/g → '\\n'`)
   — belongs in a follow-up item.
2. **Pre-existing, disclosed — no final CRLF.** `ics.endsWith('\r\n') === false`;
   RFC 5545 §3.1 terminates the object with CRLF. Strict validators may reject.
   Unchanged by this diff.
3. **Nit, non-blocking — `lines.flatMap(foldLine)`** (`src/lib/ics.ts:147`)
   passes `(value, index, array)`; `foldLine` arity 1 ignores the extras, so it
   is correct today, but `(line) => foldLine(line)` would be robust against a
   future second parameter.
4. **Nit — coverage gap:** no test asserts the VALARM `DESCRIPTION`
   (`reminderToAlarm`, `src/lib/ics.ts:104`) folds *and* unfolds back to the
   label, even though it is the only other line that can exceed 75 octets. My
   fuzz covered it (alarm `DESCRIPTION` matched `escapeText(title)` in all 408
   cases), but a regression there would be invisible to `npm run test`.
5. **Process:** `FEATURES.md` still says `Status: TODO` for IMP-052 and no
   `PROGRESS.log` line exists for it. Correct while uncommitted; the orchestrator
   must set status/notes + append the log line at commit time. Note the
   `.kilo/` untracked directory in the tree — stage explicitly, never `git add -A`.

## 7. Reproduction

```bash
npm run typecheck && npm run lint && npm run test && npm run build
npx prettier --check src/lib/ics.ts src/lib/ics.test.ts
# strict validator (esbuild-bundles HEAD + working ics.ts, then 408 fuzz exports)
node "$TMPDIR/kilo/imp052/verify.mjs"   # → ALL STRICT CHECKS PASSED
```