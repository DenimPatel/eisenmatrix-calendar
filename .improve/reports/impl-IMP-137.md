# impl-IMP-137 — Stop the item editor's Start-time control clipping its AM/PM indicator

Status: done

## Summary

The item editor's Schedule tab rendered the native time input at `input w-28`, which clipped
the AM/PM indicator (`03:00 P`) and let the clock glyph overlap the truncated `M`. The
Settings digest input had already been widened to `w-36`; this applies the same width to the
editor's Start-time control and adds regression coverage.

## Files changed

- `src/features/item/ItemEditorSheet.tsx:629` — `className="input w-28"` → `className="input w-36"`
  (one-line fix; same token/pattern as `SettingsView.tsx:288`).
- `src/features/item/ItemEditorSheet.test.tsx` — new `describe('ItemEditorSheet time inputs')`
  with two tests: the Start-time input is not `w-28` and matches `w-3[2-9]`, and every rendered
  time input (Start plus the all-day reminder time) is not narrower than `w-32`.
- `src/features/quickadd/QuickAdd.test.tsx` — new test asserting the Time override input is not
  narrower than `w-32`.
- `.improve/artifacts/IMP-137/*.png` — screenshots (1280x800 and 390x844, light and dark).

The regression guard parses explicit `w-<n>` classes and fails when any numeric width is below
`w-32`; controls that rely on `.input` (`w-full`) stay valid.

## Audit of every `type="time"` input (requirement 2)

`grep -rn 'type="time"' src/`:

| File | Class | Assessment |
|---|---|---|
| `src/features/settings/SettingsView.tsx:290` | `input w-36` | OK (already fixed, own test) |
| `src/features/item/ItemEditorSheet.tsx:628` | `input w-28` → `input w-36` | **fixed** |
| `src/features/item/ReminderEditor.tsx:58` | `input` (= `w-full` via `.input`) | OK, full width |
| `src/features/quickadd/QuickAdd.tsx:185` | `input` (= `w-full` via `.input`) | OK, full width |

`.input` is `w-full` (`src/styles/index.css:85`), so the two `w-full` controls are never
narrower than their column. Only the editor's Start-time control carried an explicit
too-narrow width.

## Commands and results

- `npm run typecheck` — PASS (no diagnostics)
- `npm run lint` — PASS (no output)
- `npm run test` — PASS (74 files / 725 tests)
- `npm run format:check` — PASS ("All matched files use Prettier code style!")
- `npm run build` — PASS (`tsc --noEmit && vite build`; PWA precache 28 entries, `dist/sw.js`)

## Browser verification

Served the production build with `npm run preview -- --port 4183 --strictPort`, reset
SW/caches per AGENTS.md, then opened the "Team meeting" item → Schedule tab.

Rendered value is not truncated at either viewport in either theme (screenshots in
`.improve/artifacts/IMP-137/`):

- `editor-1280-light.png`, `editor-1280-dark.png`, `editor-390-light.png`, `editor-390-dark.png`
- DOM measurement at both 1280x800 and 390x844: Start-time input `className="input w-36"`,
  `clientWidth=120`, `scrollWidth=120`, `clipped=false`; rendered text `09:00 AM` plus the
  clock icon are fully visible.
- Canvas measurement of the widest value `12:00 AM` at the input font = 61.1px against a
  96px content box, leaving room for the native clock affordance.
- Console: 0 errors, 0 warnings.

## Uncertainties / notes

- `git status` shows `.improve/FEATURES.md` modified; that edit is not mine (backlog/state
  files were left untouched per instructions).
- The other two time inputs (`ReminderEditor`, `QuickAdd`) rely on `.input`/`w-full`; the
  shared guard test protects them from a future explicit narrow width, but a `w-full` control
  in a very tight flex row would not be caught by the class check. Not an issue at the tested
  widths.
