# IMP-057 — Verification report

**Verdict:** PASS (5/5 acceptance criteria met; 2 non-blocking findings, 2 informational)

Reviewer did not write the change. All claims below are from re-running the gates, a mutation
check, and Playwright against `npm run preview` on port 4173.

---

## 1. Scope, style and hygiene

`git diff` (tracked) + untracked files in scope:

```
 .improve/PROGRESS.log                  |  1 +
 src/components/ui/Dialog.tsx           | 19 ++++++++++++++++---
 src/features/settings/SettingsView.tsx |  6 ++++--
 src/features/shell/ShortcutSheet.tsx  | 11 ++++++++++-
 4 files changed, 31 insertions(+), 6 deletions(-)
?? src/components/ui/Dialog.test.tsx          (new, 6 tests)
?? src/features/shell/ShortcutSheet.test.tsx  (new, 2 tests)
?? .improve/reports/{discovered,impl}-IMP-057.md
?? .kilo/                                  (agent-manager config, unrelated to the item)
```

| Check | Result |
| --- | --- |
| Files touched match the item scope | Yes — 3 overlay files, 2 new test files, 2 reports |
| `useFocusTrap` / `Sheet` untouched | Confirmed — not in the diff |
| Semantic Tailwind tokens only | Yes (`text-fg`, `outline-none`); no slate/white literals |
| Comments | Only one `initialFocusRef` prop doc comment, matching existing style |
| Debug leftovers | None — no `console.log`, no `.only`, no `data-testid`, no commented-out code |
| Secrets | None |
| Unrelated logic changes | None |

---

## 2. Acceptance criteria

### AC1 — ShortcutSheet opens on its heading, not Close — **met**

`src/components/ui/Dialog.tsx:80-86` renders `<h2 ref={titleRef} tabIndex={-1} …>`;
`src/features/shell/ShortcutSheet.tsx:29` passes `headingRef` as both `titleRef` and
`initialFocusRef`.

Playwright (`?` pressed from a clean load of `#/settings`):

```
activeTag: "H2"   activeText: "Keyboard shortcuts"
activeTabIndexAttr: "-1"   isCloseButton: false
dialogHeaderHTML: <h2 tabindex="-1" class="text-lg font-semibold text-fg outline-none" …>
```

Same result when opened from the header "Keyboard shortcuts" button. Baseline (pre-change bundle,
same session) gives `activeTag: "BUTTON" / aria-label="Close dialog"` — the bug is real and is fixed.

The heading is **not** in the Tab sequence:

```
tabbableInRing: false          // matches the FOCUSABLE selector used by useFocusTrap
ringMembers: ["BUTTON:Close dialog"]
```

Live check: with the heading focused, one `Tab` lands on `button "Close dialog"`.

### AC2 — ConfirmDialog focuses Cancel (safe default) — **met**

`Dialog.tsx:121-133`: `cancelRef` is passed as `initialFocusRef` and attached to the Cancel button.
DOM order measured in-browser:

```
domOrder: ['0:BUTTON:Close dialog', '1:BUTTON:Cancel', '2:BUTTON:Delete everything']
cancelIsFirstFooter: true    destructiveIsLast: "Delete everything"
activeIsCancel: true
```

Destructive-path test: with the confirm open (12 items), pressing `Enter` on the focused Cancel
closed the dialog, the Settings counter stayed at `12 items`, and focus returned to the
"Reset all data" opener. Enter cannot reach "Delete everything".

### AC3 — Both SettingsView dialogs focus a meaningful target — **met (deviation accepted)**

The two dialogs are the "Import complete" `Dialog` (`SettingsView.tsx:311-325`, `initialFocusRef={importDoneRef}`
on the Done button) and the reset `ConfirmDialog` (`SettingsView.tsx:327-335`), which inherits AC2.
The spec's ":292/:307" line numbers are stale; the implementation report's reading is correct.

The documented deviation ("the first field for the import dialog") is legitimate: that dialog's body
is a single `<p>` report and it has no input/select/textarea — Done is the only meaningful target.

Playwright:

| Dialog | activeElement on open | Escape → focus back to |
| --- | --- | --- |
| Reset all data (mouse) | `BUTTON` "Cancel" | "Reset all data" |
| Reset all data (keyboard, `Enter` on opener) | `BUTTON` "Cancel" | — |
| Import CSV (file chooser, real CSV uploaded) | `BUTTON` "Done" | "Import CSV" |

The CSV import reported `1 imported` and the counter went `12 items → 13 items`, so the probe file
parsed; the item was left in the local test profile only.

### AC4 — Focus returns to the opener; Escape and the Tab loop unchanged — **met**

In-browser, each Escape restored focus to its opener (header "Keyboard shortcuts" button, "Reset all
data", "Import CSV"). Unit tests cover the same path plus
`Dialog.test.tsx:keeps the Tab loop unchanged: last focusable wraps to Close` (real wrap: the shim
gives non-zero `offsetParent`, and `defaultPrevented` is asserted on the wrap Tab).

The three IMP-009 overlays did **not** regress — each still focuses its own ref:

| Overlay | activeElement |
| --- | --- |
| QuickAdd (`C`) | `textbox "Quick add…"` |
| CommandPalette (`/`) | `combobox "Search views and actions…"` |
| ItemEditorSheet (`N`) | `textbox "Title"` |

`ItemEditorSheet` uses `Sheet` (`Sheet.tsx` untouched), so the `Dialog` heading change cannot reach it.

### AC5 — No visual change — **met, with a documented correction (see Issue 1)**

Measured by building both the pre-change and post-change bundles and diffing screenshots taken at a
matched route (`#/settings`), matched scroll (`scrollTop = 0`), and matched viewport. Geometry is
identical before and after:

| Viewport | Element | Before | After |
| --- | --- | --- | --- |
| 1280x800 | dialog / header / h2 / body | `448,185,384,430` / `449,186,382,69` / `465,202,165,28` / `449,255,382,359` | identical |
| 1280x800 | scrollHeight / clientHeight | `428` / `428` | `428` / `428` |
| 390x844 | dialog / header / h2 / body | `3,414,384,430` / `4,415,382,69` / `20,431,165,28` / `4,484,382,359` | identical |
| 390x844 | scrollHeight / clientHeight | `428` / `428` | `428` / `428` |

Pixel diff of the paired screenshots (no image tooling in the repo; decoded with a throwaway
`zlib` + PNG unfilter script in `/tmp`, not committed):

```
1280x800: 2248 / 1024000 px differ (0.2195%), bbox x461 y198 w358 h44
 390x844: 2248 /  329160 px differ (0.6830%), bbox x16  y427 w358 h44
```

The delta is confined to the 44 px-tall header strip and is exactly the focus indicator moving from
the Close ✕ button to the heading (both rings are the same 2 px accent ring with a 2 px offset).
The dialog body is pixel-identical. No layout shift at either width, and no size/colour/spacing class
changed — consistent with AC5's own wording.

---

## 3. Gates

```
npm run typecheck   → clean
npm run lint        → clean
npm run test        → 25 files, 188 tests passed (baseline 180 + 8 new)
npm run build       → dist/sw.js emitted, 18 precache entries, 604.45 KiB
```

Re-run after every file restore; final tree hash `git diff | shasum` = `22f180f3…` and
`git status --porcelain` shows only the change plus reports.

---

## 4. Mutation check

**(a) Call-site wiring removed** — stripped `initialFocusRef={…}` from
`Dialog.tsx` (ConfirmDialog), `ShortcutSheet.tsx` and `SettingsView.tsx`:

```
× ShortcutSheet > opens with focus on the dialog heading
× ShortcutSheet > returns focus to the opener on close
× ConfirmDialog > focuses Cancel, not the destructive confirm button
× ConfirmDialog > closes on Escape and returns focus to the opener
Tests  2 failed | 4 passed (8)
```

The 4 survivors are the two designed controls/guards (`still starts on Close without an initial
focus ref`, `keeps the Tab loop unchanged`) plus two tests that do not depend on the wiring
(`Dialog > focuses the title heading…` supplies `initialFocusRef` itself; `Dialog > returns focus to
the opener…`). Both load-bearing wiring tests fail, so the check is satisfied.

**(b) Primitive wiring removed** — `useFocusTrap<HTMLDivElement>(open, initialFocusRef)` →
`(open, undefined)`: **7 of 8 fail**, the sole survivor is the control
`still starts on Close without an initial focus ref`. This matches the implementation report's
"7 of the 8" claim. Every mutated file was restored byte-for-byte; gates re-run green afterwards.

`SettingsView`'s `initialFocusRef={importDoneRef}` is **not** covered by any test (there is no
SettingsView test file) — mutation (a) produced 0 failures for it. It was verified in-browser only,
which the item's verification method permits.

---

## 5. Browser verification (Playwright, `npm run preview`)

Stale service-worker trap reproduced (`discovered-IMP-057.md` §5 is accurate and was hit here: a
hash-only `goto` does not reload, and the registered SW kept serving the baseline bundle until
`getRegistrations().unregister()` + `caches.delete('workbox-precache-v2-…')` + `location.reload()`).
All results below are from a clean, SW-free load of the post-change bundle.

- `?` → activeElement is `H2` "Keyboard shortcuts" (`tabindex="-1"`), **not** the Close button.
- `Tab` from the focused heading → `Close dialog` (heading is not in the ring).
- Destructive confirm → activeElement is `Cancel`; footer DOM order `Close, Cancel, Delete everything`.
- `Enter` on focused Cancel → dialog closes, `12 items` unchanged, focus on the opener.
- Escape → opener restored in all three Settings/ShortcutSheet paths.
- QuickAdd / CommandPalette / ItemEditorSheet still focus their own refs.
- **Console messages: 0** (`browser_console_messages` returned an empty list).

Screenshots in `.improve/artifacts/IMP-057/` (git-excluded via `.git/info/exclude:51`):

| File | Content |
| --- | --- |
| `before-1280-shortcut-sheet.png` | pre-change bundle, heading unfocused, ring on ✕ |
| `after-1280-shortcut-sheet.png` | post-change, ring on heading |
| `before-390-shortcut-sheet.png` | pre-change, 390 px |
| `after-390-shortcut-sheet.png` | post-change, 390 px |
| `after-1280-confirm-cancel-focused.png` | reset confirm, Cancel active (mouse-opened, no ring) |
| `after-390-confirm-cancel-focused.png` | reset confirm opened by `Enter`, ring visible on Cancel |
| `after-today-1280-shortcut-sheet.png` | first-pass capture on `#/today` |

---

## Findings

### Issue 1 (non-blocking, report correction required): the criterion-5 rationale is wrong

`impl-IMP-057.md:19` claims *"`outline-none` guarantees the programmatic focus paints nothing
(criterion 5)"*. It does not. `src/styles/index.css:64-65` has a global
`:focus-visible { @apply outline-none ring-2 ring-accent ring-offset-2 ring-offset-bg; }`, and
Tailwind's `outline-none` only sets `outline: 2px solid transparent` — it cannot remove a
`ring-*` box-shadow. Measured on the focused heading:

```
matchesFocusVisible: true
computedBoxShadow:    rgb(248,250,252) 0 0 0 2px, rgb(79,70,229) 0 0 0 4px, rgb(248,250,252) 0 0 0 2px
computedOutlineColor: rgba(0,0,0,0)
```

A visible accent ring is painted around the heading (clearly visible in
`after-1280-shortcut-sheet.png` / `after-390-shortcut-sheet.png`). Consequences:

- `Dialog.tsx:83`'s `outline-none` is effectively redundant — the global rule already applies it.
  The class is harmless, but it does not do what the report says it does.
- AC5 is still met on its own terms (no layout/size/colour/spacing change; layout is pixel-identical,
  and a focus indicator moving is an unavoidable consequence of AC1/AC2), but the report's stated
  evidence for AC5 is invalid.

**Action:** correct `impl-IMP-057.md:19`. If a ring-free heading is actually wanted, the class must
be `focus-visible:ring-0` (and `focus-visible:outline-none`); if the ring is acceptable, drop the
redundant `outline-none` and say so. Decide explicitly rather than leaving a class whose rationale
is disproven.

### Issue 2 (non-blocking): no regression test protects the SettingsView target

`SettingsView.tsx:323`'s `initialFocusRef={importDoneRef}` has no automated coverage; removing it
failed zero tests. AC3's SettingsView half is browser-verified only. A follow-up test (or a shared
`initialFocusRef` assertion for import/reset) would close this.

### Informational 1: `PROGRESS.log` line belongs to the previous item

The only non-source diff line is `2026-10-05 IMP-051 b9c15b7 — full calendar/list-state regression
sweep`. That documents the already-committed IMP-051 (HEAD is `b9c15b7`), not IMP-057. Per
`.improve/STATE.md:20` ("PROGRESS.log is appended immediately after each commit with the resulting
SHA") this is a conforming catch-up for the prior commit and needs no change; the IMP-057 line
belongs in the commit step.

### Informational 2: `discovered-IMP-057.md` §2 (double announcement) is worth tracking

`Dialog.tsx:69` sets `aria-label={title}` while also rendering the `<h2>{title}</h2>`, so focusing
the heading can announce the dialog name twice. Already correctly deferred as out of scope;
`aria-labelledby` is the real fix.

---

## Verdict

**PASS.** All five acceptance criteria are met with independent evidence: focus targets are correct
in-browser (heading / Cancel / Done), focus never enters the Tab sequence, focus restoration and
Escape/Tab behaviour are unchanged, the three IMP-009 overlays are unregressed, layout is provably
identical at 1280 px and 390 px, and the gates are green at 188 tests with a mutation check that
kills the new wiring tests. One report claim is factually wrong (Issue 1) and one test-coverage gap
exists (Issue 2); neither blocks the item, and Issue 1 should be corrected in the implementation
report before commit.