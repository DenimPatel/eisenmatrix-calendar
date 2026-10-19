# IMP-145 — Keep the small ProgressRing label inside the ring

**Status:** done (uncommitted)
**Files changed:** `src/components/ui/ProgressRing.tsx`, `src/components/ui/ProgressRing.test.tsx`

## Change

`ProgressRing` now renders a **compact** visible label when `size < COMPACT_MAX_SIZE` (40):
the number alone, `text-[10px] leading-none`, tagged `data-compact="true"`. Rings `>=40px`
keep the exact previous label (`text-xs font-semibold`, `NN%`). The accessible semantics are
untouched: `role="progressbar"`, `aria-valuemin/max/now` and the `aria-label` still report the
full percentage; only the visible span is abbreviated.

At `size={28}` `strokeWidth={3}` the inner diameter is 22px. `40%` at 12px semibold was ~30px
(crossing the 3px stroke). The compact `40`/`100` at 10px measures 13.6px / 18.6px, both inside
22px with no glyph touching the stroke.

## Verification

Gates (all PASS):
- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 77 files / 793 tests
- `npm run format:check` — clean
- `npm run build` — clean (`dist/sw.js` generated)

Tests added (jsdom, `ProgressRing.test.tsx`): size 28 → visible text `40` / `100`, `data-compact`
present, class `text-[10px]`, `%` absent; `aria-valuenow` and `aria-label` still the full
percentage; size 40 → `data-compact` absent, visible `40%`, class `text-xs`. Mutation check:
forcing `compact = false` fails 2 of the new tests.

Browser (isolated preview `npm run preview -- --port 4192 --strictPort`, SW/caches reset,
0 console errors/warnings):

| viewport | theme | value | label | width | inner dia | overlap |
|---|---|---|---|---|---|---|
| 1280x800 | light | 40 | `40`  | 13.63 | 22 | no |
| 1280x800 | light | 100 | `100` | 18.64 | 22 | no |
| 1280x800 | dark | 40 | `40`  | 13.63 | 22 | no |
| 1280x800 | dark | 100 | `100` | 18.64 | 22 | no |
| 390x844 | light | 40 | `40`  | 13.63 | 22 | no |
| 390x844 | light | 100 | `100` | 18.64 | 22 | no |
| 390x844 | dark | 40 | `40`  | 13.63 | 22 | no |
| 390x844 | dark | 100 | `100` | 18.64 | 22 | no |

`aria-valuenow` = 40/100 and `aria-label` = "Today's agenda progress: 40%/100% complete" at
every point. Larger-ring check: GoalsView `size={56}` still renders `0%` with `text-xs`,
`data-compact` absent. Screenshots in `.improve/artifacts/IMP-145/`.
