# verify-IMP-110 — Evaluate a reminder's fire time outside the occurrence's own day window

- **Reviewer:** independent, skeptical (did not author)
- **Artifact:** `git diff` on `src/domain/reminders.ts` + `src/domain/reminders.test.ts` (working tree, uncommitted)
- **Baseline:** `d3e6f42`
- **Verdict:** **PASS**

## Acceptance criteria

| # | Criterion | Result | Evidence |
| - | --------- | ------ | -------- |
| 1 | Fire times on days before the occurrence day are evaluated | PASS | `offsetBounds` widens the occurrence window to `[from - max, to - min]`, the exact pre-image of `[from,to]` under `fireAt = occStart + offset`; the existing `fireAt` filter (`reminders.ts:80`) still bounds output |
| 2 | `-1440` repro returned at the fire-time tick (Jan 4 09:00:30), not Jan 5 00:00 | PASS | committed test `evaluates a negative offset that fires on a day before the occurrence`; probe confirmed |
| 3 | Same-day offsets / `timeOfDay` timing unchanged; list sorted by `fireAt` | PASS | committed test `keeps same-day offsets and timeOfDay timing, sorted by fireAt`; probe `timeOfDay on a timed item is unchanged` |

## Math check

`fireAt = occStart + offset` ⇒ `occStart = fireAt - offset`. For `fireAt ∈ [from, to]` the covering
occurrence window is `[from - max(offset), to - min(offset)]`. With `max ≥ min` and `from ≤ to` the
window can never invert, and when no reminder carries `offsetMinutes` `offsetBounds` returns `{0,0}`
so `absolute`/`timeOfDay`-only items are byte-identical to HEAD. `expandOccurrences` floors the
window to whole days, which only adds slack, never removes reach.

## Adversarial probes (throwaway `src/domain/__probe_imp110.test.ts`, 11 cases, all green, deleted)

- **Positive offsets** — `+2880` (2 days, beyond the 24 h lookback) now fires at the correct tick
  (`[now-24h, now+30s]`). This is the same code path as the negative case (`fromMs - max`); the
  committed suite does **not** cover it.
- **Multiple reminders per item**, mixed `-1440`/`-10`: each fires on its own tick; `min`/`max` span
  all reminders so no reminder is missed.
- **All-day item** with `-1440`: fires the previous midnight.
- **occKey stability**: `occKey === '2026-01-05'` and identical across different windows ⇒ the
  delivery dedupe key `occKey::reminder.id` (`ReminderRuntime.tsx:117`) is stable, so overlapping
  consecutive 60 s ticks cannot double-deliver (verified with two overlapping windows).
- **`count` / `until` edges**: a `count: 3` and an `until`-bounded series expand to exactly their
  bounded occurrence set under the widened window (widening cannot conjure extra occurrences;
  `generated` is independent of the window).
- **Boundary inclusivity**: fire time exactly at `from` and exactly at `to` both returned.
- **No leakage**: every returned `fireAt` lies within `[from, to]`.
- **Perf (long window)**: 10-year daily series + `-1440` → 3653 rows well under 2 s; the change only
  widens by the offset span (UI presets cap at `-1440`, i.e. 1 day), so asymptotics are unchanged.

## Gates (reviewed revision)

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — 46 files, 511 tests pass
- `npm run format:check` — pass
- `npm run build` — pass (SW + precache generated)

## Issues

None blocking. Non-blocking observations:

1. **Test-coverage gap (not a defect):** the committed tests only exercise negative offsets; the
   identical `fromMs - max` path for positive offsets beyond the lookback is untested. My probes
   show it works. Worth a case in a follow-up.
2. **Criterion 2 wording:** "not first returned at Jan 5 00:00" is only implied by the positive
   assertion; no explicit negative assertion. Immaterial.
3. **Unbounded offset magnitude:** an imported `offsetMinutes` of pathological size widens the window
   proportionally (bounded by `MAX_ITERATIONS = 200_000` and any `count`). Not reachable from the
   editor (presets ≤ `-1440`); acceptable.
