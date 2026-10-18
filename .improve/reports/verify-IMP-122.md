# VERIFY — IMP-122 & IMP-123 (independent skeptical review)

**Reviewer:** independent verifier. **Source not modified.**
**Impl report:** `.improve/reports/impl-IMP-122.md`.
**Verdict:** **PASS WITH ISSUES** — the core acceptance criteria are met and all gates pass, but
the Tabs pattern emits **dangling `aria-controls`** on inactive tabs, which fails the
"no dangling aria-controls to non-existent ids" check and is flagged by axe
(`aria-valid-attr-value`).

## Diff under review

`git diff` (uncommitted): `src/components/ui/ProgressRing.tsx`, `src/components/ui/Tabs.tsx`,
`src/features/item/ItemEditorSheet.tsx` (rewired to `TabPanel`), `src/features/item/RecurrenceEditor.tsx`,
`src/features/today/TodayView.tsx`, `src/features/goals/GoalsView.tsx`, `src/lib/labels.ts`,
`.improve/FEATURES.md`, plus new `ProgressRing.test.tsx`, `Tabs.test.tsx`, `RecurrenceEditor.test.tsx`,
`GoalsView.test.tsx` and extended `TodayView.test.tsx`.

## IMP-122 — ProgressRing progress semantics

| Criterion                                             | Result |
| ----------------------------------------------------- | ------ |
| `role="progressbar"` with `aria-valuenow/min/max`     | PASS — `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow` = clamped/rounded percent (`ProgressRing.tsx:38-47`). |
| Accessible name including value + item context        | PASS — `ariaLabel ?? "<n>%"`. Today agenda ring and GoalsView ring pass explicit contextual names. |
| No unnamed progressbars                               | PASS — DOM scan of `#/today`: exactly 1 `[role="progressbar"]`, `aria-label="Today's agenda progress: 0% complete"`. Only `ProgressRing` produces the role. |
| No nested interactive / duplicate announcement        | PASS — habit + Today goal rings are `decorative` (`aria-hidden`, no role) inside their labelled `<button>`; `document.querySelectorAll('button [role="progressbar"]')` = 0. GoalsView ring is a sibling of the title button, not nested. |
| No visual change                                      | PASS — see screenshots; ring is unchanged visually (`aria-hidden` svg, same markup). |

Minor: the Today agenda label interpolates raw `todayProgress` (may be fractional) while
`aria-valuenow` is rounded — cosmetic inconsistency only.

## IMP-123 — Tabs & weekday picker

| Criterion                                                     | Result |
| ------------------------------------------------------------- | ------ |
| Tabs arrow-key operable (Left/Right/Home/End, wrapping)       | PASS — verified in browser: Right→Analytics, End→History, Right wraps to Details, Home→Details; selection **and** focus move together (`Tabs.tsx:49-61`). |
| Only the active tab tabbable (roving tabindex)                | PASS — `tabIndex` 0 only for `activeIndex`; observed `[0,-1,-1,-1]` for the 4-tab editor. |
| Panels associated via `aria-controls`/`aria-labelledby`       | **PARTIAL / FAIL** — active tab ↔ active panel pair is correct (`aria-controls` and `aria-labelledby` resolve), but inactive tabs point at panel ids that are **not in the DOM** because `TabPanel` returns `null` when inactive (`Tabs.tsx:110-112`). Confirmed in the live editor: 3 of 4 tabs had `controlsExists: false`. |
| `type="button"` on tabs                                       | PASS. |
| Weekday buttons: `aria-pressed` + full weekday name           | PASS — 7 buttons with `aria-pressed={active}` and `aria-label={WEEKDAY_FULL[day]}` (`RecurrenceEditor.tsx:78-83`); visible short label unchanged. |
| No visual change                                              | PASS — 3-tab and 4-tab editor layouts render correctly at 390 and 1280; no overflow/clipping. |

### ARIA notes

- **Disabled tabs:** `TabItem` has no `disabled` support and no tab is ever disabled, so
  "arrow keys with disabled tabs" is N/A — there is nothing for the roving focus to skip.
- **`tabpanel` `tabIndex={0}`** is applied unconditionally (`Tabs.tsx:118`). APG only asks for a
  focusable panel when it has no focusable content; here the panels contain inputs, so this adds an
  extra (harmless) tab stop. Minor.
- **No-selected state:** if `value` is absent from `tabs` (e.g. Analytics removed while active),
  `activeIndex` falls back to 0 but no tab gets `aria-selected="true"`, and no panel renders. Not
  reachable via the current UI (recurrence is toggled from the Schedule tab), so low risk.
- **`tablist` has no accessible name** (`aria-label`/`aria-labelledby` = null). Not required by APG
  for a single tablist in a labelled dialog, but worth noting.

## Browser verification

Built `dist/` (`npm run build`), served with `npm run preview` on `:4173`, unregistered the SW and
deleted all caches, navigated via `about:blank` to force a fresh document, then exercised the
Item Editor.

- `.improve/reports/verify-IMP-122-editor-1280.png` — 3-tab editor, 1280px.
- `.improve/reports/verify-IMP-122-editor-390.png` — 3-tab editor, 390px.
- `.improve/reports/verify-IMP-122-editor-4tabs-390.png` — 4-tab editor (recurrence on) at 390px: fits.
- `.improve/reports/verify-IMP-122-settings-1280.png`, `…-settings-390.png`.

Tabs render with the accent underline on the active tab; inactive tabs are muted; layout is stable
at both widths. **Settings has no tab UI** (`#/settings` exposes 0 `[role="tab"]`/`[role="tablist"]`;
it uses `Appearance`/`Notifications`/`Data`/`About` headings), so there is no settings-tabs surface to
regress — nothing to screenshot beyond the settings page itself. The preview server was stopped after
the checks.

## Gates

| Gate                  | Result |
| --------------------- | ------ |
| `npm run typecheck`   | PASS (clean) |
| `npm run lint`        | PASS (clean) |
| `npm run test`        | PASS — 52 files, 558 tests |
| `npm run format:check`| PASS (all changed files) |

## Issues to address

1. **(Moderate) Dangling `aria-controls`.** Inactive tabs reference panel ids that are not rendered.
   Either render inactive panels hidden (`hidden` attribute) instead of `null`, or only set
   `aria-controls` on the selected tab. Fails the explicit "no dangling aria-controls" criterion and
   axe `aria-valid-attr-value`.
2. **(Minor) Unconditional `tabpanel` `tabIndex={0}`** adds an extra tab stop for panels that already
   contain focusable fields.
3. **(Minor) No-selected state** when the active value disappears from `tabs` (unreachable today).
4. **(Trivial) Agenda `aria-label` uses the unrounded percent** while `aria-valuenow` is rounded.
