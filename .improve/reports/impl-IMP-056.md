# IMP-056 — Prune expired snooze reminders

## Status

Implemented, after the verify report's **B1** blocker and **L1** were fixed (retry 2) and then the
**R1** duplicate-delivery regression and the **L1** test-determinism finding were fixed (retry 3).
`npm run typecheck`, `npm run lint`, `npm run test` (329 tests, 32 files) and `npm run build` all
pass; the full suite was run **6 consecutive times green**. Not committed; `FEATURES.md` left at
`TODO`.

Retry 2. The first attempt (same files) failed verification: the prune ranked the soonest absolute
among everything above a `now - LOOKBACK_MS` cutoff, so an **already-delivered** snooze still inside
the 24 h grace out-ranked and deleted a **pending** one. Retry 3 keeps that prune logic **byte-for-byte**
and removes the regression it introduced. Everything below describes the shipped state; the deltas
from attempt 1 are called out under _Retry 2 fixes_ and from attempt 2 under _Retry 3 fixes_.

## The rule (why it is safe)

`pruneExpiredAbsolute` sorts every `absolute` into exactly one of three classes, and **only the
first may be deleted**:

| class                  | predicate                            | action                                           | why                                                                                                                                                                                     |
| ---------------------- | ------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| expired                | `absolute <= now - lookbackMs`       | **delete**                                       | `upcomingReminders` only scans back the delivery window, so no tick can surface it again.                                                                                               |
| due, inside the window | `now - lookbackMs < absolute <= now` | **keep**                                         | May already have fired _and_ may still be pending — `deliver` does not record a log row for a toast nobody saw while the tab was hidden, and retries instead, so "past" proves nothing. |
| pending                | `absolute > now`                     | **keep the soonest**, drop the rest of the stack | A snooze the user is still owed; a later press supersedes earlier ones.                                                                                                                 |

Relative reminders (`offsetMinutes` / `timeOfDay`) are never pruned: they re-anchor on every
occurrence and are never stale.

The load-bearing line is the third: a row is only ever collapsed while it is strictly in the future,
so nothing a snooze press is still owed can be ranked against an older one. Attempt 1 ranked across
the whole window above the cutoff, which is exactly what made a fired row win.

### Why the prune does not consult `reminderLog`

A delivered row is provably spent — the dedupe key is `${occKey}::${reminder.id}` — so it _could_ be
reclaimed early by a per-row `reminderLog.wasFired` read (the verify report's option 2). That was
deliberately not done:

- A due-but-undelivered row and a delivered row are indistinguishable to the prune without it, so
  keeping the whole window is the only safe default, and the window is bounded by construction.
- With the snooze writer now _replacing_ absolutes (below), the window can never hold more than the
  rows a single day of snoozing produced, so early reclamation would buy nothing measurable.
- The boot pass stays one `items.toArray()` plus at most one bulk write, with zero IndexedDB index
  lookups — the "pruning cheap" requirement.

## What changed

Three source files, one boot pass, plus a pure helper for the snooze writer.

### `src/domain/reminders.ts`

- `DEFAULT_LOOKBACK_MS` — the delivery window restated in `domain` (which cannot import from `pwa`),
  pinned against `pwa/delivery`'s `LOOKBACK_MS` by a test so the two cannot drift.
- `pruneExpiredAbsolute(reminders, now, lookbackMs = 0)` — the spec's pure helper, now taking the
  delivery window explicitly instead of having the caller pre-subtract it. Order-preserving and
  index-based, so duplicate/legacy ids cannot make it drop the wrong row.
- `withSnooze(reminders, snooze)` — the reminder list a snooze press produces: the item's relative
  reminders plus the new `absolute`, replacing any absolute already there.

### `src/domain/itemActions.ts` — `pruneItemReminders(now, lookbackMs = 0)`

Unchanged in structure from attempt 1, with the two arguments threaded through: `itemRepo.all()`
once, filtered to items that actually hold an `absolute`, then a single `itemRepo.updateMany` for the
batch, skipped entirely when nothing changes (`reminders.length === item.reminders.length`).
Returns the number of items rewritten. Deliberately **not** routed through `patchItem`: no history,
no undo, no toast — a boot maintenance pass must not look like a user edit.

### `src/pwa/ReminderRuntime.tsx`

- Boot effect: `pruneItemReminders(Date.now(), LOOKBACK_MS)` (was `Date.now() - LOOKBACK_MS`), held
  behind the boot-tick gate described under _Retry 3 fixes_ so its write cannot land while a
  delivery tick is in flight.
- Snooze branch: `{ reminders: withSnooze(item.reminders, snooze) }` (was `[...item.reminders,
snooze]`). Boot-only pass, `[]` deps, so the 60 s interval, the `visibilitychange` tick and the
  `notifyEnabled`/`items` rebuild of the tick effect cannot re-trigger it.
- Tick effect: the first `void tick()` is now `void tick().finally(…)`, which opens the boot gate once
  the tick that ran against a **changed** item set has settled.

## Retry 2 fixes

### B1 — the blocker

1. **Ranking.** `pruneExpiredAbsolute` now separates "expired" from "due but still in the window",
   and only collapses rows that are strictly in the future. Attempt 1's
   `pruneItemReminders(Date.now() - LOOKBACK_MS)` + soonest-above-cutoff pair is gone: that
   combination was the bug, and passing the window as a parameter instead of pre-subtracting it
   makes the two concepts impossible to confuse again.
2. **The writer.** A snooze press now supersedes every existing absolute instead of appending, so
   the two-absolute state the repro needs can no longer be produced in the first place. It is still
   defended against at the read side (imported CSV rows, rows written by an older build).
3. **Regression tests.** Three, at the three levels — see below.

### L1 — in-session growth

12 presses left 12 rows (1152 B) and collapsed only at the next load. `withSnooze` makes one press
leave one row, so the list is bounded at every instant rather than at load boundaries.

## Retry 3 fixes

### R1 — the duplicate-delivery regression (BLOCKER)

**Symptom.** On every cold load that actually pruned something, a reminder was notified _and_ logged
twice (verify report §8: 3/3 runs, 0/3 with nothing prunable).

**Mechanism.** `items` is a dep of the delivery tick effect, so the prune's `items` write tears that
effect down and rebuilds it, starting a **second, concurrent** tick; `deliver`'s dedupe is a
non-atomic check-then-record (`wasFired` → `record`, `src/pwa/delivery.ts`), so both ticks pass the
check before either records.

**Fix — the prune is kept off the boot tick's trigger path.** The boot effect now waits for the boot
delivery tick to settle before it writes anything:

- `createTickGate()` (module-local in `ReminderRuntime.tsx`) is a one-shot promise, held in a ref.
- The tick effect compares the `items` identity against the one the previous tick ran with
  (`tickedItems`), and opens the gate from `tick().finally(…)` when that tick ran against a _changed_
  item set. `useItems` allocates a new array on every emission (`useItems`'s `filter`), so identity is
  the live-query emission signal; the gate therefore opens on the **first tick that could actually
  deliver something** and not before.
- The boot effect does `await bootGate.current.settled` and only then calls `pruneItemReminders`.

Why that ordering is airtight regardless of how the live query's emission and the prune's write
interleave:

| ordering                                                     | outcome                                                                                                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| prune's write lands _before_ the items emission is delivered | the emission already carries the pruned rows, so the write triggers no extra tick at all                                                                                                      |
| prune's write lands _after_ it                               | the tick that saw the items has fully settled first — every `deliver` recorded its `reminderLog` row before returning — so the rebuilt tick finds each key already fired and delivers nothing |

Both orderings were exercised in the new test and in a real browser (below).

**Deliberately not done** (still available as **IMP-036**, left `TODO` in `FEATURES.md`): an atomic
`wasFired`/`record` (`add` + catch `ConstraintError`), a unique `[itemId+occKey]` index, or a
`ticking` in-flight guard that drops/coalesces overlapping ticks. This change removes the _new,
frequent_ writer on that path; it does not close the pre-existing latent race (the tick effect still
rebuilds on every `items` change, including the live query's first resolve).

### L1 — the snooze-writer test could not catch a blind append

`ReminderRuntime.test.tsx` _supersedes the previous snooze instead of appending one row per press_
asserted `absolutes).toHaveLength(1)` once, after three presses, behind a single `setTimeout(0)`
barrier. The SW snooze handler is a non-atomic read-modify-write, so a blind append whose writes
overlap leaves **one** row (last write wins) — a second passing implementation. That is why the
append mutation survived 1 of 6 full-suite runs.

Now each press is `pressSnooze(...)`: it dispatches, then **polls until the persisted row actually
changed**, so press N+1 can only start from the row press N committed, and each press asserts on its
own row — exactly one absolute, the surviving id, the label, and the surviving `absolute` inside that
press's own window. A blind append now fails on the second press every time (§ _Mutation-checked_).

## Acceptance criteria

| AC                                                     | How it is met                                                                                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Past absolutes removed on load                      | `pruneItemReminders` in the boot effect next to `pruneBefore`; asserted end-to-end in `ReminderRuntime.test.tsx` and in the new delivery test.     |
| 2. At most one future absolute pending after N snoozes | The writer replaces, so N presses leave 1; the helper also keeps only the soonest of any future stack (both directions tested, now per press).     |
| 3. Relative reminders never pruned                     | Every branch keys on `typeof reminder.absolute === 'number'`; `offsetMinutes`/`timeOfDay` rows pass through untouched, plus the no-absolutes case. |

## Tests

**The exact repro, at three levels** (10 m snooze → it fires → 60 m snooze → reload at +20 m):

- `src/domain/reminders.test.ts` — _never lets an already-fired row outrank a pending snooze_:
  `[fired@-10m, owed@+50m]` pruned at `now` with a 24 h window still contains both, and the comment
  states which assertion dies if the ranking regresses.
- `src/domain/itemActions.test.ts` — _keeps the 60-minute snooze a delivered 10-minute snooze once
  destroyed_: seeds a real `reminderLog` row for the fired key, runs the persistence pass, asserts
  both rows survive **and** that `upcomingReminders` still returns `owed` at its own timestamp — the
  claim that it can still fire. Plus _reclaims a row the delivery window can no longer reach_ for the
  aging half of the same fixture.
- `src/pwa/ReminderRuntime.test.tsx` — _keeps a 60-minute snooze that a delivered 10-minute snooze
  once destroyed_: mounts the real component over the fixture and polls storage after the boot pass.

**L1** — `src/domain/reminders.test.ts` _supersedes the previous snooze instead of appending_ (12
presses → 1 absolute), plus a direct `withSnooze` case; and `ReminderRuntime.test.tsx` drives the
real service-worker message channel three times, asserting per press — see _Retry 3 fixes_.

**R1 — the duplicate delivery (new)** — `src/pwa/ReminderRuntime.delivery.test.tsx` (new file, no
`./delivery` mock, so the **real** `deliver` runs against fake-indexeddb) mounts the real component
over `[due@now-5min, stale@now-48h]` — a load where the pass really prunes — and holds
`reminderLogRepo.wasFired` open, parking the boot tick inside `deliver`'s check-then-record window.
While it is parked it asserts the pass has written **nothing** (`wasFired` called once, not twice),
then releases and asserts the delivered-in-window row survives the pass, `reminderLog` holds exactly
one row for `<occKey>::due`, and exactly one toast reached the store. Removing the gate wait fails
this test on **6/6** runs (`expected 2 to be 1`); the shipped code passes **6/6**.

**Still covered** — the attempt-1 cases survive unchanged: expired dropped / pending kept /
relatives untouched, no-absolutes untouched, five sequential snoozes, an unfired stack collapsing to
the soonest, a due-but-inside-the-window row kept then aged out, a batch with nothing to prune
rewriting zero rows with untouched `updatedAt`, and a past user reminder passing through byte-identical.

**New pin** — `ReminderRuntime.test.tsx` _prunes with the same window the delivery layer scans back_
asserts `LOOKBACK_MS === DEFAULT_LOOKBACK_MS === 24h`, closing the gap the verify report flagged
(§5: "No test asserts the cutoff value").

## Mutation-checked

| Mutation                                                                                | Caught by                                                                                                         |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Restore attempt 1's ranking (rank soonest above `now - lookbackMs`, keep only that one) | **4 failures**: both new `reminders.test.ts` cases, the `itemActions` A/B case, the mounted-runtime A/B case.     |
| Snooze branch appends again (`[...item.reminders, snooze]`)                             | **6/6 full-suite runs**: the per-press snooze test (previously survived 1 of 6).                                  |
| Drop the lookback at the call site (`pruneItemReminders(Date.now())`)                   | 3 failures: both `notificationsEnabled` gate cases **and** the mounted A/B case.                                  |
| **Drop the gate wait** (back to a bare `void pruneItemReminders(...)` at mount)         | **6/6 runs**: the new delivery test — two dedupe checks and two log rows, i.e. the duplicate the fix removes.     |
| **Never open the gate** (pass silently disabled)                                        | **2 failures**: _reclaims expired snooze reminders on load_ and the new delivery test — the prune must still run. |

Every mutated file was restored byte-identical afterwards (`shasum` of `src/pwa/ReminderRuntime.tsx`
matches the pre-mutation copy; no mutation marker remains in the tree).

## Browser pass — `npm run preview` :4173, zero console messages

Real build, real IndexedDB, real reload (`about:blank` → app URL; a hash-only `goto` is a
same-document navigation and does not remount, so it does not run the boot pass).

| probe                                                                    | result                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp-ab`: `[due@now-5m, stale@now-48h]`, genuine reload                   | pass ran (`reminders: ['due']`); `reminderLog` = **1** row for `<occKey>::due`; **1** toast — **3/3 runs**                                                                                                                                                                      |
| 6 × `vp-N` each carrying `[due@now-Nmin, stale@now-48h]`, genuine reload | pass ran on all 6 (`reminders: ['due-N']`); `reminderLog` = 6 rows for 6 distinct keys, **0 duplicate keys**, 6 toasts — exactly once                                                                                                                                           |
| The same 6-item probe on the **pre-fix** build                           | also 6 rows / 0 duplicates _on this machine_ — the browser race is machine- and load-timing dependent, which is why the regression test holds the dedupe window open instead of relying on it. The pre-fix duplicate is reproduced deterministically in the test instead (6/6). |

`playwright_browser_console_messages` → empty. `dist/` is gitignored; the seeded probe rows were
deleted from the test browser's IndexedDB afterwards and the service worker unregistered.

## Kept unchanged

- Relative reminders untouched; a past **user-configured** reminder is never deleted (the editor
  cannot author an `absolute` — `ReminderEditor.tsx` only emits `offsetMinutes`/`timeOfDay`).
- A future snooze still fires (`upcomingReminders` returns it at its own timestamp; asserted).
- The prune stays boot-only (still one `useEffect` with a `[]` terminator, one read plus at most one
  bulk write), and writes nothing when there is nothing to prune. The gate only delays _when_ the one
  pass runs on a load; it never adds a pass.
- No schema change, no new dependency, no `repository.ts` change, no `localStorage`, no direct Dexie
  outside `src/db/`. `delivery.ts` is untouched, so IMP-036's work is still open.

## Known, out of scope

From `.improve/reports/discovered-IMP-056.md`, unchanged by this pass: the reminder editor misrenders
an `absolute` through the offset `Select`, the snooze path persists display copy in `label`, a
notification snooze pushes an undo entry that evicts a real edit, and an imported `absolute` (CSV
carries `reminders` verbatim) is indistinguishable from a snooze — the prune now treats both as
reclaimable only once they are outside the delivery window, which is safe either way.

The verify report's **L2** (boundary asymmetry at exactly `now - LOOKBACK_MS`) is closed as a
side effect: the prune now deletes `<= now - lookbackMs` while `upcomingReminders` treats
`fireAt >= now - LOOKBACK_MS` as reachable, so a row exactly on that boundary is still deleted. The
band is a few milliseconds wide and both callers read their own `Date.now()`, so it is unreachable in
practice; the dropped-by-design rule is stated in the helper's doc comment rather than papered over.

## Verification

```
npm run typecheck && npm run lint && npm run test && npm run build
```

→ clean: 32 test files / **329 tests** (baseline 319 after attempt 1, +10; 310 before the item), PWA
`injectManifest` precache 18 entries (615.28 KiB), `dist/sw.js` emitted. The full suite was then run
**6 consecutive times** with no flake (`Tests 329 passed (329)` every time). Browser pass as tabled
above.

### Exactly-once on a pruning cold load — how it is proven

1. `ReminderRuntime.delivery.test.tsx` — real component, real `deliver`, real repository, one due row
   plus one 48 h-old row, the dedupe check held open: **1** toast, **1** `reminderLog` row, and the
   pass confirmed to have reclaimed the stale row. Fails 6/6 without the gate.
2. Browser, fixed build: `vp-ab` 3/3 runs → **1** row / **1** toast each; the 6-item probe → 6 rows
   for 6 distinct keys, **0 duplicate keys**, 6 toasts, all 6 stale rows reclaimed.
