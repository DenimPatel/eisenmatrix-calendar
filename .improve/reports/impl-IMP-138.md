# IMP-138 — Make the quick-add preview reflect the Kind/Date/Time overrides

## Status

Implemented. All gates pass: `npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build`.
Not committed; `.improve/FEATURES.md` status untouched.

## Root cause

`src/features/quickadd/QuickAdd.tsx` rendered `parsed.chips` (the chips computed by
`parseQuickAdd` from the raw text). The Kind select (`effectiveKind`) and the Date/Time
inputs are applied only inside `commit()`, so the preview kept promising the parsed row
(`bill · USD 120 · every month on the 5`) after the user changed the controls.

## What changed

### `src/domain/quickadd.ts` — new pure helper `quickAddPreviewChips(parsed, overrides)`

Builds the chip list from the parse plus `{ kind, date, time }` overrides:

- kind chip label is the effective kind;
- date/time chips use the overrides when present, else the parsed values;
- amount/quantity chips are dropped when the kind was changed to one whose data payload
  does not carry the field, decided by reusing the commit-path helper
  `quickAddDataFor` (`'amount' in data`, `'quantity' in data`) — so `bill`→`note` drops
  `USD 120`, `bill`→`task` drops it too, and `shopping`→`note` drops the quantity;
- the recurrence chip is dropped when the kind is changed to a non-recurring kind
  (`NON_RECURRING_KINDS = ['note']`) — `bill`→`note` hides `every month on the 5`,
  `bill`→`event`/`task` keeps it;
- urgency/importance/tag chips are unaffected.

Without any override (`overrides.kind === parsed.kind`, empty date/time) the helper
reproduces `parsed.chips` byte-for-byte (same fields, wording and order), so the control
case is unchanged.

### `src/features/quickadd/QuickAdd.tsx`

- the chip row renders the memoised `quickAddPreviewChips(parsed, { kind: effectiveKind,
  date: dateOverride, time: timeOverride })` instead of `parsed.chips`;
- the kind-override branch of `commit()` clears `item.recurrence` when the effective kind
  is a non-recurring kind, so the stored row agrees with the (recurrence-free) preview
  for a Note.

## Tests

- `src/domain/quickadd.test.ts` — 7 cases for `quickAddPreviewChips`: byte-identical
  control output; `bill`→`note` (kind/date/urgency only); `bill`→`task` (amount dropped,
  recurrence kept); `bill`→`note`→`bill` round-trip; date override; time override (adds a
  chip where none was parsed); shopping quantity only for a shopping kind.
- `src/features/quickadd/QuickAdd.test.tsx` — 5 jsdom cases:
  - `tracks the Kind override in the preview chips` — types the sample and switches Kind
    `bill`→`note`→`event`, asserting the rendered chip texts track the control;
  - `tracks the Date and Time overrides in the preview chips` — sets the Date/Time inputs
    and asserts the chips show `2026-12-25` / `14:30`;
  - `drops the parsed recurrence when a bill is committed as a Note` — types the sample,
    switches Kind to Note, asserts the preview chips are `['note', <date>, 'Urgent']`, then
    commits and asserts the stored row is `kind: 'note'` with `recurrence: null` and no
    `amount` (covers the commit-path guard; removing the guard fails this test);
  - `keeps the parsed recurrence when a Note is committed without a kind override` — types
    `note: …every month on the 5th`, commits, asserts `kind: 'note'` and
    `recurrence.freq === 'monthly'`;
  - `keeps an explicitly parsed recurrence on a Task commit` — types `gym mon/wed/fri 7am`,
    commits, asserts `kind: 'task'` and `recurrence.freq === 'weekly'`.

## Verification

Gates (2026-10-19):

```text
typecheck   PASS
lint        PASS
test        74 files / 737 tests PASS
format:check PASS
build       PASS (dist/sw.js generated, 28 precache entries)
```

Browser (isolated `npm run preview -- --port 4185 --strictPort`, SW/caches reset per
AGENTS.md, 0 console errors/warnings):

| Viewport | Action | Chips |
|---|---|---|
| 1280×800 | sample typed (control) | `bill · 2026-10-18 · every month on the 5 · USD 120 · Urgent` |
| 1280×800 | Kind → Note | `note · 2026-10-18 · Urgent` |
| 1280×800 | Kind → Event | `event · 2026-10-18 · every month on the 5 · Urgent` |
| 1280×800 | Date → 2026-12-25, Time → 14:30 | `event · 2026-12-25 · 14:30 · every month on the 5 · Urgent` |
| 1280×800 | Kind → Note then Add | preview `note · 2026-12-25 · 14:30 · Urgent` |
| 390×844 | sample typed | `bill · 2026-10-18 · every month on the 5 · USD 120 · Urgent` |
| 390×844 | Kind → Note | `note · 2026-10-18 · Urgent` |

Committed Note row (read from IndexedDB `eisenmatrix`/`items`):

```json
{ "kind": "note", "title": "Pay electricity", "start": "2026-12-25T14:30",
  "allDay": false, "urgency": "high", "recurrence": null, "data": { "pinned": false } }
```

The stored row matches the preview exactly: kind `note`, no amount, date/time
`2026-12-25`/`14:30`, urgency `high`, recurrence `null`.

Screenshots: `.improve/artifacts/IMP-138/` (`01`–`06`).

## Uncertainty / notes

- The spec's criterion names "amount/recurrence for a Note". The commit path previously
  kept the parsed recurrence for any kind, so hiding the recurrence chip alone would have
  made the preview disagree with the stored row; the commit now drops recurrence for the
  non-recurring `note` kind to keep preview and storage consistent. Other kinds
  (task/event/habit/goal/bill/shopping) keep recurrence, and `bill`→`note`→`bill`
  restores it.
