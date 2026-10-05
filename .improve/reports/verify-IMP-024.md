# VERIFY IMP-024 — attempt 3 (final re-verification)

**Verdict: PASS.** Both attempt-2 defects are genuinely fixed, and every original acceptance
criterion still holds after the toast/inset change. Baseline was 287 tests; this change adds 15
(`npm run test` → **302 passed / 31 files**, zero regressions).

Environment: production build served by `npx vite preview --port 4173`, Playwright/Chromium.

> **Reviewer note — a mistake I made and corrected.** While restoring mutation B I used
> `git checkout --` on `src/components/ui/ToastHost.tsx` and `src/features/shell/AppShell.tsx`.
> Because the impl's work was uncommitted, that reverted both files to HEAD (the attempt-2 state)
> and **discarded the implementation**. I reconstructed both from the diff I had captured at the
> start of this session; the reconstruction is byte-exact — `git diff` now reports the identical
> blob hashes as the pre-incident diff (`ToastHost d1b7fab..901b8fd`, `AppShell 013d462..f462a4c`),
> and typecheck/lint/test/build are green again with the runtime re-confirmed in the browser
> (section 8). No implementation change was lost. Flagging it because the tree state matters.

---

## 1. Toasts never overlap the mobile nav; Undo can never intercept a nav tap

`scripts`-free in-page probe. Created a real item through the real editor, deleted it via the real
editor's **Delete** button (producing a genuine `Deleted · Undo` toast from `itemActions`), then
immediately, while the toast was live:

* **Exhaustive hit test** over the *entire* bar rect at 2px steps — 9 945 samples:
  `foreignHitSamplesOverBar: 0`. Not one point of the bar is painted over by anything.
* **Per-cell sweep**, 5 probe points per cell (top/middle/bottom of centre, and 3px inside each
  vertical edge), then a `pointerdown → mousedown → mouseup → click` sequence on the element a tap
  would actually hit:

| # | Cell | Hit is own cell | Any hit on toast | Landed hash | `aria-current` |
|---|------|-----------------|------------------|-------------|-----------------|
| 1 | Today | ✅ | ❌ | `#/today` | `["Today"]` |
| 2 | Calendar | ✅ | ❌ | `#/calendar` | `["Calendar"]` |
| 3 | Matrix | ✅ | ❌ | `#/matrix` | `["Matrix"]` |
| 4 | Lists | ✅ | ❌ | `#/lists` | `["Lists"]` |
| 5 | Goals | ✅ | ❌ | `#/goals` | `["Goals"]` |
| 6 | Habits | ✅ | ❌ | `#/habits` | `["Habits"]` |
| 7 | Bills | ✅ | ❌ | `#/bills` | `["Bills"]` |
| 8 | Shopping | ✅ | ❌ | `#/shopping` | `["Shopping"]` |
| 9 | Notes | ✅ | ❌ | `#/notes` | `["Notes"]` |
| 10 | Settings | ✅ | ❌ | `#/settings` | `["Settings"]` |

`sweepAllCorrect: true` — every cell navigated to **its own** destination and became the single
`aria-current="page"`. `sweepAnyHitOnToast: false`.

**The item is still deleted after all ten taps** — read straight out of IndexedDB after the sweep:
`stillDeleted: true` (0 rows titled `IMP024 mis-tap canary A`). `undoStillOnScreen: true`, i.e.
Undo was still available and simply was never fired.

Geometry over the whole toast lifetime (rAF recorder running from before the delete to after the
sweep):

```
recordedSamples: 89    minStackClearance: 15px    maxOverlap: -15px (never positive)
Undo rect: x 272–335, y 697–723   |  bar top 743   → 20px clear, 0 cells overlapped
--mobile-nav-h: 100px (constant throughout)
```

`Undo`'s x-band (272–335) *does* overlap the x-band of Lists (236–309) and Goals (313–386) — so
the x-overlap that made attempt 2 dangerous is still nominally there. Only the y-axis saves it,
and the y-axis is now derived from the measured height rather than a constant (section 2), so it
cannot silently drift back.

**The Undo path itself still works.** A second canary was deleted and Undo clicked for real via a
trusted Playwright click; the item reappeared in the list. The fix did not disarm Undo.

## 2. `env(safe-area-inset-bottom)` applied to nav *and* toast offset; correct when inset = 0

Both, and the arithmetic is exactly right in all three states:

| State | bar `padding-bottom` | `--mobile-nav-h` | toast `bottom` | stack bottom edge | bar top | clearance |
|---|---|---|---|---|---|---|
| Flat (desktop/most browsers), inset 0 | `0px` | `100px` | `116px` (=100+0+16) | 728 | 743 | **15px** |
| Notched, inset emulated 34px | `34px` | `100px` | `150px` (=100+34+16) | 694 | 709 | **15px** |
| Desktop 1280 (bar hidden) | `0px` | `0px` | `16px` (`sm:bottom-4`) | 784 | — | — |

The 34px inset was applied by re-declaring the three shipped rules with a concrete length (the
only way to exercise a real inset in desktop Chromium; `barPadBottom` going `0px → 34px` proves
the `pb-[env(safe-area-inset-bottom)]` rule is live and was resolving, not absent). Critically the
**published height stays `100px` in both states** — the inset is deliberately *not* double-counted;
consumers add it themselves and CSS resolves it live.

Notched extras: `foreignHitSamplesOverBar: 0` (bar re-hit-tested with the inset applied); home
indicator top 810 vs `lowestCellBottom: 806` and `lowestLabelBottom: 801.5` — the whole second row
clears the indicator. **ISSUE-2 fixed.**

**The offset is derived from the measured grid height, not a hardcoded constant.** I changed the
real rendered grid height in-page and watched everything follow, including the clearance:

| Injected cell height | measured grid | `--mobile-nav-h` | toast `bottom` | clearance to bar top |
|---|---|---|---|---|
| baseline | 100 | `100px` | 116px | 15px |
| `min-height: 70px` | 152 | `152px` | 168px | **15px** |
| `min-height: 30px` (content-driven → 42) | 98 | `98px` | 114px | **15px** |
| override removed | 100 | `100px` | 116px | 15px |

Across a 98 → 152px grid the clearance stays exactly 15px. A constant cannot do that.

## 3. The two navs have distinguishable accessible names

```
landmarks @390: navigation "Primary sections" (desktop rail, hidden) | navigation "Primary" (mobile grid, rendered)
landmarks @1280: "Primary sections" rendered | "Primary" hidden
unlabelledNavs: 0    distinctNames: true
```

Both navs are in the DOM at every width, so identical names would produce two `navigation
"Primary"` landmarks. They are `Primary sections` and `Primary`. **ISSUE-1 fixed.**
Unit test: `AppShell.test.tsx` → "gives the rail and the mobile bar distinguishable navigation landmarks".

## 4. `src/lib/layout.ts` — correctness, no loop, no throw, safe degradation

```ts
export const MOBILE_NAV_HEIGHT_VAR = '--mobile-nav-h';
export function publishMobileNavHeight(heightPx: number): void {
  document.documentElement.style.setProperty(MOBILE_NAV_HEIGHT_VAR, `${Math.round(heightPx)}px`);
}
```

**Cannot loop.** I attached a counting `ResizeObserver` to the real grid and idled through
1 093 animation frames plus a 1280 → 390 → 1280 round trip: **3 RO deliveries total**
(initial + one per resize). Publishing the custom property changes `bottom` / `padding-bottom` of
other elements, never the grid's own height, so the observation cannot feed itself. The effect has
`[]` deps and `publish` is idempotent (`Math.round` → stable string, so no write churn).
`ResizeObserver` absence is handled (`typeof ResizeObserver === 'undefined'`).

**Cannot throw.** No throwing call sites; the only work is `Math.round` and
`style.setProperty`. On unmount `clearMobileNavHeight()` runs; verified `published() === ''` after
unmount in both unit tests.

**Bad-measurement degradation** (measured in-browser, not reasoned):

* **Pre-first-measurement (the real, common case).** Between first paint and the effect, the var is
  unset and `var()` falls back to `7rem` → `bottom: 128px`, stack edge 716, bar top 743 →
  **27px clearance. Fails high, which is the safe direction.** Observed live: 192 recorded frames
  at `--mobile-nav-h: ""`.
* **`0`.** Forcing `0px` gives `bottom: 16px` — the stack would sit *on* the bar. **Unreachable in a
  harmful state**: the grid only measures `0` when the bar is `display: none`, which is exactly the
  `sm:` (≥640px) breakpoint, where `sm:bottom-4` (16px, later in the stylesheet) governs anyway.
  Recorded across the resize transition: `distinctVarAt390: ["", "100px"]` — **never `0px` with the
  bar visible**. The `resize` listener publishes in the same task as the layout change, before the
  next paint. At 1280, `barVisibleAt1280: [false]` throughout.
* **`NaN`.** Forcing `NaNpx` makes the whole `calc()` invalid at computed-value time:
  `bottom → 0px` and `main` `padding-bottom → 0px`, i.e. the toast on the bar and content beneath
  it. **Unreachable through the production call path**: `getBoundingClientRect().height` is a
  `double` per DOM spec and can never be `NaN`. It *is* reachable if a future caller passes a
  hand-typed value, and the function validates nothing.
  → **Non-blocking nit:** `publishMobileNavHeight` should guard its input, e.g.
  `if (!Number.isFinite(heightPx) || heightPx < 0) return;` (or `Math.max(0, heightPx)`). Not a
  defect in this item; a one-line hardening.

## 5. No page content hidden behind the taller nav

`main` bottom padding = `var(--mobile-nav-h) + env(safe-area-inset-bottom) + 1.75rem` = **128px**
(162px notched). Measured with a **15-item long list** scrolled fully to the bottom
(`scrollY === maxScroll`):

| Viewport | Theme | bar top | last content bottom | clearance |
|---|---|---|---|---|
| 390×844 | light | 743 | 716 | **27px** |
| 390×844 | dark | 743 | 716 | **27px** |
| 320×568 | light | 467 | 440 | **27px** |
| 320×568 | dark | 467 | 440 | **27px** |
| 390×844 | notched (34px) | 709 | — | 27px (padding 162px) |

`lowestElementBottom` across every element inside `main` is 716 ≤ bar top 743 — **no content is
hidden behind the taller nav** in any of the four combinations.

## 6. Gates

```
npm run typecheck   tsc --noEmit            → clean
npm run lint        eslint .                → clean, no output
npm run test        31 files / 302 tests    → 302 passed (baseline 287, +15, 0 regressions)
npm run build       tsc --noEmit && vite build → ok, 18 precache entries (612.30 KiB), dist/sw.js written
```

## 7. Mutation check — the tests actually bite

| # | Mutation | Result |
|---|---|---|
| A | Restore `bottom-20` on the toast stack | **2 failed / 300 passed** — `AssertionError: toast offset "bottom-20" must be calc(var(--mobile-nav-h,…) + env(safe-area-inset-bottom) + gap), not a fixed height` |
| B | Drop `env(safe-area-inset-bottom)` from the bar padding, the toast offset and `main`'s padding | **4 failed / 298 passed** — `pads itself by the home-indicator inset…`, `holds the toast stack above the bar…`, `resolves the home-indicator inset in CSS…`, `reserves page-bottom padding…` |
| C | Replace the measured `var(--mobile-nav-h,7rem)` with a hardcoded `6.25rem` | **3 failed / 299 passed** — `holds the toast stack above the bar…`, `resolves the home-indicator inset in CSS…`, `reserves page-bottom padding…` |

All three restored; green re-confirmed after each.

## 8. Re-confirmation of the original acceptance criteria

* **All 10 destinations visible at 390px, no lateral swipe, no clipping** — 5×2 grid, all 10 cells
  `inViewport: true`, `navScrollWidth === navClientWidth === 390`, `navScrollLeft: 0`, no
  `overflow-*` utility on the grid, no label truncated (`scrollWidth ≤ clientWidth`). Same at
  **320px**: 10 cells of 59×44, all in viewport, no truncation.
* **Active highlighted on first paint, including deep links** — cold document load of
  `…/index.html?cold=1#/shopping` with zero interaction: exactly one
  `aria-current="page"`, on **Shopping** (row 2 col 3, x158 y796, `bg: rgb(129,140,248)`,
  `color: rgb(15,23,42)`), in viewport, `navScrollLeft: 0`. Unit tests cover `/today` and the
  off-row `/settings` case.
* **Touch targets ≥ 44px** — min cell height **44px** at 390 and at 320, in both themes and with a
  toast on screen (`minCellH: 44`). Every cell is 73×44 at 390 and 59×44 at 320.
* **No horizontal page scroll** — all 10 routes at 390px: `document.scrollWidth === innerWidth
  === 390`, `body.scrollWidth === 390`, nav `scrollWidth === clientWidth`, `scrollLeft === 0`.
  `hasHorizontalPageScroll: false` at 390 and 320 with the long list.
* **Desktop rail unchanged at 1280px** — rail classes identical apart from the added label
  (`flex-1 space-y-0.5 overflow-y-auto p-2`); 10 links, 207×36, y 64…406, same order; active state
  still `bg-accent-soft text-accent`; `sm:pb-6` → `padding-bottom: 24px`; toast at
  `bottom: 16px`; no horizontal scroll.
* **Both themes** — light and dark captured at 390 with a live `Deleted · Undo` toast and at 320
  and 1280; active pill is a solid accent pill with a token-picked foreground in both, not hue-only.
* **Reduced motion** — walked every element inside the bar: **zero** elements with a non-`none`
  `animation-name` or a non-zero `transition-duration`; zero `animate-*`/`transition`/`duration-*`/
  `scroll-smooth` classes. No `prefers-reduced-motion` branch needed or present.

## 9. Visual judgement

Screenshots in `.improve/artifacts/IMP-024/` (attempt-3 files are the `v3-*` prefix; older
`imp024*`/`verify-*` files are attempt 1/2 history and are left in place, not overwritten):

| File | View |
|---|---|
| `v3-01-390-light-toast-notched-34px-inset.png` | 390×844 light, `Deleted · Undo`, 34px inset |
| `v3-02-390-light-toast-flat.png` | 390×844 light, `Deleted · Undo`, inset 0 |
| `v3-03-390-dark-toast-flat.png` | 390×844 dark, `Deleted · Undo`, inset 0 |
| `v3-04-320-light-scrolled-bottom.png` | 320×568 light, scrolled to end |
| `v3-05-1280-light-desktop-rail.png` | 1280×800 light, desktop rail |
| `v3-06-1280-dark-desktop-rail.png` | 1280×800 dark, desktop rail |
| `v3-07-390-dark-final-rebuilt-toast.png` | 390 dark, re-verified after restoring the tree |

**Looks intentionally designed, not a workaround.** Two rows of five reads as a deliberate dock;
icon-over-label cells, uniform 8px gutters, the accent pill as the single "you are here" mark.
The toast is a separate raised surface with a clear ~15px air gap above the bar — in the notched
shot the home-indicator strip is visibly *empty* below the bar, which is what the inset is for. The
16px `right-4` offset matches the card gutters. Nothing here looks like it was bolted on.

**Zero console errors.** `playwright_browser_console_messages` returned an **empty list** at the
end of the session — no errors and no warnings across cold loads, 320/390/1280, light and dark, item
creation, deletion, Undo, route sweeps and deep links.

> Tooling caveat worth recording: my first measurements were taken against a **stale
> service-worker cache** (a pre-existing build, not the current one). It is easy to misread that as
> a layout bug. All figures above are from a cache-busted load after unregistering the SW and
> deleting the caches, cross-checked against the bytes in `dist/`.

---

## Verdict

**PASS.**

Met: all original acceptance criteria, both attempt-2 defects (ISSUE-1 landmark names, ISSUE-2
nav safe-area inset), plus the new toast/nav separation and the `safe-area` + measured-offset
arithmetic.

Open, non-blocking: add a `Number.isFinite` / `Math.max(0, …)` guard to `publishMobileNavHeight`.
The `NaN` degradation path (toast at `bottom: 0`, `main` padding 0) is unreachable today —
`getBoundingClientRect().height` cannot be `NaN` — but the function does not validate its input.

Not introduced by this item and left alone: the toast stack has no max height, so ~15 simultaneous
toasts grow past the top of the viewport. Identical at HEAD; unrelated to the nav fix.