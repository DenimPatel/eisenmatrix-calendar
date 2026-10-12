# Verify IMP-056 — Prune expired snooze reminders (FINAL re-verification, attempt 3)

**Verdict: PASS.** Every issue from both prior failing reports is genuinely fixed, measured well
past the bar the earlier attempts were held to. R1/B2 (exactly-once on a cold load that prunes) is
now **15/15 deterministic** in a purpose-built probe and **3/3 in a real browser**; the original
data-loss blocker is re-run end-to-end and closed; L1 (blind-append detection) went from
1-in-6-survived to **12/12 caught**. All three acceptance criteria hold. The four gates are green
and the suite was run **6 consecutive times** clean.

I found **no new blocking defect**. Six new findings are recorded in §7 — all low or
informational, none of them regressions in product behaviour, four of them pre-existing or
dev-only, and none of them reasons to withhold the item. Two of the six are honest corrections to
claims in the implementer's report (§7.3, §7.6).

Reviewer: independent reviewer (did not author the change). Not committed; this report is the only
file added. Branch `improve/auto-20261003`, base `4195d45`, working-tree diff only. Six source
files, three of them source and three test, all reviewed at
`git hash-object` = `8ee20746…` (`ReminderRuntime.tsx`), `51bfdc1f…` (`reminders.ts`),
`139e8171…` (`itemActions.ts`) — byte-identical to the hashes the implementer reported.

---

## 1. Acceptance criteria

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. Past absolutes removed on load | **met** | `pruneItemReminders(Date.now(), LOOKBACK_MS)` (`src/pwa/ReminderRuntime.tsx:161`) in the `[]`-dep boot effect beside `reminderLogRepo.pruneBefore` (`:149`). Browser, 3 genuine cold reloads: 4, 4 and 10 stale rows reclaimed; `itemBytes` 3831 → 3206 (round 3), 3041 → 2793 (round 2). |
| 2. At most one future absolute pending after N snoozes | **met** | Writer *replaces* via `withSnooze` (`src/domain/reminders.ts:131-133`). Browser, 12 real `navigator.serviceWorker` message-channel presses alternating `snooze-10`/`snooze-60`: **2 rows / 1 absolute / 127 B after every single press**, labels alternating correctly, `flat: true`, `allCorrect: true`. |
| 3. Relative reminders never pruned | **met** | Every branch keys on `typeof reminder.absolute === 'number'` (`reminders.ts:109,118,120`). Probe: a 40-day-old item (`updatedAt: 1700000000000`, `start: 2026-08-26`) with `offsetMinutes: -10` + `timeOfDay: 08:00` came back `toEqual(before)` — including `updatedAt`, i.e. byte-identical, no write at all. Browser: `qu:[u-off,u-tod]` unchanged on every reload. |

`.improve/FEATURES.md` correctly left at `TODO` (uncommitted), per the implementer's own note.

## 2. R1/B2 — CONFIRMED FIXED: exactly once on a cold load that prunes

This was the blocker attempt 2 raised (3/3 duplicate deliveries). I did not trust the shipped
single-item test for it; I built three throwaway probes and measured it properly.

### 2a. Deterministic probe, 5 items, 15 consecutive runs

`src/pwa/zzreview056.test.tsx` (deleted after the pass) mounts the **real** `ReminderRuntime` with
the **real** `deliver` and the **real** `reminderLogRepo` over `fake-indexeddb`, seeding **5 items**
each carrying `[due@now-5min, stale@now-48h, rel@offsetMinutes-10]`. The dedupe check
(`reminderLogRepo.wasFired`) is **held open**, parking the boot tick inside `deliver`'s
check-then-record window — the worst case, made deterministic instead of a coin flip.

While parked, the probe asserts the pass has written **nothing**. It then releases and asserts,
per key, that the row count is exactly 1.

```
=== SHIPPED, 15 consecutive runs of the R1 probe ===
run 1..15: wasFiredChecks=20      PASS=15 FAIL=0
```

Every run: **10 `reminderLog` rows for 10 distinct keys, every key count 1**, all 5 stale rows
reclaimed, all 5 `rel` rows intact. Measured diagnostics (one run):

```
[PROBE R1] itemsAllQueries=4 updateMany=1 wasFiredChecks=20 recordAttempts=10 logRows=10
          keyCounts={"ab0|…::rel":1,…,"ab0|…::due":1,…,"ab4|…::due":1}
          toasts=10 staleReclaimed=true
```

`wasFiredChecks=20` against 10 keys is the point: **two ticks ran, and the second delivered
nothing** because the first had already recorded every key before the pass wrote.

### 2b. Base build, same probe — for attribution

`git show HEAD:src/pwa/ReminderRuntime.tsx` (no prune, no gate) under the identical fixture:

```
[PROBE R1] itemsAllQueries=2 updateMany=0 wasFiredChecks=10 recordAttempts=10 logRows=10
          keyCounts={… 10 keys, each 1 …} toasts=10 staleReclaimed=false
```

Same 10 keys, each once. **The residual overlap is not new**: the base build already runs its ticks
concurrently under this fixture. What the gate removes is the prune as an *additional* trigger.

### 2c. Real browser, 3 genuine cold reloads

Real production build (`npm run build` → `npm run preview` :4173), real IndexedDB, real reloads
(`about:blank` → app URL; a hash-only `goto` is a same-document navigation and does **not** remount,
so it does not run the boot pass — measured, and the reason every reload here is a real one).

| round | seeded | after reload | `reminderLog` | bytes |
| --- | --- | --- | --- | --- |
| 1 | 6 rows, 4 × `[due, stale]` | `vp0..vp3:[due]`, `vpp:[fired,owed,rel]`, `vpu:[u-off,u-tod]` | **6 rows / 6 distinct keys / max 1 per key** | 3058 → 2793 |
| 2 | 6 rows, 4 × `[due, stale]` | `r0..r3:[due]`, `rp:[fired,owed,rel]`, `ru:[u-off,u-tod]` | **6 / 6 / 1** | 3041 → 2793 |
| 3 | 7 rows, 5 × `[due, stale, stale2]` | `q0..q4:[due]`, `qp:[fired,owed]`, `qu:[u-off,u-tod]` | **6 / 6 / 1** | 3831 → 3206 |

Round 1 also captured the toasts directly out of the `aria-live` region: **6 toast messages for 6
distinct log keys**, one each (`VP pending` ×2 — `fired` and `rel` — and `VP 0..3`).

Rounds 2 and 3 measured `reminderLog` only: my post-reload poll started after the navigate's
accessibility snapshot, which exceeds the 8 s toast lifetime. That is a measurement limitation I am
stating rather than papering over; the log row count is the authoritative "logged exactly once"
signal and the toast capture in round 1 plus the 15/15 unit runs cover "notified exactly once".

### 2d. Mutation — remove the gate

```
=== MUTATION: gate removed (bare `void pruneItemReminders(...)`) ===
run 1..12: FAIL=12 / PASS=0
AssertionError: expected 2 to be 1     // src/pwa/zzreview056.test.tsx:146 → gate.checks
```

Full suite with the gate removed: **3 failed** — my R1 probe, the new delivery test
(`delivers each reminder exactly once`) and one of my gate-liveness probes. `expected 2 to be 1` is
precisely the duplicate: the prune wrote while a tick was parked, the effect rebuilt, a second tick
started, and both passed the dedupe check before either recorded.

## 3. The original data-loss blocker — re-run, end to end

`src/pwa/zzrepro056.test.tsx` (deleted) drives the reported sequence through the **real** code path
rather than asserting on a fixture: `withSnooze` → real `deliver()` → `reminderLogRepo.record()` →
real `pruneItemReminders(Date.now(), LOOKBACK_MS)`.

```
[REPRO] rewritten=0 ids=["rel","s60"] owedAbsoluteDelta=69.99993333333333min
```

Assertions that passed (6/6 in the file):

- **The exact repro.** T+0 snooze 10 min → T+10m it fires through the real `deliver` (`delivered ===
  true`, `wasFired === true`) → T+10m snooze 60 min → reload at T+20m. The pass returned `0`
  (nothing rewritten), `s60` survived, and `upcomingReminders` over
  `[owed − LOOKBACK_MS, owed]` returns it at **exactly `T0 + 70m`** — i.e. it can still fire. That is
  what attempt 1 destroyed.
- **The legacy two-absolute state** (`[fired@-30min (with a real log row), owed@+40min]`, the shape a
  CSV import or an older build leaves) also keeps `owed`, with its `absolute` bit-identical.
- **The mounted boot pass** on `[fired@-30min, owed@+40min, stale@-48h]`: after the real component's
  boot prune, `['fired','owed']` — the stale row goes, the two inside the window stay.
- Browser, 3 rounds: `vpp/rp/qp` all kept `[fired,owed]` across the reload, `owed` 40 minutes out.

## 4. L1 — the snooze test is now deterministic

```
=== MUTATION: blind append ([…item.reminders, snooze]) ===
run 1..12: CAUGHT=12 / SURVIVED=0
  × supersedes the previous snooze instead of appending one row per press   (every run)
```

Attempt 2's finding was that this mutation **survived 1 of 6** runs. It is now caught **12 out of
12**. The fix is real, not incidental: `pressSnooze` polls until the persisted row actually changes,
so press N+1 can only start from the row press N committed, and each press asserts on its own row —
the id, the label, and the `absolute` inside *that press's own* window. That kills the second passing
implementation (append + lost write) that attempt 2 identified.

Browser corroboration: 12 real SW-channel presses alternating 10m/60m, each landing its own value,
storage flat at 127 B after every one.

## 5. Gates

```
npm run typecheck && npm run lint && npm run test && npm run build
```

`tsc --noEmit` clean · `eslint .` no output · **32 files / 329 tests passed** (baseline 310, **+19**;
no `.only`/`.skip`) · build OK, PWA `injectManifest` precache **18 entries (615.28 KiB)**,
`dist/sw.js` emitted.

**6 consecutive full-suite runs, all green:**

```
run 1: Test Files 32 passed (32)   Tests 329 passed (329)
run 2: Test Files 32 passed (32)   Tests 329 passed (329)
run 3: Test Files 32 passed (32)   Tests 329 passed (329)
run 4: Test Files 32 passed (32)   Tests 329 passed (329)
run 5: Test Files 32 passed (32)   Tests 329 passed (329)
run 6: Test Files 32 passed (32)   Tests 329 passed (329)
```

Plus **20 further** full-suite runs earlier in the pass, all green (for a total of 26 + 6 = 32
consecutive-or-bounded green runs after the last mutation was reverted).

One honesty note: a single run during the probe phase reported `1 failed | 341 passed`. It was in
**my own** probe file (a load-sensitive `expect(calls.updateMany).toBe(writesWhileParked)` under
full-suite parallelism), not in a shipped test — 0 failures in the 20 runs that followed, and the
shipped suite is 6/6 green with the probes deleted. I could not reproduce it in a shipped test.

## 6. Mutation checks — every one caught

| Mutation | Result |
| --- | --- |
| **Remove the gate** (back to a bare `void pruneItemReminders(...)`) | **12/12 probe runs** (`expected 2 to be 1`) + **3 full-suite failures**, incl. `delivers each reminder exactly once` |
| **Restore attempt 1's ranking** (rank the soonest above `now - lookbackMs`, keep only that one) **and** the pre-subtracted call site (`pruneItemReminders(Date.now() - LOOKBACK_MS)`) | **4 failures** — `keeps a 60-minute snooze that a delivered 10-minute snooze once destroyed` (×2, domain + mounted), `keeps a due snooze and a pending one side by side, and only ages them out`, `never lets an already-fired row outrank a pending snooze` |
| **Restore blind append** | **12/12 full-suite runs** (was 1-in-6 survived) |
| **Drop the lookback at the call site** | **4 failures** — both `notificationsEnabled` gate cases, the mounted A/B case, and the new delivery test |

Every mutated file was restored byte-identical, verified by `git hash-object`:
`ReminderRuntime.tsx` `8ee20746f2afa0378266b47b792370b3dcea3fd5`,
`reminders.ts` `51bfdc1ff5d4a7c559e680bb6a758377fce5be66`,
`itemActions.ts` `139e8171b0d2f3285e379b87f73395e3b164566b`.

## 7. New findings — hunted for, none blocking

### 7.1 Can the prune be SKIPPED FOREVER? No. The gate opens deterministically.

The gate opens on the first tick that ran against a **changed** item set
(`tickedItems.current !== null && tickedItems.current !== items`,
`ReminderRuntime.tsx:93`). That requires the tick effect to run a second time with a new `items`
identity. I checked whether `useItems` can fail to produce one, and measured four configurations:

| configuration | does the pass run? | evidence |
| --- | --- | --- |
| items present at mount | **yes** | stale reclaimed on every probe run |
| **DB completely empty at mount** (nothing to deliver, so `wasFired` is never called and the gate is unobservable through delivery) | **yes** | `itemRepoAllReads=2` — 1 from the live query, **1 from the pass**. 5/5 runs. |
| items arrive *after* mount | pass already ran on the empty DB (correct: a `[]`-dep boot pass is one-shot, same as the un-gated version) | |
| unmount → remount | **yes, again** | 2 remounts, both reclaimed. A remount is a fresh `useRef` → a fresh gate. |

The dependency is safe because it is structural, not lucky:
`useItems` = `useLiveQuery(() => itemRepo.all(), [], EMPTY_ITEMS)` wrapped in `useMemo`
(`src/hooks/useData.ts:8-14`), and `dexie-react-hooks@4.4.0`'s `useObservable` only skips the
re-render when `current.result === val` by reference. `itemRepo.all()` returns a fresh array from
`toArray()`, which can never be `Object.is`-equal to the module-level `EMPTY_ITEMS`, so the first
resolve always produces a new identity and the gate always opens — one IndexedDB round-trip later.

**"Emits twice"** — a second `items` emission while a tick is in flight still duplicates:
`reminderLogRows=2 toasts=2`, measured **5/5 on the shipped build and 5/5 on the base build,
identically**. That is IMP-036, `FEATURES.md:1078-1079` still `TODO`, and `delivery.ts` is untouched
(`git diff --stat -- src/pwa/delivery.ts` → empty). The gate does not make it worse; it takes the
prune off that path and leaves the rest where it was. See §7.5 for a consequence worth knowing.

**Remount / navigation.** `ReminderRuntime` is mounted once at the `App` root, *outside* `<Routes>`
(`src/App.tsx:63`), so a route change does not remount it and cannot re-trigger the pass. Confirmed
by reading `App.tsx` and by the browser runs (route state unchanged across reloads).

### 7.2 LOW / dev-only — StrictMode runs the pass twice per mount

`React.StrictMode` is on (`src/main.tsx`), and StrictMode double-invokes mount effects in
development. The `[]`-dep boot effect therefore creates **two** async IIFEs that await the **same**
gate, so when it opens both call `pruneItemReminders`. Measured with `<StrictMode>` in a probe:

```
[GATE strictmode] itemRepoAllCalls=5 updateManyCalls=2
```

One stale item → **2 reads + 2 bulk writes** instead of 1 + 1, both writing identical content.
Idempotent and harmless, and StrictMode does not double-invoke in production builds, so it affects
`npm run dev` only. It is nonetheless the literal answer to "can the one-shot gate fire twice?":
**the gate fires once** (`open()` is idempotent, `:16-31` — a single `resolve`, guarded by `opened`),
**but the pass behind it runs twice** under StrictMode. Worth a `useRef`-lazy init if the double read
matters, or nothing.

### 7.3 LOW / robustness — the pass's liveness is now coupled to a tick settling

This is genuinely new coupling introduced by the gate: the prune no longer runs "on load", it runs
"on load **after** the first changed-item-set tick settles". Probed directly by holding
`reminderLogRepo.wasFired` open forever:

```
[GATE hung-tick] staleRemindersWhileTickHung=1 checks=1     → the pass is genuinely held off
…release, then…                                              → the pass runs and reclaims
```

So **if a tick never settles, the pass never runs for that session** — precisely the unbounded
growth IMP-056 exists to bound. In practice the risk is small: I read every await on the tick path
(`deliver` = one `reminderLog` count + optional `getRegistration`/`showNotification`, the latter
inside `try/catch` in `src/pwa/notifications.ts`; `deliverDigest` = two `expandOccurrences`
sweeps, pure), and found no unbounded await and no synchronous-throw path into `tick()`. A large
backlog does delay it — N due reminders means N sequential `deliver` calls before the pass starts.
Worth a comment at `ReminderRuntime.tsx:151-161` recording that the pass is deliberately gated on a
tick, and arguably a `Promise.race` against the `visibilitychange` tick as a backstop.

### 7.4 INFO — a pruning cold load costs one extra tick

The prune's `items` write re-triggers the tick effect (its `items` dep), so a load that prunes runs
**one extra tick** and one extra `items.toArray()`: `itemsAllQueries` 4 vs **2** on base,
`wasFiredChecks` 20 vs **10** on the identical fixture. This is inherent to writing `items` while the
tick effect keys on `items`, not a bug, and only on a load that actually prunes. Cheap; the extra tick
is pure dedupe checks.

### 7.5 INFO / pre-existing — the duplicate-delivery consequence is an **unhandled rejection** in a real browser

Worth recording because nobody has it written down. `reminderLog` is
`'++id, [itemId+occKey], firedAt'` (`src/db/schema.ts:31`), so `[itemId+occKey]` is a unique index.
When IMP-036's race fires in a real browser, both `deliver` calls reach
`await reminderLogRepo.record(...)` and the second `add()` **rejects with a `ConstraintError`**, so
`deliver` rejects, `tick` rejects, and `void tick().finally(…)` (`ReminderRuntime.tsx:96`) — which
has no `.catch` — becomes an unhandled promise rejection that surfaces in the console as
"Uncaught (in promise)". Pre-existing and unchanged by this diff, but it means the residual race's
user-visible symptom is a console error as well as a duplicate toast.

Related test-infrastructure note: `fake-indexeddb` does **not** enforce that unique index. Measured
directly — a duplicate `reminderLog.add({itemId:'a', occKey:'k'})` threw `null` and left **2 rows**.
So under test a duplicate delivery is visible as 2 rows, while in a browser it is a rejection. The
shipped tests assert per-key via `.where('[itemId+occKey]').equals([…]).count()`, which is the right
shape; a `db.reminderLog.count()`-based exactly-once assertion would pass for the wrong reason.

### 7.6 INFO — the implementer's L2 characterisation is slightly off

`impl-IMP-056.md` §"Known, out of scope" says the previous report's **L2** (boundary asymmetry at
exactly `now - LOOKBACK_MS`) is "closed as a side effect". It is not closed; it is still an
asymmetry. `pruneExpiredAbsolute` deletes at `absolute <= now - lookbackMs` (`reminders.ts:120`)
while `upcomingReminders` treats `fireAt >= now - LOOKBACK_MS` as reachable (`ReminderRuntime.tsx:59`).
Both callers read their own `Date.now()`, so the surviving band is the gap between the prune's
timestamp and the next tick's — milliseconds, and a row in it is already ≥24 h old. The dropped
rule is documented in the helper's doc comment and the reachable case is pinned by
`keeps a snooze that is past but still inside the delivery lookback`. Correctly handled; the report
just overstates the closure.

### 7.7 NIT — `createTickGate()` is allocated on every render

`const bootGate = useRef(createTickGate())` (`ReminderRuntime.tsx:46`) evaluates its argument on
every render, so each one allocates and discards a `Promise` plus a closure; the ref keeps only the
first. `useRef<TickGate | null>(null)` with an init in the effect, or a `let` outside the component,
avoids it. Cosmetic.

## 8. Preserved behaviour — all confirmed

| behaviour | how it was confirmed |
| --- | --- |
| expired vs window vs pending classification | probe: `[imported@-90min, stale@-25h]` → rewritten `1`, survivor `['imported']`; `[missed@-5min]` with a 24 h window → `0` rewritten, survives; with `0` → `1` rewritten, `[]`. Plus the shipped table-driven cases. |
| snooze replaces, does not append | browser: 12 real SW presses → 2 rows / 1 absolute / 127 B after every one; `reminders.test.ts` 12 presses → 1 absolute; blind-append mutation caught 12/12. |
| relative reminders untouched | probe: byte-identical row including `updatedAt` → the pass issued **no write**. Browser `qu:[u-off,u-tod]` on every reload. |
| past user reminders never deleted | `ReminderEditor.tsx:27-28,60-70` can only author `timeOfDay` / `offsetMinutes` — it cannot create an `absolute`, so a user-authored reminder is never prunable by construction. An imported `absolute` inside the window is kept (probe above); only past the window does it go, which is the documented rule. |
| prune cheap, and skips the write when nothing is prunable | spy-asserted: 4 relative-only items → `itemRepo.all` **×1**, `itemRepo.updateMany` **×0**. 3 prunable items → `all` **×1**, `updateMany` **×1** carrying **3** entries. In the browser on the mounted path: `updateMany=0` when nothing was prunable, `=1` when it was. Boot-only: the call sits in the last `useEffect` with a `}, []);` terminator (`:163`) and is absent from the per-tick effect; the 60 s interval, the `visibilitychange` tick and the `notifyEnabled`/`items` rebuild cannot re-trigger it. |
| IMP-036's atomic-dedupe work still OPEN | `git diff --stat -- src/pwa/delivery.ts` → **empty**; `deliver` still does `await wasFired(...) … await record(...)` (`delivery.ts:78-91`). `.improve/FEATURES.md:1078-1079` IMP-036 → `Status: TODO`. Not silently fixed away. |

## 9. Conventions, scope, hygiene — clean

6 files, every changed line traceable to an AC or the spec's Notes. No scope creep. Diff-wide grep
for `console.|debugger|.only|.skip|TODO|FIXME|XXX` in added lines → **zero matches**. No new
dependency, no schema/DB change, no `repository.ts` change, no lockfile change, no `AGENTS.md`
edit. Per `.improve/REPO_PROFILE.md` §5: no direct Dexie outside `src/db/` (the pass goes through
`itemRepo.all()` / `itemRepo.updateMany()`), no `localStorage`, dependency direction respected
(`itemActions → reminders`, both `src/domain`). Bypassing `patchItem` for a boot maintenance pass is
the right call — no history, no undo entry, no toast: probe-asserted `toasts === []` and
`history` unchanged.

All three reviewer probe files (`src/pwa/zzreview056.test.tsx`, `zzrepro056.test.tsx`,
`zzgate056.test.tsx`) and one throwaway uniqueness probe were **deleted**; `ls src/pwa/` shows only
the shipped files. `dist/` is gitignored (`.gitignore:11`), so the builds left no trace. The browser's
service worker was unregistered and the seeded IndexedDB database deleted
(`remaining: []`); the only console warning during the whole browser pass came from my own
`deleteDatabase` call, not the app.

## 10. Browser pass — `npm run preview` :4173, zero console messages

Real build, real IndexedDB, real reloads, real service-worker message channel.

| probe | result |
| --- | --- |
| Cold reload that prunes, ×3 rounds (4–5 items, 1–2 stale rows each) | pass ran every time; **6 `reminderLog` rows / 6 distinct keys / max 1 per key**; toasts captured in round 1: 6 messages for 6 distinct keys; storage reclaimed (3831 → 3206 B) |
| Pending 60-minute snooze beside a delivered 10-minute one, ×3 rounds | `[fired, owed]` intact every round, `owed` 40 min out — the data-loss blocker |
| 40-day-old item, 2 relative user reminders, ×3 rounds | unchanged |
| 12 real `snooze-10`/`snooze-60` SW messages | 12 presses → 12 × `(2 rows, 1 absolute, 127 B)`, labels alternating correctly; 12 snooze toasts + 1 delivery toast, one each |
| `playwright_browser_console_messages` | **empty** on every read |

## 11. Recommendation

**Ready to land.**

Required: none.

Recommended, in priority order — all non-blocking:

1. **IMP-036** (still `TODO`) is the real fix for the residual overlap, and per §7.5 its symptom in
   a browser is a duplicate toast **plus** an unhandled rejection. An atomic
   `wasFired`/`record` (the `[itemId+occKey]` unique index already makes `add()` + catch
   `ConstraintError` a genuine test-and-set) closes both.
2. Note at `ReminderRuntime.tsx:151-161` that the pass is deliberately gated on a tick settling, and
   consider a `visibilitychange`-triggered backstop so a wedged tick cannot suppress storage
   reclamation indefinitely (§7.3).
3. Lazily initialise `createTickGate()` so StrictMode/每-render churn does not allocate a discarded
   promise, and skip the second identical write under StrictMode (§7.2, §7.7).
4. Reword the L2 note in `impl-IMP-056.md` — the boundary is documented, not closed (§7.6).

Carried over from `discovered-IMP-056.md` and unchanged by this pass, still out of scope: the
reminder editor misrenders an `absolute` through the offset `Select`; the snooze path persists
display copy in `label`; a notification snooze pushes an undo entry that evicts a real edit; an
imported `absolute` is indistinguishable from a snooze (the pass treats both as reclaimable only
once they are outside the delivery window, which is safe either way).