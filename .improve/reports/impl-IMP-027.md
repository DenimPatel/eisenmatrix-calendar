# impl-IMP-027 — accessible names for Sheet and Dialog

## Files changed
- `src/components/ui/Sheet.tsx`
- `src/components/ui/Dialog.tsx`
- `src/components/ui/Dialog.test.tsx`
- `src/components/ui/Sheet.test.tsx` (new)

## Approach
- Both primitives now generate stable ids with `useId()`. When a title is present, the dialog
  node uses `aria-labelledby` pointing at the rendered `<h2>`; the old `aria-label={title}` on
  `Dialog` was removed so the name comes from the real title node.
- When the title is empty/absent, both fall back to a non-empty `aria-label`: `Dialog` uses
  `ariaLabel ?? 'Dialog'`, `Sheet` uses `ariaLabel ?? 'Panel'`. A new optional `ariaLabel` prop
  lets callers supply a meaningful fallback; existing props and call sites are unchanged.
- `Dialog`'s `description` paragraph and `Sheet`'s `subtitle` node get ids referenced by
  `aria-describedby` only when that content is rendered.
- Attributes/ids only; no classes, markup structure, or spacing changed. `Dialog`'s
  `ConfirmDialog` path inherits the title-labelled dialog unchanged.
- Tests cover: title as accessible name, description/subtitle wiring, empty-title fallback
  (default and custom), and absence of `aria-describedby` when no description exists.

## Call sites checked
- `src/features/settings/SettingsView.tsx:332` — `Dialog` with title, no description.
- `src/features/shell/ShortcutSheet.tsx:21` — `Dialog` with title.
- `src/features/quickadd/QuickAdd.tsx:84` — `Dialog` with title + description.
- `src/features/command/CommandPalette.tsx:85` — `Dialog` with title.
- `src/features/item/ItemEditorSheet.tsx:248` — `Sheet` with title + subtitle.
- `src/components/ui/Dialog.tsx:123` (`ConfirmDialog`) — `Dialog` with title.
- `src/components/ui/Dialog.test.tsx` — existing Dialog tests still pass.

## Commands / results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (34 files, 385 tests; baseline 33 files / 378 tests)
- `npm run build` — PASS (including service worker)
- `npx prettier --check` on the four touched files — PASS
