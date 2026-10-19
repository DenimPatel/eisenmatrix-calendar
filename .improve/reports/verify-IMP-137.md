# Verification — IMP-137 (item editor Start-time control no longer clips AM/PM)

**Verifier:** independent (did not author the change)
**Date:** 2026-10-19
**Branch:** `improve/auto-20261018` (uncommitted)
**Baseline claim:** all gates green at HEAD (`b26f352`).

## VERDICT: PASS

Both acceptance criteria are met. The fix is a one-line width change plus regression tests;
no other time input regressed. One non-blocking scope note: `FEATURES.md` carries a second,
unrelated (but accurate) bookkeeping line beyond the IMP-137 status flip — see §5.

---

## 1. Scope review

`git status` / `git diff` (uncommitted):

```
 M .improve/FEATURES.md                       (IMP-137 status TODO -> IN-PROGRESS; +1 unrelated line, see §5)
 M src/features/item/ItemEditorSheet.tsx      (input w-28 -> input w-36, 1 line)
 M src/features/item/ItemEditorSheet.test.tsx (+45: two new tests, appended)
 M src/features/quickadd/QuickAdd.test.tsx    (+22: one new test, appended)
?? .improve/reports/impl-IMP-137.md
```

- **No scope creep / unrelated edits.** Only the one production line changed. No other view,
  hook, store, schema, migration, `package.json`/lockfile (no new dependencies) or config
  touched. No other `.improve` state/backlog file modified.
- **No debug leftovers**: no `console.*`, `debugger`, `TODO`/`FIXME` in changed files.
- **No other time input regressed.** `grep -rn 'type="time"' src/` finds exactly four:
  | File | Class | Verdict |
  | --- | --- | --- |
  | `src/features/item/ItemEditorSheet.tsx:629` | `input w-36` | **changed** (was `w-28`) |
  | `src/features/settings/SettingsView.tsx:291` | `input w-36` | unchanged (already fixed) |
  | `src/features/item/ReminderEditor.tsx:58` | `input` (= `w-full`) | unchanged |
  | `src/features/quickadd/QuickAdd.tsx:185` | `input` (= `w-full`) | unchanged |
  `.input` is `w-full` (`src/styles/index.css:85`), so the two `w-full` controls cannot be
  narrower than their column. `git diff` confirms only the editor line changed.

## 2. Static gates (all green)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS (no output) |
| `npm run lint` | PASS (no output) |
| `npm run test` | PASS — 74 files, 725 tests |
| `npm run format:check` | PASS — "All matched files use Prettier code style!" |
| `npm run build` | PASS — `dist/sw.js` generated, precache 28 entries (656.68 KiB) |

Matches the implementer report exactly (74 files / 725 tests). No baseline failure introduced.

## 3. Browser verification

Isolated preview: `npm run preview -- --port 4184 --strictPort` →
`http://localhost:4184/eisenmatrix-calendar/`. SW registrations + caches cleared per AGENTS.md
(`unregistered: 1`, cleared `workbox-precache-v2-http://localhost:4184/...`), then
`about:blank` → URL for a real document load. Fresh origin (empty DB); created a timed item
(`Team meeting`, 2026-10-19 09:00) via Quick-add, then opened it → Schedule tab.

### Start-time input (widest value `12:00 AM` forced via the input setter)

| Viewport / theme | class | clientWidth | scrollWidth | clipped | content box | widest text | clock room |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1280x800 light | `input w-36` | 120 | 120 | false | 96px | 61.1px | 35px |
| 1280x800 dark | `input w-36` | 120 | 120 | false | 96px | 61.1px | 35px |
| 390x844 light | `input w-36` | 117 | 117 | false | 93px | 61.1px | 32px |
| 390x844 dark | `input w-36` | 117 | 117 | false | 93px | 61.1px | 32px |

`clientWidth >= scrollWidth` at every viewport/theme; the full `HH:mm AM/PM` plus the native
clock affordance are visible with no clipping or overlap (35px/32px of slack beyond the widest
value). At 390px the flex row shrinks the control slightly (117 vs 120) but it stays
unclipped.

### Other time inputs
- **Settings digest** (`aria-label="Daily digest time"`, `input w-36`): 390 → clientWidth 142,
  scrollWidth 142, clipped false, clock room 57px; "08:00 AM" fully visible. Unchanged.
- **QuickAdd time override** (`input`, `w-full`): 1280 → 197/197; 390 → 328/328; both
  unclipped, "07:00 AM" fully visible. Unchanged.

### Console / network
0 console errors, 0 warnings (all levels, `all: true`); 0 failed requests (resource-timing
scan for non-2xx/3xx returned `[]`). ✔

**Artifacts:** `.improve/artifacts/IMP-137/` —
`verify-editor-1280-light.png`, `verify-editor-1280-dark.png`, `verify-editor-390-light.png`,
`verify-editor-390-dark.png`, `verify-settings-digest-1280-light.png`,
`verify-settings-digest-390-light.png`, `verify-quickadd-1280-light.png`,
`verify-quickadd-390-light.png`. (The implementer's four `editor-*.png` are also present.)

## 4. Test quality (non-vacuous — confirmed by mutation)

Reintroduced `w-28` on `ItemEditorSheet.tsx:629`, ran
`npx vitest run ItemEditorSheet.test.tsx QuickAdd.test.tsx`, then restored the file
(`git diff` confirms the tree is back to `-w-28 +w-36`):

| Mutation | Result |
| --- | --- |
| `input w-36` → `input w-28` | **1 failed / 25** |

**Exactly one test catches it:**
`ItemEditorSheet.test.tsx > ItemEditorSheet time inputs > sizes the Start-time input to fit the
AM/PM indicator`, failing at `expect(time!.className).not.toContain('w-28')`
(`ItemEditorSheet.test.tsx:609`). The second editor test renders an all-day item (where the
Start-time input is absent), and the QuickAdd test guards only the `w-full` override — so the
class-assertion test is the sole non-vacuous guard for this control, and it works.

## 5. Files / state check

Only `.improve/FEATURES.md` is modified among state/backlog files. `.improve/artifacts/` is
excluded via `.git/info/exclude:50`, so screenshots do not pollute the tree.

**Deviation (non-blocking):** the `FEATURES.md` diff contains **two** hunks, not just the
IMP-137 status flip:

```
- **Notes:** ... routeMetaFor ... Commit pending.      (IMP-136 note)
+ **Notes:** ... routeMetaFor ... Commit b26f352.      (IMP-136 note)
- **Status:** TODO                                     (IMP-137)
+ **Status:** IN-PROGRESS                              (IMP-137)
```

The IMP-136 line updates its note from `Commit pending.` to `Commit b26f352.` — accurate
(commit `b26f352` exists, `git log` confirms) but outside IMP-137's scope and not the
"FEATURES status flip". `HEAD:.improve/FEATURES.md` still says `Commit pending.`, so this is an
uncommitted, unrelated bookkeeping edit (plausibly an orphan from the IMP-136 session that
could not know its own hash). It touches no other state file and has no effect on IMP-137's
correctness; flagged for cleanliness only.

## 6. Observations (non-blocking, not criteria violations)

1. `FEATURES.md` is left at `IN-PROGRESS` while `impl-IMP-137.md` says "done" — the DONE flip
   is presumably deferred to integration (same pattern as IMP-136).
2. The regression guard parses explicit `w-<n>` classes only; a `w-full` control squeezed into
   a very tight flex row would not be caught by the class check. Not an issue at the tested
   widths (both `w-full` controls have ample slack), but it is a class-level rather than
   rendered-width guard. Documented by the implementer.
3. `hasTooNarrowTimeWidth` treats any numeric `w-<n>` below 32 as too narrow; it does not
   consider `min-w-*`/`max-w-*` utilities. Adequate for the current codebase.

## Suggested health delta per dimension touched

- **Correctness / visual:** +1 (primary scheduling control no longer truncates its AM/PM
  indicator; matches the already-fixed digest precedent; no data-path change).
- **Test coverage:** +1 (three new assertions; the class assertion is mutation-proven
  non-vacuous; the guard is shared with QuickAdd).
- **Performance / security / data integrity / accessibility:** 0 (no change).
