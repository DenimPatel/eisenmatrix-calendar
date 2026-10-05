# impl-IMP-024 — attempt 3: toast clearance, safe-area inset, landmark disambiguation

**Retry attempt 3 (final).** The two-row 5×2 mobile nav from attempt 2 is **kept exactly as
it was** — same grid, same cells, same active pill, same 101px bar. This attempt fixes only
the three defects the attempt-2 verifier introduced or exposed (`verify-IMP-024.md` §2.4,
§2.5, §2.6) and adds the regression tests that were missing.

| verifier finding (attempt 2) | cause | status now |
| --- | --- | --- |
| §2.4 **ISSUE-1 (blocking)** — toast at `bottom-20` overlapped the bar by 21px and its `Undo` button sat on the Lists/Goals cells | a fixed pixel offset next to a bar that had just grown | **eliminated** — the offset is *derived* from the bar's own rendered height, so the two cannot drift |
| §2.5 **ISSUE-2** — `viewport-fit=cover` with no `env(safe-area-inset-bottom)` anywhere; row 2 sat under the iOS home indicator | inset never applied | **eliminated** — the bar pads itself by the inset, and the two consumers add the same inset |
| §2.6 nit — both navs named `navigation "Primary"` | attempt 2 named both | **eliminated** — rail is `Primary sections`, mobile bar keeps `Primary` |

## The one idea: publish the bar's height, do not guess it

`bottom-20` was correct for a 56px bar and wrong for a 101px one. Any fixed number will be
wrong again the next time a row, a cell height or a device inset changes, so nothing in the
repo hardcodes it any more.

```
src/lib/layout.ts                    MOBILE_NAV_HEIGHT_VAR = '--mobile-nav-h'
                                     publishMobileNavHeight(px) / clearMobileNavHeight()

MobileBottomNav  measures the <nav> grid with getBoundingClientRect() and writes it to
                 documentElement's inline style. Refreshed by a ResizeObserver *and* by
                 `resize` / `visibilitychange`, because RO notifications are deferred when
                 the tab is not rendering (measured — see "The RO trap" below).
                 Removed again on unmount, so no stale var can outlive the bar.

ToastHost        bottom-[calc(var(--mobile-nav-h,7rem)+env(safe-area-inset-bottom)+1rem)]
AppShell <main>  pb-[calc(var(--mobile-nav-h,7rem)+env(safe-area-inset-bottom)+1.75rem)]
MobileBottomNav  pb-[env(safe-area-inset-bottom)]     <- the bar itself
```

Three properties fall out of this rather than being maintained by hand:

1. **No drift.** The offset *is* the bar's height, not a number that has to be updated when
   the bar changes. A third grid row, a taller label, a scaled root font or a wrapped cell
   all propagate with no code change.
2. **The inset is never stale.** The published height is the **grid's**, deliberately
   excluding the bar's inset padding, and every consumer adds `env(safe-area-inset-bottom)`
   itself. The style engine resolves that term live, so a device that gains or loses its
   home indicator is correct on the very next frame with no re-measurement — and the inset
   is never double-counted.
3. **It fails high, never low.** The `7rem` (112px) fallback is larger than the 100px grid,
   so even before the first measurement — or if measurement never happens — the stack sits
   *above* the bar instead of on it.

Desktop is untouched by construction: `sm:bottom-4` and `sm:pb-6` win at ≥640px, where the
bar is `display: none` and the published height measures `0px`.

### The RO trap, and why the measurement is not the only signal

The first version of this fix published the **bar's** height (grid + border + inset) and let
`var()` carry the inset. Browser verification killed it: after injecting an inset-sized
padding onto the bar, `--mobile-nav-h` stayed at `101px` and the toast went back to
overlapping by 18px. A control `ResizeObserver` in the same page proved why — it received its
*initial* delivery but **no change notification for 500ms**, and the injected change produced
no `resize` event either. RO notifications ride on the rendering steps, so a stale published
value is reachable in practice (backgrounded tab, throttled rendering), not theoretical.

Hence the restructure: measure only what can go stale slowly (the grid), resolve the inset in
CSS, and listen to `resize`/`visibilitychange` in addition to RO. Under the same injected
condition the fixed build now shows `bottom: 150px` (= 100 + 34 + 16) with 15px clearance.

## Files

- `src/lib/layout.ts` (new, 20 lines) — the custom property name plus publish/clear.
- `src/features/shell/MobileBottomNav.tsx` — publishes the grid height; bar gains
  `pb-[env(safe-area-inset-bottom)]` and `data-testid="mobile-nav-bar"`. Grid markup,
  classes, active state and `aria-label="Primary"` untouched.
- `src/components/ui/ToastHost.tsx` — `bottom-20` → the derived offset; adds
  `data-testid="toast-stack"`. Toast markup, buttons and `pointer-events-*` untouched.
- `src/features/shell/AppShell.tsx` — rail `<nav>` label `Primary` → `Primary sections`;
  `main`'s mobile `pb-32` → the derived padding (`sm:pb-6` unchanged).
- `src/features/shell/MobileBottomNav.test.tsx` — +5 tests (13 → 17 in this file).
- `src/features/shell/AppShell.test.tsx` (new) — 2 tests for the landmarks and the padding.
- Evidence: `.improve/artifacts/IMP-024/imp0243-01-390-light-toast-clears-nav-notched.png`,
  `…-02-390-light-toast-clears-nav-flat.png`.
- `.improve/FEATURES.md` **not** modified — the orchestrator owns item status. **No commit.**

## Tests: 7 new cases, 8/8 mutations caught

New coverage sits in `MobileBottomNav.test.tsx` (a `bar clearance` suite) and the new
`AppShell.test.tsx`. Because jsdom resolves no Tailwind, the geometry tests do two things: they
derive the bar's real height **independently from the rendered classes** (`grid-cols-5`,
`gap-1`, `py-1`, `min-h-11`, `border-t` → 100px grid, 101px bar), and they parse the toast
stack's `bottom-[calc(...)]` utility and resolve it the way a browser would — including the
`var()` fallback, which must on its own already clear the bar. A hardcoded `bottom-20`
therefore cannot even parse as the expected form, and a too-small fallback fails numerically.

| mutation | failing tests |
| --- | --- |
| `bottom-20` restored on the toast stack (the original defect) | **2** — "holds the toast stack above the bar…", "resolves the home-indicator inset in CSS…" |
| `env(safe-area-inset-bottom)` dropped from the bar | **3** — the inset test + both toast-clearance tests |
| `env(safe-area-inset-bottom)` dropped from the toast offset | **2** |
| toast fallback shrunk `7rem` → `3rem` (below the bar) | **1** |
| publish a guessed constant instead of measuring | **2** |
| `resize` listener removed (measurement stops tracking) | **1** |
| `main` back to `pb-32` | **1** |
| rail `aria-label` back to `Primary` (landmark collision) | **1** |

Every mutation was applied to the source, the shell suites re-run, and the file restored
(`diff` clean afterwards). Full suite after restoring: 31 files / 302 tests, all green
(baseline 295 → 302 = +7 new tests; 5 nav + 2 shell).

New tests by name:

- `pads itself by the home-indicator inset so no row sits under it`
- `publishes its measured grid height so overlays cannot be sized against a stale guess`
- `keeps the published height in step with the grid through a ResizeObserver`
- `holds the toast stack above the bar, so Undo can never land on a nav cell`
- `resolves the home-indicator inset in CSS, so no re-measurement can leave the stack behind`
- `gives the rail and the mobile bar distinguishable navigation landmarks`
- `reserves page-bottom padding from the mobile bar height, desktop unchanged`

## Verification

### Gates, in order, all exit 0

```
npm run typecheck  -> tsc --noEmit, no diagnostics
npm run lint       -> eslint ., no output
npm run test       -> Test Files 31 passed (31)
                     Tests     302 passed (302)   [baseline 295 + 7 new]
npm run build      -> PWA injectManifest, precache 18 entries (612.30 KiB), dist/sw.js
```

`npx prettier --check` clean on all six touched files. The emitted CSS was inspected in
`dist/assets/` to confirm Tailwind really produced the rules (an arbitrary value silently
dropped would have left the toast at `bottom: auto`):

```
.bottom-\[calc\(var\(--mobile-nav-h\,7rem\)\+env\(safe-area-inset-bottom\)\+1rem\)\]
        {bottom:calc(var(--mobile-nav-h,7rem) + env(safe-area-inset-bottom) + 1rem)}
.pb-\[calc\(var\(--mobile-nav-h\,7rem\)\+env\(safe-area-inset-bottom\)\+1\.75rem\)\]
        {padding-bottom:calc(var(--mobile-nav-h,7rem) + env(safe-area-inset-bottom) + 1.75rem)}
.pb-\[env\(safe-area-inset-bottom\)\] {padding-bottom:env(safe-area-inset-bottom)}
```

### 390×844, Chromium against `npm run preview`, light theme

Flat device (`safe-area-inset-bottom` = 0):

```
--mobile-nav-h  100px          (grid only — the inset is not baked in)
bar             top 743, height 101, padding-bottom 0px
toast stack     bottom: 116px  (= 100 + 0 + 16), bottom edge 727
overlap band    0px            clearance 15px
Undo button     bottom 721     (< bar top 743; 0 nav cells overlapped, 5 samples)
main            padding-bottom 128px  -> 27px content clearance
hit tests       6 points x 10 cells x 5 samples = 300 probes, 0 violations
```

Notched device, emulated at the CSSOM level by substituting `34px` for every
`env(safe-area-inset-bottom)` in the document's stylesheets — the same substitution the engine
would do on an iPhone, and the only way to exercise a real inset in desktop Chromium
(an injected `padding-bottom` on the bar leaves `env()` at 0, which is what made the first
version look broken):

```
bar             top 709, height 135, padding-bottom 34px
toast stack     bottom: 150px  (= 100 + 34 + 16), bottom edge 694
overlap band    0px            clearance 15px
Undo button     bottom 687     (0 nav cells overlapped, 8 samples)
main            padding-bottom 162px  -> 27px content clearance
--mobile-nav-h  still 100px    (inset never double-counted)
row 2 cells     bottom 806 <= 810 (home-indicator top) -> clear
hit tests       6 x 10 x 8 = 480 probes, 0 violations
```

Screenshots: `imp0243-02-…-flat.png` (4 toasts incl. `Deleted · Undo`, stack entirely above
the bar) and `imp0243-01-…-notched.png` (same stack with the bar grown by the inset).

**The destructive mis-tap, tested as a tap.** With a live `Deleted · Undo` toast on screen,
full `pointerdown/mousedown/pointerup/mouseup/click` sequences were dispatched at the two
coordinates the verifier measured the Undo button on (x272–335, y727–751, i.e. the top band of
the Lists and Goals cells):

```
tap (272, 722)  elementFromPoint -> the Lists cell's own icon   #/today -> #/lists   navigated
tap (349, 722)  elementFromPoint -> the Goals cell's own icon   #/lists -> #/goals   navigated
after both      the deleted item is still deleted (Undo never fired)
                the Undo toast is still on screen and still clickable
```

So a tap aimed at Lists/Goals navigates, and no data is restored by accident. The Undo path
itself is untouched code and still functions.

### Desktop 1280×800 — unchanged

```
--mobile-nav-h  0px        (bar is display:none, so it measures 0)
bar             display: none
toast stack     bottom: 16px   (sm:bottom-4)
main            padding-bottom 24px  (sm:pb-6)
landmarks       navigation "Primary sections" (rail, visible, 10 links)
                navigation "Primary"        (mobile bar, hidden)
rail active     bg-accent-soft text-accent  (unchanged)
```

Both nav elements exist in the DOM at every width — only one is rendered — so the labels must
differ; they now do.

**Console:** `browser_console_messages` returned an empty list after the whole sweep (two
themes' worth of routes, ten destinations, four create/delete cycles, the notched emulation,
1280 and 390 widths). Zero errors, zero warnings. The only console noise seen during this
attempt came from my own probe script mis-reading `DOMRect` fields, not from the app.

**Scope:** `git diff` touches `ToastHost.tsx` (the offset utility + a testid + a comment) and
`AppShell.tsx` (the rail label + the `main` padding + a comment). `MobileBottomNav.tsx` and
`src/lib/layout.ts` are new-file content from this and the previous attempt. No colours, no
tokens, no layout geometry of the grid, no `NAV_ITEMS` edit, no unrelated source changes, and
no `console.*`/`debugger`/`TODO` in the diff. One artefact worth flagging for the reviewer:
`--mobile-nav-h` is set as an inline style on `documentElement` — a single global write, made
by the nav itself and cleared on unmount.

## Remaining trade-offs

- The bar's `ResizeObserver` is the only reason `--mobile-nav-h` tracks a grid-height change
  that fires no viewport event (a web-font swap, say). It is no longer load-bearing for
  correctness: `resize`, `visibilitychange` and the high fallback cover the failure modes, and
  the `env()` term never depends on JavaScript at all.
- `main`'s mobile bottom padding is now 128px (was `pb-32` = 128px) with no inset and 162px
  with a 34px inset, i.e. a constant 27px content reserve on both.
- The two-row bar is still 101px on a flat device; nothing in this attempt changed that.