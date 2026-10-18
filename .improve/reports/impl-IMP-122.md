# IMP-122 & IMP-123 — Implementation report

**Status:** implemented (all gates pass). IMP-122 was already marked DONE in `FEATURES.md`
without an implementation on disk; this report also covers IMP-123.

## Scope

| Item       | Change                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| **IMP-122** | `ProgressRing` exposes `role="progressbar"` with `aria-valuenow/min/max` and an accessible name; a new `decorative` prop hides rings that sit inside already-labelled content. |
| **IMP-123** | `Tabs` gets a roving `tabindex`, ArrowLeft/Right/Home/End navigation, `type="button"`, and `aria-controls`/`id`; a new `TabPanel` renders `role="tabpanel"` + `aria-labelledby`. The recurrence weekday picker gets `aria-pressed` and a full weekday name. |

## IMP-122 — ProgressRing progress semantics

`src/components/ui/ProgressRing.tsx`

```tsx
export interface ProgressRingProps {
  value: number;
  // …
  /** Accessible name for the progressbar. Ignored when `decorative` is set. */
  ariaLabel?: string;
  /** Renders the ring as a purely visual decoration (inside already-labelled content). */
  decorative?: boolean;
}
```

- Non-decorative (default) renders `role="progressbar"`, `aria-valuemin={0}`,
  `aria-valuemax={100}`, `aria-valuenow={percent}` and `aria-label={ariaLabel ?? `${percent}%`}`.
  The `<svg>` is always `aria-hidden`, so the value is announced once, from the wrapper.
- `decorative` puts `aria-hidden="true"` on the wrapper and drops the role entirely.

### Usage decisions (no double announcement)

| Call site                             | Choice                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `TodayView` agenda ring (`:163`)      | **Named progressbar** — standalone indicator in the section header; `ariaLabel="Today's agenda progress: N% complete"`. |
| `TodayView` habit ring (`:224`)       | **Decorative** — inside a `<button>` already named `"Complete <habit> for today"` with `aria-pressed`; a nested progressbar is flattened by the button anyway. |
| `TodayView` goal ring (`:282`)        | **Decorative** — inside the goal `<button>` whose name is the title + progress label. |
| `GoalsView` goal ring (`:88`)         | **Named progressbar** — sibling of the title, not inside a labelled element; `ariaLabel="<goal> progress: N%"`. |

## IMP-123 — Tabs and weekday picker

`src/components/ui/Tabs.tsx` now exports `Tabs` + `TabPanel` sharing a `TabsContext`
(`baseId` from `useId()`, current `value`).

- Each tab: `type="button"`, `role="tab"`, `id="<base>-tab-<value>"`,
  `aria-controls="<base>-panel-<value>"`, `aria-selected`, and a roving `tabIndex`
  (`0` only for the active tab).
- `onKeyDown` on the tablist handles `ArrowRight`/`ArrowLeft` (wrapping), `Home`, `End`;
  it moves selection **and** focus. Unrelated keys are ignored.
- If the active value is not among the tabs (e.g. the Analytics tab disappears when the rule
  is removed), `activeIndex` falls back to `0`, so exactly one tab stays reachable.
- `TabPanel` returns `null` when its value is not active (the existing mount-on-demand
  behaviour is preserved) and otherwise renders `role="tabpanel"` with matching
  `id`/`aria-labelledby` and `tabIndex={0}`.

`src/features/item/ItemEditorSheet.tsx` was restructured so the four panels are
`<TabPanel value="…">` children of `<Tabs>`; `aria-controls`/`aria-labelledby` are wired by
the context, so no ids are hand-maintained. `src/lib/labels.ts` gains `WEEKDAY_FULL`;
`src/features/item/RecurrenceEditor.tsx` weekday buttons now carry
`aria-label={WEEKDAY_FULL[day]}` and `aria-pressed={active}` (visible label unchanged).

## Tests

New/extended jsdom tests (all use the repo's `createRoot` + `act` pattern):

- `src/components/ui/ProgressRing.test.tsx` — role/value/bounds/default name, `ariaLabel`
  override, clamping, custom label keeps the value, `decorative` hides the role.
- `src/components/ui/Tabs.test.tsx` — tablist/tab roles, single tabbable + `aria-selected`,
  `type="button"`, `aria-controls`/`aria-labelledby` pairing, ArrowRight wrap, ArrowLeft,
  Home/End, unrelated keys ignored (with focus assertions).
- `src/features/item/RecurrenceEditor.test.tsx` — 7 `aria-pressed` buttons with full names,
  Monday default selected, click reports the new `byWeekday`.
- `src/features/today/TodayView.test.tsx` — agenda ring is a named `50` progressbar; the
  habit toggle contains no `role="progressbar"` and does contain an `aria-hidden` ring.
- `src/features/goals/GoalsView.test.tsx` — goal ring is `aria-valuenow="75"` named
  `"Ship v1 progress: 75%"`.

## Gates

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm run test`
(52 files, 558 tests passed) · `npm run format:check` (clean).

## Notes

- No new dependencies; `Tabs`/`TabPanel` are plain React context.
- `aria-controls` on an inactive tab points at the panel id that exists once that tab is
  selected (panels are not mounted while hidden, preserving current behaviour and keeping
  hidden inputs out of the focus trap).
- IMP-122's `FEATURES.md` entry was already `DONE` with no notes and no code; this report is
  the first implementation record for it.

## Verification follow-up (`verify-IMP-122.md`)

- **(1) Dangling `aria-controls` fixed.** `Tabs` now sets `aria-controls` only on the selected
  tab (`aria-controls={selected ? panelId(baseId, tab.value) : undefined}`), so every emitted
  reference resolves to a rendered panel. `Tabs.test.tsx` gains an explicit test that the
  selected tab's `aria-controls` equals the panel id and the two inactive tabs have none.
- **(4) Agenda label rounded.** `TodayView` now interpolates `Math.round(todayProgress)`, matching
  `aria-valuenow`; the Today test asserts the exact label `"Today's agenda progress: 50% complete"`.
- **(2) `tabpanel` `tabIndex={0}`** left as-is per instruction (harmless extra tab stop).
- **(3) No-selected state** is unreachable via the current UI and was left unchanged.

Re-ran all four gates: `typecheck` clean · `lint` clean · `test` 52 files / 559 tests passed
(two consecutive full runs) · `format:check` clean. One transient failure of the pre-existing
`TodayView` "reverts the ring…" timing test occurred under a loaded full-suite run and did not
reproduce in isolation or on either subsequent full run; it is unrelated to these changes.

