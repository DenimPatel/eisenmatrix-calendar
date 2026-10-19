# verify-IMP-145 — Keep the small ProgressRing label inside the ring

**Verifier:** independent (did not author the change)
**Date:** 2026-10-19
**Verdict:** **PASS** (two non-blocking notes — see F1, F2)

## Scope inspected

- Spec: `.improve/FEATURES.md` IMP-145 (`:2313-2327`), `.improve/reports/impl-IMP-145.md`,
  `.improve/reports/discover4-visual.md` V2 (`:61-85`), `.improve/REPO_PROFILE.md`, `AGENTS.md`.
- Uncommitted diff (`git status`): `src/components/ui/ProgressRing.tsx`,
  `src/components/ui/ProgressRing.test.tsx`, `.improve/FEATURES.md`; new untracked
  `.improve/reports/{impl,discovered}-IMP-145.md`.
- `git log` head is `1553d8b [IMP-144]`; IMP-145 is uncommitted.

## 1. Acceptance criteria

**AC1 — For any 0–100% value at `size={28}` the label width ≤ inner diameter, or the label is
abbreviated/omitted.** MET. `ProgressRing.tsx:43` sets `compact = size < COMPACT_MAX_SIZE (40)`;
the compact branch (`:84-87`) renders the integer alone (`text-[10px] leading-none`, `data-compact`),
dropping `%`. Inner diameter at `size=28`/`strokeWidth=3` is `28 - 2*3 = 22px`. Measured label box
widths (independent browser probe, `getBoundingClientRect` + `Range` ink rect):

| value | label | box width (px) | ink width (px) | inner dia (px) | clearance/side | overlaps stroke |
|---|---|---|---|---|---|---|
| 0   | `0`   | 6.79  | 6.79  | 22 | 7.61 | no |
| 5   | `5`   | 6.60  | 6.60  | 22 | 7.70 | no |
| 40  | `40`  | 13.63 | 13.63 | 22 | 4.19 | no |
| 100 | `100` | 18.64 | 18.64 | 22 | 1.68 | no |

`100` is the widest possible compact label (all compact labels are digit-only), so the bound holds
for every value 0–100.

**AC2 — No glyph overlaps the ring stroke at 1280px or 390px, light or dark.** MET. The label box
(and its ink rect, which is identical to the box) sits strictly inside the inner circle at all eight
combinations. The ring geometry is viewport- and theme-independent: `40` → 13.63px, `100` → 18.64px
at every point, with `boxOverlapsStroke: false`. Screenshots: `.improve/artifacts/IMP-145/verify-*.png`.

**AC3 — Rings ≥40px keep the current appearance.** MET.
- GoalsView `size={56}`/`strokeWidth={5}`: label `0%`, class `text-xs font-semibold text-fg`,
  `data-compact` absent, width 19.99px, inner 46px.
- TodayView goal ring `size={40}`/`strokeWidth={4}` (decorative): label `0%`, `text-xs`, no
  `data-compact`.
- TodayView habit ring `size={40}` uses a custom `label` prop (`✓`/`0`) and is untouched.

**Accessible name/value.** MET. `aria-valuenow` and `aria-label` still report the full percentage at
every value: e.g. `aria-valuenow="40"` / `aria-label="Today's agenda progress: 40% complete"`,
`"100"` / `"…100% complete"`, `"5"` / `"…5% complete"`, `"0"` / `"…0% complete"`. Only the visible
span is abbreviated.

## 2. Scope creep, layout shift, threshold robustness

- **Scope creep:** none. The fix is centralized in `ProgressRing.tsx` (+12/−1); `TodayView.tsx`,
  named in the spec's Area/files, is correctly left untouched. No new dependency, no other component
  touched. Only `ProgressRing.test.tsx` (+35) added a `describe` block.
- **Layout shift:** none. The label lives in the pre-existing `absolute inset-0` container; the ring
  root measured exactly 28px in the 0/5/40/100 states, so a value change cannot move surrounding
  content. The agenda header (`0/5 done` + ring) did not reflow.
- **Threshold robustness:** `compact = size < 40` is a pure size gate, so 0/5/100 and any arbitrary
  integer value take the same path (see table). The only in-repo sizes are 28 (compact), 40 (full),
  56 (full); no caller sits at 36–39. No value can produce a label wider than `100`.

## 3. Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run test` **77 files / 793 tests pass** ·
`npm run format:check` clean · `npm run build` clean (`dist/sw.js` generated).

## 4. Mutation check

Setting `const compact = false;` (disabling the new behavior) fails exactly the two new
size-28 assertions (`ProgressRing.test.tsx` → 2 failed / 6 passed). Restored from backup; `git diff
--stat` is byte-identical to the pre-mutation diff (3 files, +47/−2).

## 5. Browser method

Isolated `npm run preview -- --port 4193 --strictPort`; SW unregistered, all caches and IndexedDB
deleted, then a real document load (`about:blank` → app) per AGENTS.md. Data seeded directly into the
`items` store to force 0/5/40/100% agenda progress and to render the 40/56px rings. Zero console
errors (the single warning was emitted by the verifier's own `deleteDatabase` call, not the app).
The served bundle (`assets/index-BXJ7jYii.js`) was confirmed to contain the change.

## 6. State / backlog files

Only the one-line `FEATURES.md` status flip (TODO → IN-PROGRESS) plus the two expected new report
files. No other state/backlog file changed.

## 7. Notes (non-blocking)

- **F1** — `FEATURES.md` status was flipped to `IN-PROGRESS` (not `DONE` as in IMP-144's notes).
  Consistent with the verifier/commit step still pending; informational only.
- **F2** — Latent, documented in `discovered-IMP-145.md` and confirmed: an explicit `label` prop
  bypasses compactness, and a future `size<40` caller with a larger `strokeWidth` would shrink the
  inner diameter below the `100` width. No in-repo caller does either today.
- Environment observation (not a finding): the app's IndexedDB reports `version 40` although the
  bundle defines Dexie versions 1–4. This predates and is unrelated to IMP-145 (no schema change in
  the diff) and reproduced on a clean origin with the unmodified build.

## Health delta

- Tests: 790 → **793** (+3), 77 files. No regressions.
- typecheck / lint / format:check / build: all green.
- Visible defect from V2 (the `%` crossing the 28px stroke) is resolved; larger rings and the
  accessibility contract are unchanged.
