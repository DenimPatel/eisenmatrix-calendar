# IMP-142 — Disable Subtasks while the editor scope is "This occurrence"

**Status:** DONE
**Date:** 2026-10-19
**Files changed:**
- `src/features/item/ItemEditorSheet.tsx` — wrapped the Subtasks/Milestones block in the
  existing `SeriesOnlyGroup` (`locked={occurrenceScoped}`), added the
  `· Applies to the whole series` hint to its label (mirroring Checklist), and guarded
  `addChild` with `if (occurrenceScoped || …) return;`.
- `src/features/item/ItemEditorSheet.test.tsx` — new case
  `disables the subtasks input and child checkboxes for one occurrence only`.

## Change
The Subtasks/Milestones block was the one series-only surface not wrapped in
`SeriesOnlyGroup`, so under "This occurrence" the banner's promise ("Fields marked
“Applies to the whole series” are disabled for this scope") was broken: the Add-subtask
input and child checkboxes stayed enabled and wrote a series-wide child
(`parentId` = series id). The block now reuses the same `occurrenceScoped` flag and
`SeriesOnlyGroup` wrapper as Checklist, so the whole block (child checkboxes + add input)
is inside a disabled `fieldset` with `opacity-60`, and its label carries the same
`SERIES_ONLY_HINT` suffix. `addChild` additionally short-circuits when
`occurrenceScoped`, closing the programmatic/Enter path independent of the disabled
fieldset. No new bespoke condition was introduced; layout is unchanged apart from the
existing disabled styling. Behaviour under "This and future" and "All occurrences" is
unchanged (block not locked).

## Verification
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS, 75 files / 761 tests (was 760; +1 new case)
- `npm run format:check` — PASS
- `npm run build` — PASS (`dist/sw.js` generated, precache 28 entries)

### Browser (isolated preview 4188, SW/caches reset, 0 console errors/warnings)
Seeded a recurring daily task + one child; opened the 2026-10-18 occurrence on `#/calendar`.
- **This occurrence** (1280x800 and 390x844): Add-subtask input `disabled` (inside
  `fieldset[disabled]`), child checkbox `disabled`, hint `Subtasks · Applies to the whole
  series` present, banner present. Dispatching Enter with text in the (disabled) add input
  created **no** child (IDB child count stayed 1).
- **This and future**: input and checkbox enabled, hint absent.
- **All occurrences**: input and checkbox enabled, hint absent.

Artifacts: `.improve/artifacts/IMP-142/occurrence-scope-1280x800.png`,
`occurrence-scope-390x844.png`, `future-scope-enabled-1280x800.png`.
