# verify-IMP-027 — accessible names for Sheet and Dialog

**Verdict: PASS**

- Branch: `improve/auto-20261017` (working tree; change is uncommitted)
- Reviewed against `.improve/FEATURES.md` IMP-027, `.improve/reports/impl-IMP-027.md`,
  `.improve/REPO_PROFILE.md`, `AGENTS.md`
- Reviewer did not write this change; no files were modified or committed as part of review.
  Only this report and the screenshots under `.improve/artifacts/IMP-027/` were added.

## Change under review

| File | Change |
| --- | --- |
| `src/components/ui/Dialog.tsx` | `useId()` ids; dialog uses `aria-labelledby` for the `<h2>` title, `aria-describedby` for the description; new optional `ariaLabel` fallback when no title |
| `src/components/ui/Sheet.tsx` | `useId()` ids; dialog uses `aria-labelledby` for the `<h2>` title, `aria-describedby` for the subtitle; new optional `ariaLabel` fallback when no title |
| `src/components/ui/Dialog.test.tsx` | 3 new tests (title name + description, default fallback, custom fallback / no `aria-describedby`) |
| `src/components/ui/Sheet.test.tsx` (new) | 4 new tests (title + subtitle, default fallback, custom fallback, no `aria-describedby`) |

Key lines: `Dialog.tsx:45-46,74-76,94-99`; `Sheet.tsx:33-34,62-64,73-79`.

## Acceptance criteria

### 1. Real title node referenced by `aria-labelledby`, or non-empty `aria-label` — MET

- `Dialog` (`Dialog.tsx:74-75`): with a title, `aria-labelledby` points at the rendered
  `<h2 id={titleId}>` (`:87-95`) and `aria-label` is omitted. Without a title, it falls back to
  `ariaLabel || 'Dialog'` — always non-empty.
- `Sheet` (`Sheet.tsx:62-63`): with a title, `aria-labelledby` points at the rendered
  `<h2 id={titleId}>`; empty title falls back to `ariaLabel || 'Panel'` — always non-empty.
- Real-browser confirmation (see Evidence): the accessibility tree exposes
  `dialog "Quick add"`, `dialog "Untitled"`, and `dialog "Keyboard shortcuts"`, and
  `getByRole('dialog', { name, exact: true })` matched exactly 1 in each case.
- The fallback branch is exercised by 4 jsdom tests (default and custom labels); no current
  UI call site omits a title, so the fallback is only test-covered, which is expected.

### 2. `description` referenced by `aria-describedby` when provided — MET

- `Dialog.tsx:76,97`: `aria-describedby={description ? descriptionId : undefined}` on the
  existing description `<p>`.
- `Sheet.tsx:64,77`: `aria-describedby={subtitle ? subtitleId : undefined}` on the existing
  subtitle `<div>` (Sheet has `subtitle`, not `description`; the report maps it correctly).
- Real-browser confirmation: Quick Add exposes description
  "Type naturally. Chips show what will be created — edit before committing." and the new-task
  Sheet exposes "Task"; `getByRole('dialog', { description })` matched exactly 1 for each.
  The Shortcut Sheet (title, no description) has no `aria-describedby`, as intended.
- jsdom tests assert both presence (with description/subtitle) and absence (without).

### 3. No visual change — MET

- Diff adds only `id`, `aria-*` attributes, and an optional prop; no classes, element structure,
  spacing, or text changed. The Sheet `<h2>`/subtitle and Dialog `<p>` keep the same classes.
- Stronger check: captured the live Dialog and Sheet, then stripped exactly the added
  `aria-*`/`id` attributes in the DOM (reproducing the old markup) and captured again.
  Pixel diff was **0 pixels** on both 2940×1386 PNGs.

### 4. Existing call sites / API intact — MET

- `title`/`description`/`subtitle` props are unchanged; `ariaLabel` is additive and optional.
- All existing call sites were checked and none were edited:
  `SettingsView.tsx:332`, `ShortcutSheet.tsx:21`, `QuickAdd.tsx:84`,
  `CommandPalette.tsx:85`, `ItemEditorSheet.tsx:248`, and `ConfirmDialog` in `Dialog.tsx`.
- `ConfirmDialog` inherits the title-based naming unchanged.

## Gates

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS (no diagnostics) |
| `npm run lint` | PASS (no output) |
| `npm run test` | PASS — 34 files / **385 tests** (baseline 33/378; expected 385) |
| `npm run build` | PASS — `tsc --noEmit` + Vite build; PWA `dist/sw.js`, 18 precache entries (617.46 KiB) |
| `npx prettier --check` (4 touched files) | PASS |
| `git diff --check` | PASS (no whitespace errors) |

Browser console during the verification session: **0 messages** (0 errors, 0 warnings).

## Browser verification method

1. `npm run build`, then `npm run preview` on port 4173
   (`http://localhost:4173/eisenmatrix-calendar/`).
2. A stale service worker from a previous session was active, so it was unregistered and all
   `workbox-precache-*` caches deleted; the app was then reopened with a cache-busting query
   (`?verify=1`). Confirmed the page loaded the fresh bundle `index-BqZEDCkz.js` containing
   `aria-labelledby` before trusting results. (An earlier read on the stale bundle showed the
   old `aria-label` markup; it was discarded and the check repeated.)
3. Opened via the real UI:
   - Dialog → Today → **Quick add** (title + description).
   - Sheet → Today → **New task** (title "Untitled" + subtitle "Task").
   - Dialog → **?** keyboard shortcut sheet (title, no description).
4. For each `[role="dialog"]`: inspected `aria-label`/`aria-labelledby`/`aria-describedby`,
   resolved the referenced nodes with `document.getElementById`, captured
   `locator.ariaSnapshot()`, and matched with `getByRole('dialog', { name/description })`.

## Evidence

- `.improve/artifacts/IMP-027/dialog-quickadd.png` — open Dialog, accessibility name "Quick add"
- `.improve/artifacts/IMP-027/sheet-item-editor.png` — open Sheet, name "Untitled", description "Task"
- `.improve/artifacts/IMP-027/dialog-shortcuts.png` — title-only Dialog, no description
- `.improve/artifacts/IMP-027/visual-dialog-new.png` / `visual-dialog-oldattrs.png` — 0-pixel diff
- `.improve/artifacts/IMP-027/visual-sheet-new.png` / `visual-sheet-oldattrs.png` — 0-pixel diff

## Scope / hygiene

- Code change is confined to the two primitives plus tests. The uncommitted
  `.improve/CHANGELOG.md` and `.improve/PROGRESS.log` entries reference **IMP-025**, not this
  item (leftover metadata from the preceding commit); they are not part of the IMP-027 code
  change. `.improve/FEATURES.md` only flips IMP-027 to IN-PROGRESS, matching the workflow.
- No `console.*`, `debugger`, TODO/FIXME, or dead code in the touched files.
- Two JSDoc lines were added on the new prop; they explain the fallback intent and are
  consistent with the "comments only for non-obvious intent" convention.
- No new dependencies, no persistence/date/logic changes, no styling changes.

## Non-blocking observations (not acceptance failures)

1. Fallback names are generic ("Dialog"/"Panel"); acceptable because all current call sites
   pass a title, and callers can pass `ariaLabel` for a better fallback.
2. A whitespace-only title (`title="   "`) is truthy, so `aria-labelledby` would point at a
   node whose computed name is empty rather than using the fallback. No current call site does
   this and the prop types/usage treat titles as meaningful strings; worth a guard only if the
   API later accepts arbitrary text.
3. The new tests resolve `aria-labelledby`/`aria-describedby` manually rather than via
   `computeAccessibleName`; they verify the wiring, and the real-browser `ariaSnapshot` +
   `getByRole` checks verify the computed name/description, so coverage is adequate. Adding
   `dom-accessibility-api` later would strengthen unit tests (already noted in
   `discovered-IMP-027.md`).
4. Pre-existing latent issue (not introduced here): `Dialog` with neither title nor
   description renders no visible close button; documented in `discovered-IMP-027.md`.

## Suggested health delta

| Dimension | Current | Suggested | Rationale |
| --- | --- | --- | --- |
| Accessibility | 3 | **3 (hold; +1 to 4 once IMP-033 lands)** | Removes the dominant dialog-naming gap in both primitives and adds description wiring, verified in a real accessibility tree. The remaining ARIA toggle/sort-header gap (IMP-033) keeps the dimension at 3, consistent with `verify-IMP-059`'s "once IMP-027/IMP-033 land" gate. |
| Other dimensions | — | 0 | No behavior, data, delivery, or performance change. |
