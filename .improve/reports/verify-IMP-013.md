# Verification report — IMP-013

**Item:** Suppress global shortcuts while overlays are open
**Branch:** `improve/auto-20261003` · **Base commit:** `4f4b361` (IMP-012)
**Verifier:** independent review · **Date:** 2026-10-04
**Verdict: PASS** — all 3 acceptance criteria met, no blocking issues.

---

## 1. Acceptance criteria

| # | Criterion | Result | Evidence |
| - | --------- | ------ | -------- |
| AC1 | When any of `editor.open`, `quickAddOpen`, `commandOpen`, `shortcutsOpen` is true, navigation/create/theme shortcuts do not fire | **MET** | §3 visual + §4 unit + bundle inspection §2 |
| AC2 | `⌘/Ctrl+Z` undo still works from within an open overlay when the target is not a typing field | **MET** | §3.3 visual + unit test line 189 |
| AC3 | The shortcut sheet still opens with `?` when no overlay is open | **MET** | §3.4 visual + unit test line 139 |

AC1's "theme" clause is **vacuously satisfied** — no theme keybinding exists in
`useKeyboardShortcuts`; the theme toggle is a header button only. Correctly disclosed by the
implementer in `discovered-IMP-013.md` §2.

---

## 2. Guard placement — the specific claims under test

Requirement: the guard must **not** block `⌘/Ctrl+K` or `⌘/Ctrl+Z`, must not break Escape, and
must still allow `?` when no overlay is open.

`src/hooks/useKeyboardShortcuts.ts` after the change (lines 25–69, guard on line 42):

```ts
if (meta && event.key.toLowerCase() === 'k') { … setCommandOpen(true); return; }   // L28-32  ⌘K BEFORE guard
if (meta && event.key.toLowerCase() === 'z') { … undo() … return; }                // L33-40  ⌘Z BEFORE guard
if (isTypingTarget(event.target)) return;                                          // L41
if (overlayOpen) return;                                                           // L42  ← the guard
// L44 '?'  L49 '/'  L54 'c'  L59 'n'  L64 nav digits  — all behind the guard
```

Verified ordering claims individually:

| Claim | Result | How |
| ----- | ------ | --- |
| `⌘K` **not** blocked | **CONFIRMED** | `⌘K` with the shortcuts sheet open stacked the Command palette (2 dialogs, both `role="dialog"`). Live browser, trusted key event. |
| `⌘Z` **not** blocked | **CONFIRMED** | `⌘Z` with the item editor Sheet open ran undo — toast "Undone", task reverted `1/1 done` → `0/1 done`, "What's next" row returned, editor stayed open. Live browser, trusted key event. |
| Escape not broken | **CONFIRMED** | `useKeyboardShortcuts` never handled Escape (unchanged). Escape ownership is `src/components/ui/Sheet.tsx:34` and `src/components/ui/Dialog.tsx:43` — neither touched by this diff. Live: Escape closed the open editor Sheet. |
| All **four** overlay flags covered | **CONFIRMED** | `src/store/useUiStore.ts:86` — `state.commandOpen \|\| state.quickAddOpen \|\| state.shortcutsOpen \|\| state.editor.open`. |
| Closing the top overlay re-enables shortcuts | **CONFIRMED** | Escape closed the editor → `?` immediately reopened the shortcut sheet. Live browser. |

**Built-bundle confirmation** (guards against a stale SW precache serving the old bundle —
the trap flagged in `discovered-IMP-013.md` §5). `dist/assets/index-C4jdaKCB.js` contains both
the predicate and the merged handler guard:

```
function L0(n){return n.commandOpen||n.quickAddOpen||n.shortcutsOpen||n.editor.open}
…metaKey||p.ctrlKey;if(j&&p.key.toLowerCase()==="k"){…}if(j&&p.key.toLowerCase()==="z"){…}
if(Nh(p.target)||r)return;if(p.key==="?"){…}
```

`⌘K` and `⌘Z` return *before* `if(Nh(p.target)||r)return;`. `r` is `overlayOpen`. Ordering is
preserved through minification. The SW was also unregistered and `workbox-precache-v2-…`
deleted before verification, then a full reload performed.

---

## 3. Visual verification (Playwright)

`npm run preview` → `http://localhost:4173/eisenmatrix-calendar/` · viewport 1440×900.
Probe task `IMP013 probe task` created via Quick add, then marked done to seed an undo entry
(`saveItem` pushes no undo on create — `discovered-IMP-013.md` §3). Probe deleted afterwards;
data returned to the pre-verification baseline (`Today's agenda 0`, "Nothing scheduled today").

### 3.1 Editor open — digits / `n` / `c` do not fire

Editor opened with `n` (untitled Task Sheet). Focus deliberately moved to the **History tab**
(`BUTTON / role=tab / text="History (0)"`) — a **non-input** target inside the Sheet, which is
exactly the reported defect condition.

| Key | `defaultPrevented` | `location.hash` after | dialogs open |
| --- | --- | --- | --- |
| `1` … `9` (all 9) | `false` | `#/today` | 1 |
| `c` | `false` | `#/today` | 1 |
| `n` | `false` | `#/today` | 1 |
| `?` | `false` | `#/today` | 1 |
| `/` | `false` | `#/today` | 1 |

Before the sweep: `{hash: "#/today", dialogs: 1}`. Unchanged for all 13 keys.
`defaultPrevented === false` for every key proves no handler branch was entered, not merely
that the visible state happened to match.

Cross-checked with **trusted** Playwright key events (not synthetic): `2` → still `#/today`,
still 1 dialog; `c` → still `#/today`, still 1 dialog.

Screenshot: `.improve/artifacts/IMP-013/01-editor-open-suppressed-keys.png`

### 3.2 Happy path intact (no overlay open)

`c` with no overlay open opened Quick add. `2` with no overlay open → `#/calendar` (unit test).
Pinned by unit tests at `src/hooks/useKeyboardShortcuts.test.tsx:121-157`.

### 3.3 `⌘Z` from inside the open editor

Trusted `Meta+z` while the editor Sheet was open and focus was on the History tab:

- Toast **"Undone"** rendered (`role="status"`)
- Agenda reverted `1/1 done` → `0/1 done`, progress ring 100% → 0%
- "What's next" row reappeared
- Editor Sheet **stayed open**, route stayed `#/today`

Screenshot: `.improve/artifacts/IMP-013/02-undo-inside-editor.png`

### 3.4 Close → `?` reopens the sheet

`Escape` closed the editor Sheet → `Shift+Slash` (produces `key: "?"`) opened
`dialog "Keyboard shortcuts"` with all 8 rows (`⌘/Ctrl+K`, `C`, `N`, `/`, `1 – 9`, `⌘/Ctrl+Z`,
`?`, `Esc`). Confirms AC3 **and** that closing the top overlay re-enables shortcuts.

Screenshot: `.improve/artifacts/IMP-013/03-shortcut-sheet-reopened-after-close.png`

### 3.5 Console

`playwright_browser_console_messages` returned **an empty array** — zero errors and zero
warnings for the whole session (navigation, editor, all key sweeps, undo, both overlays,
probe creation and deletion). The baseline `--localstorage-file` Node warning is a Vitest-side
stderr line, not a browser console message.

---

## 4. Gates

`npm run typecheck && npm run lint && npm run test && npm run build` — all exit 0.

| Gate | Result |
| ---- | ------ |
| `npm run typecheck` | clean, no diagnostics |
| `npm run lint` | clean, no output |
| `npm run test` | **22 files / 156 tests passed** (was 21/140 per the impl report; baseline 10/49 per `REPO_PROFILE.md` §3) |
| `npm run build` | OK — `dist/sw.js` emitted, precache 18 entries (603.65 KiB) |

`npx prettier --check` on all three touched files: "All matched files use Prettier code style!"

---

## 5. Mutation check

Neutralized the guard and confirmed the suppression tests fail.

```
cp src/hooks/useKeyboardShortcuts.ts /tmp/uks.bak.ts
perl -0pi -e 's/      if \(overlayOpen\) return;\n//' src/hooks/useKeyboardShortcuts.ts
npm run test
```

Result — **exactly the 4 suppression tests failed**, the other 152 stayed green:

```
 Test Files  1 failed | 21 passed (22)
      Tests  4 failed | 152 passed (156)

 FAIL  … > does not navigate or create while shortcutsOpen is set
AssertionError: key "2" must not fire: expected { path: '/calendar', …(5) } to deeply equal { path: '/today', …(5) }
 FAIL  … > does not navigate or create while the editor is open
AssertionError: key "2" must not fire: expected { path: '/calendar', …(5) } to deeply equal { path: '/today', …(5) }
```

(the `it.each` × 3 covers `commandOpen` / `quickAddOpen` / `shortcutsOpen`; plus the editor case)

Restored and re-verified:

```
cp /tmp/uks.bak.ts src/hooks/useKeyboardShortcuts.ts
grep -c "if (overlayOpen) return;" → 1
npm run test → Test Files 22 passed (22) / Tests 156 passed (156)
```

**Conclusion:** the suite pins the guard itself, not the plumbing. Removing the guard breaks the
suppression tests; restoring it restores green.

---

## 6. Diff review — scope, style, unrelated changes, leftovers, secrets

### Files in the change

| File | Lines | Assessment |
| ---- | ----- | ---------- |
| `src/store/useUiStore.ts` | +13 | `OverlayState` interface + pure `isOverlayOpen` predicate. Additive only; no existing state, action, or type was altered. |
| `src/hooks/useKeyboardShortcuts.ts` | +13 / −2 | One new import, one selector subscription, one guard line, one dep-array entry. Dep array reformatted to multi-line because it crossed the print width (prettier-clean). |
| `src/hooks/useKeyboardShortcuts.test.tsx` | new, 226 | 16 tests. |
| `.improve/reports/impl-IMP-013.md` | new | Report. |
| `.improve/reports/discovered-IMP-013.md` | new | Out-of-scope findings, correctly quarantined. |

### Checks

- **Scope creep: none in `src/`.** The change is 2 production lines of behaviour plus a
  selector. No feature file, no store action, no component, no router, no DB, no styling touched.
- **Gating `/` in addition to the AC-named keys** — correct, not creep. `/` opens the command
  palette, the same second-overlay defect as `c`; AC3's "**when no overlay is open**" phrasing
  implies `?` is meant to be gated, and leaving `/` ungated would make `?` and `/` inconsistent.
  Justified in the impl report.
- **`⌘K` deliberately left working** — matches AC text (it is not a navigation/create/theme
  shortcut) and this review's explicit requirement. The resulting palette-stacking residual is
  honestly disclosed in `discovered-IMP-013.md` §1 rather than hidden.
- **Conventions (`AGENTS.md` / `REPO_PROFILE.md` §5):** no direct Dexie; no direct
  `localStorage`/`sessionStorage`; no `Date.toISOString()` for date keys; no new hardcoded
  slate/white or raw Tailwind colours; no UI primitive added outside `components/ui/`; layering
  respected (`hooks → store`, `store → lib`); no `sync/` seam touched.
- **Comments:** the single new comment on `isOverlayOpen` explains non-obvious *intent* (why a
  global shortcut must stand down), which `AGENTS.md` explicitly permits. The test file has one
  explanatory JSDoc and one pragma. No comment spam.
- **Test conventions:** `// @vitest-environment jsdom` pragma + `createRoot` + `act` — identical
  to `src/hooks/useFocusTrap.test.tsx`, `src/hooks/useData.test.tsx`,
  `src/features/command/CommandPalette.test.tsx`, `src/features/quickadd/QuickAdd.test.tsx`.
  Real `KeyboardEvent`s dispatched on `document`, matching the pattern the handler's registration
  site requires.
- **Test quality:** assertions use a **full state snapshot** (`path`, all three overlay flags,
  `editor.open`, `editor.item.id`) rather than "is false" — correct, since the flag under test is
  already `true` in three of the four cases. The suite pins the happy path too (`2`→`/calendar`,
  `c`, `n`, `?`), so the guard cannot be "fixed" by disabling shortcuts outright.
- **Debug leftovers: none.** Scanned the three `src/` files for `console.*`, `debugger`,
  `TODO`/`FIXME`/`XXX`/`HACK` — zero matches. No stray `.only`, `.skip`, or commented-out code.
- **Secrets: none.** No key/token/credential material in the diff. `.env.local` (gitignored,
  contains a stale `GEMINI_API_KEY` placeholder per `REPO_PROFILE.md` §6) was not read, printed,
  or touched.
- **Unrelated changes in `src/`: none.**
- **`.kilo/`** shows as untracked. This is the local Kilo agent-config directory from the
  harness environment, not part of the implementer's change.

### Minor observations (non-blocking, no action required for this item)

1. **`.improve/PROGRESS.log` records the wrong item.** The only working-tree change outside
   `src/` is one appended line:
   `2026-10-04T04:39Z | IMP-012 | done | 4f4b361 | item cards show occurrence time; +resolveCardTime`
   That is **IMP-012**'s commit, not IMP-013's. There is **no** IMP-013 row. The file is
   tracked (so `*.log` gitignore does not apply) and the append is not mentioned in
   `impl-IMP-013.md`. Bookkeeping only — zero runtime impact — but whoever closes IMP-013 should
   add the correct row. Note this change was present before verification began
   (`git status` at session start) and was **not** produced by the verifier.
2. **`FEATURES.md` still reads `Status: TODO`** for IMP-013. `impl-IMP-013.md` line 3 states
   this was intentional (reserved for the closing step). Consistent with the harness workflow;
   flagged only so it is not mistaken for a missed step.
3. **Palette/Sheet stacking remains reachable via `⌘K`.** Confirmed live in this review (two
   stacked dialogs). Pre-existing, out of AC scope, already logged as
   `discovered-IMP-013.md` §1 and §4. Correctly deferred, not silently absorbed.
4. **`⌘Z` inside the editor mutates data behind the Sheet.** This is unchanged from `4f4b361`
   and is precisely what AC2 mandates. Noted only because it interacts with the
   no-undo-on-create gap in `discovered-IMP-013.md` §3.

---

## 7. Reproduction

```bash
npm run typecheck && npm run lint && npm run test && npm run build   # all green
npm run preview                                                      # 4173
# browser: unregister SW + delete caches + FULL reload before judging behaviour
#   navigator.serviceWorker.getRegistrations() → unregister()
#   caches.keys() → caches.delete(k)
# N → click the History tab → 1..9 / c / n / ? / / : route and dialog count must not move
# Meta+z with the Sheet open : toast "Undone", editor stays open
# Escape, then Shift+Slash : shortcut sheet reopens
```

Artifacts (locally excluded via `.git/info/exclude`, so they will not be committed):

- `.improve/artifacts/IMP-013/01-editor-open-suppressed-keys.png`
- `.improve/artifacts/IMP-013/02-undo-inside-editor.png`
- `.improve/artifacts/IMP-013/03-shortcut-sheet-reopened-after-close.png`

**No commit was made by this verification.** The only file added by the verifier is
`.improve/reports/verify-IMP-013.md`.