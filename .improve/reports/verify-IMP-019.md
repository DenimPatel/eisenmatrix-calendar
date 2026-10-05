# IMP-019 — Verification report

**Verifier:** independent reviewer (did not author the change)
**Date:** 2026-10-05
**Target:** `src/pwa/delivery.ts` (new), `src/pwa/delivery.test.ts` (new),
`src/pwa/ReminderRuntime.tsx` (modified, −65/+4)
**Verdict:** **PASS**

---

## 1. Scope of the diff

```
$ git status --short
 M .improve/PROGRESS.log
 M src/pwa/ReminderRuntime.tsx
?? .improve/reports/discovered-IMP-019.md
?? .improve/reports/impl-IMP-019.md
?? .kilo/
?? src/pwa/delivery.test.ts
?? src/pwa/delivery.ts

$ git diff --stat
 .improve/PROGRESS.log       |  1 +
 src/pwa/ReminderRuntime.tsx | 68 ++---------------------
 2 files changed, 4 insertions(+), 65 deletions(-)
```

- `ReminderRuntime.tsx` shrank by 65 lines: the local `deliver()` (old `:16-47`), the local
  `deliverDigest()` and `LOOKBACK_MS` were deleted and are now imported from `./delivery`
  (`ReminderRuntime.tsx:10`). Everything else in the component (tick, `setInterval(60_000)`,
  `visibilitychange`, `sw.onmessage` snooze/done handlers, `useLiveQuery` wiring) is untouched.
- **`PROGRESS.log`** adds one line, `2026-10-05T05:06Z | IMP-018 | done | 070e1e1 | …`. It matches
  the real IMP-018 commit (`git log --oneline` → `070e1e1 fix(quickadd): … [IMP-018]`) and
  `.improve/STATE.md:20` states *"PROGRESS.log is appended immediately after each commit with the
  resulting SHA"* — orchestrator-owned bookkeeping, not author scope creep. Precedent:
  `verify-IMP-004.md:204`, `verify-IMP-005.md:32`. **No IMP-019 line is expected yet** (IMP-019 is
  not committed).
- **`.kilo/`** is an untracked Agent Manager worktree (`.kilo/worktrees/chatter-ringer/…`), i.e.
  environment noise unrelated to this change; also seen untracked in `impl-IMP-016.md:148`.
- **No scope creep.** No new dependencies (`package.json` untouched), no new tables, no schema
  change, no other feature file touched.

### Debug leftovers / secrets

```
$ rg -n "console\.|TODO|FIXME|XXX|HACK|debugger|@ts-|api[_-]?key|secret|token|password" \
    src/pwa/delivery.ts src/pwa/delivery.test.ts src/pwa/ReminderRuntime.tsx
none found
```

Clean. No `vi.mock`, no `@ts-expect-error` (impl-IMP-019's claim that none was needed holds),
no hardcoded colour classes, no new comments beyond the ones explaining the non-obvious seam and
the "toast nobody can see" intent (allowed by `AGENTS.md`).

### Conventions (`AGENTS.md` + `.improve/REPO_PROFILE.md`)

| Rule | Result |
| --- | --- |
| "No direct Dexie outside `src/db/`" | `delivery.ts` uses only `reminderLogRepo`; the raw `db` handle is confined to `delivery.test.ts`, matching existing colocated tests |
| Pure logic testable without React | ✅ `deliver`/`deliverDigest` are free functions; no React mounted in tests (`AC Notes`: "Extract `deliver` so it is testable without mounting React") |
| Colocated `*.test.ts` | ✅ `src/pwa/delivery.test.ts` |
| Dates via `formatISODate` / no `toISOString()` | ✅ `deliverDigest` uses `formatISODate(now)` |
| `formatISODate` used for the digest key | ✅ `delivery.ts:92` |

---

## 2. Acceptance criteria

### AC1 — recorded only when a notification was shown **or** the document was visible

`src/pwa/delivery.ts:67-82`:

```ts
67:  if (await reminderLogRepo.wasFired(itemId, dedupeKey)) return false;
69:  if (await show(title, notification)) {
70:    await reminderLogRepo.record(itemId, dedupeKey);
71:    return true;
72:  }
77:  if (!isVisible()) return false;
79:  pushToast({ message: `${toastTitle} — ${body}`, tone, duration: toastDuration });
80:  await reminderLogRepo.record(itemId, dedupeKey);
```

`record` is reachable from exactly two branches: the `show() === true` branch (line 70) and
immediately after the `isVisible()` guard that precedes `pushToast` (line 80). There is no third
path. **MET.**

### AC2 — if neither holds, retried next tick (not recorded)

Line 77 returns `false` before `record`, before `pushToast`, and before any timer is created. No new
scheduler exists anywhere in the diff. **MET.**

### AC3 — digest follows the same rule

`deliverDigest` (`delivery.ts:85-115`) is the old component block verbatim (same
`expandOccurrences` maths, same `wasFired(DIGEST_TAG, todayKey)` pre-check at `:93` that keeps the
body build from re-running every tick) and then delegates to the same `deliver`. The digest's own
`notification` payload (`tag: DIGEST_TAG`, no actions) and `Daily digest — …` toast copy are passed
through `DeliverOptions`. The component's `nowMs - digestAt.getTime() < LOOKBACK_MS` guard
(`ReminderRuntime.tsx:55`) is unchanged. **MET.**

---

## 3. Regression / semantics probes

### 3.1 Notification-shown path still records (permission granted + visible)

Playwright could not grant notification permission in the test browser (`Notification.permission ===
'default'`, so `showAppNotification` returns `false`), so this branch is proven by unit tests plus
the digest test with `show: () => true`:

- `delivery.test.ts:31` *"records the reminder when the notification was shown"* — asserts both the
  toast **and** the `reminderLog` row when `show → true` even with `isVisible: () => false`.
- `delivery.test.ts:43` *"records the reminder when only a visible toast was shown"* — `show → false`,
  `isVisible → true`.
- Consequence (reminders do not re-fire forever) proven live in §3.4: after delivery, 8 further
  ticks produced **0** new toasts and **0** new rows.

### 3.2 Retry-storm simulation (repeated ticks)

`deliver` accepts injectable seams, so the tick loop was simulated directly against real Dexie +
`fake-indexeddb`. Scratch specs were run and then deleted (verified: `git status` clean of scratch
files, suite back to 231).

| Simulation | Result |
| --- | --- |
| **1440 hidden ticks**, `show → false` | `reminderLogRepo.record` called **0×**, **0** toasts, `db.reminderLog.count() === 0`, `show` called 1440×. No hot loop, no writes. |
| **500 flapping ticks** (visibility alternating every tick), `show → false` | `deliver` returned `true` exactly **1**×; **1** toast; **1** log row. |
| **500 flapping ticks on `deliverDigest`** | returned `true` **1**×; **1** toast; `wasFired(DIGEST_TAG, todayKey) === true`. |

### 3.3 Bounded by the existing lookback window

`LOOKBACK_MS = 24h` (`delivery.ts:9`) and `upcomingReminders(items, now - 24h, now + 30s)`
(`ReminderRuntime.tsx:32`) are untouched by the diff. Simulated against a real item whose reminder
fires at `09:00`:

| Clock | Reminder still in `due` |
| --- | --- |
| at fire time | 1 |
| +23h | 1 (still retryable) |
| +25h | **0 (ages out → retries stop)** |

So an undelivered reminder is retried at most 1440 ticks and then leaves the window entirely.
Identical bound to the pre-change code.

### 3.4 Duplicate-toast guard, live in the browser

See §4. Result: **1** reminder toast for **1** item, and **1** `reminderLog` row, sustained across
>1 real 60s interval tick and 8 forced `visibilitychange` ticks.

### 3.5 Pre-existing concurrent-tick race (NOT a regression — disclosed)

Two *overlapping* `deliver` calls (an interval tick racing a `visibilitychange` tick, both passing
the `wasFired` read before either records) produce 2 toasts and 2 rows, because
`db/schema.ts` declares `reminderLog: '++id, [itemId+occKey], firedAt'` — a compound **index**, not a
`&`-unique key, so `reminderLogRepo.record`'s `.add()` does not reject the duplicate.

I proved this is **pre-existing**, not introduced by IMP-019, by re-running the same concurrency
probe against the verbatim pre-change `deliver` body from `git show HEAD:src/pwa/ReminderRuntime.tsx`:

```
OLD CONCURRENT [true,true] toasts 2 rows 2      # pre-change code
NEW CONCURRENT [true,true] toasts 2 rows 2      # post-change code
```

Identical. IMP-019 neither introduces nor worsens it; `impl-IMP-019.md:100-105` correctly files
`deliver`'s ignored return value as an out-of-scope discovery. **Not a blocker.**

---

## 4. Playwright verification (`npm run preview` on :4173, current `dist/`)

Baseline `reminderLog` was empty. Console message count was **0 before and 0 after** the whole
session (verified twice via `browser_console_messages`).

### 4.1 Visible delivery + `reminderLog` row

New task → title `IMP-019 delivery probe` → **Schedule** → Reminders **Add** → time `00:00` (already
past, inside the tick window) → **Save**.

DOM `MutationObserver` on the toast host captured exactly **one** reminder toast:

```
toastLog: [ "IMP-019 delivery probe", "Saved", "IMP-019 delivery probe — 2026-10-05 · 2026-10-05" ]
```

`reminderLog`:

```json
[ { "itemId": "d3609822-ef9c-4177-a148-039ab926b5ef",
    "occKey": "2026-10-05::a069c151-2338-4b9b-b5ea-073d82c2eeb4",
    "firedAt": 1791177888831, "id": 2 } ]
```

`occKey` exactly equals `` `${occKey}::${reminder.id}` `` = `2026-10-05::a069c151…`, matching
`ReminderRuntime.tsx:45`. Screenshot: `.improve/artifacts/IMP-019/01-delivered-as-toast.png`
(toast visible bottom-right next to the `Saved` toast).

### 4.2 No duplicate firing on the next tick

After **68 s** (> one full 60 s interval tick):

```
reminderToastCount : 1
reminderLogRowCount: 1
```

Then 5 further forced `visibilitychange` ticks → `newToasts: 0`, `logRows: 1`. Screenshot:
`.improve/artifacts/IMP-019/02-no-duplicate-after-next-tick.png` (no reminder toast present).
**No duplicate.**

### 4.3 Hidden-document path, end-to-end

`document.hidden` was stubbed via `Object.defineProperty` and the probe item was created **through
the app UI** so the write reached `useLiveQuery` (a raw IndexedDB write does not — see
`impl-IMP-019.md:100`, gotcha §4; I confirmed that limitation and worked around it).

Phase A — `document.hidden === true`, item `IMP-019 hidden probe` saved (which itself triggers a
tick):

```
toastsWhileHidden               : ["…editor chrome…", "IMP-019 hidden probe", "Saved"]   # no reminder toast
hiddenProbeKey                  : "2026-10-05::e9103a2c-ddec-4234-943a-0496bb5884be"
hiddenProbeRecordedWhileHidden  : false        <-- AC2: nothing recorded
logWhileHidden                  : ["2026-10-05::a069c151…"]   (only the earlier visible probe)
```

Phase B — `document.hidden` restored to `false`, one real `visibilitychange` event:

```
newToastsAfterVisible         : ["IMP-019 hidden probe — 2026-10-05 · 2026-10-05"]   # exactly one
hiddenProbeRecordedAfterVisible: true
logAfterVisible               : ["2026-10-05::a069c151…", "2026-10-05::e9103a2c…"]
```

Phase C — 3 more ticks: `newToasts: []`, `totalLogRows: 2` (one per item, no duplicates).

This is a complete live demonstration of AC1 + AC2: hidden → no toast, no record; visible → one
toast, one record; subsequent ticks → silent.

### 4.4 Snooze path (IMP-056 concept) still works

The exact payload `src/pwa/sw.ts` posts on a `notificationclick` with `action: 'snooze-10'` was
dispatched at `navigator.serviceWorker` (the same event a real snooze button produces, handled by
`ReminderRuntime.tsx:79-93`, untouched by the diff):

```
remindersBefore : [{ id: "a069c151…", timeOfDay: "00:00" }]
remindersAfter  : [{ id: "a069c151…", timeOfDay: "00:00" },
                   { id: "1bda1ca5…", absolute: 1791178574312, label: "Snoozed 10m" }]
toast           : "Snoozed for 10 minutes"
reminderLogRowCount: 1      (correct: the snoozed reminder is not due yet)
```

`distinctFromFiredKey: true` — the snoozed reminder's dedupe key is
`2026-10-05::1bda1ca5…`, different from the already-fired `2026-10-05::a069c151…`, because the key
still embeds `reminder.id` (`ReminderRuntime.tsx:45`). **A snoozed reminder can therefore still
re-fire under a fresh key; IMP-056's concept is intact.**

Notification actions/payload are also unchanged and asserted by
`delivery.test.ts:108` *"passes the item/occurrence payload to the notification"*:
`tag: 'rem-<itemId>'`, `requireInteraction: true`, `data: { itemId, occKey }`, and the three
actions `snooze-10` / `snooze-60` / `done`.

### 4.5 Cleanup

Both probe items, every `reminderLog` row, and the `document.hidden` stub were removed; the
`document.hidden` override was deleted. Seeded data untouched. `.playwright-mcp/` (tool scratch
dir) was removed from the workspace.

**Console errors: 0.** No unhandled rejections observed.

---

## 5. Gates

```
$ npm run typecheck   # tsc --noEmit          -> exit 0, no output
$ npm run lint        # eslint .              -> exit 0, no output
$ npm run test        # vitest run            -> Test Files 27 passed (27)
                      #                         Tests      231 passed (231)
                      #                         Duration   8.14s
$ npm run build       # tsc --noEmit && vite build
                      #   format: es / precache 18 entries (607.64 KiB)
                      #   files generated / dist/sw.js -> exit 0
```

**231 tests** = baseline 222 + **9** new, all in `src/pwa/delivery.test.ts`. Matches
`impl-IMP-019.md:72`. Baseline is green and the change is green.

---

## 6. Mutation check

Removed the single guard `if (!isVisible()) return false;` from `delivery.ts:77`
(i.e. restored the old "toast and record unconditionally" behaviour):

```
$ npx vitest run src/pwa/delivery.test.ts
 Test Files  1 failed (1)
      Tests  4 failed | 5 passed (9)

 × does not record when the notification failed and the document is hidden
 × does not record the digest when the notification failed and the document is hidden
 × retries an undelivered reminder on the next tick instead of deduping it
 × retries an undelivered digest and toasts once when visible
```

The full suite also fails (`Test Files 1 failed | 26 passed`, `Tests 4 failed | 227 passed`).

**Both AC2 tests and both retry tests fail** — exactly the 4 claimed by `impl-IMP-019.md:75-77`. The
mutation is caught, and it is caught by tests that assert *both* the AC2 invariant and the no-
duplicate-toast invariant, so the retry-storm behaviour is genuinely pinned.

The file was restored byte-identically afterwards:

```
$ diff /tmp/delivery.orig.ts src/pwa/delivery.ts && echo RESTORED-IDENTICAL
RESTORED-IDENTICAL
$ shasum src/pwa/delivery.ts
ad0b0aa1e05dd435efcf3e5dbb04e01bf2e455558  src/pwa/delivery.ts
```

Re-ran all four gates afterwards: still 231 passing.

---

## 7. Findings

### Non-blocking

1. **`impl-IMP-019.md:67` cites `delivery.ts:78` for the guard; it is `delivery.ts:77`.**
   Off-by-one in a doc citation only. The range `:70-82` on line 66 is correct.
2. **Pre-existing concurrent-tick double-delivery** (§3.5). Two overlapping ticks can double-toast
   and double-record because `reminderLog`'s `[itemId+occKey]` is an index, not a unique key.
   Proven identical before and after the change. Worth a separate backlog item; not IMP-019's to fix.
3. **Verification-methodology note (documented, already in the impl report):** a raw IndexedDB write
   from the test harness does not reach `useLiveQuery`, so a Playwright hidden-document test must
   create the probe item through the app UI. I hit this and worked around it; future verifiers
   should read `discovered-IMP-019.md` §4 first.
4. **Untracked `.kilo/`** worktree directory in the workspace. Unrelated to IMP-019; environment
   noise that predates the change.

### Blocking

None.

---

## 8. Criteria summary

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| AC1 | record only when notification shown **or** document visible at toast | **MET** | `delivery.ts:69-80` (only 2 `record` call sites); tests `:31`, `:43`; live §4.1, §4.3-B |
| AC2 | otherwise retry next tick, record nothing | **MET** | `delivery.ts:77`; tests `:57`, `:70`; 1440-tick sim (§3.2); live §4.3-A |
| AC3 | digest follows the same rule | **MET** | `delivery.ts:85-115` delegates to `deliver`; tests `:134`, `:146`, `:159`; 500-tick digest sim |
| Bound | retry bounded by existing lookback window | **MET** | ages out at +25h (§3.3); `LOOKBACK_MS`/guards unchanged |
| No storm | no hot loop, no duplicate toasts | **MET** | 1440/500-tick sims; live 68s + 8 ticks → 1 toast, 1 row |
| Normal delivery | permission granted + visible still records | **MET** | tests `:31`, `:134`; live §4.1 |
| Snooze | IMP-056 concept + notification actions unbroken | **MET** | live §4.4; `sw.ts` untouched; `dedupeKey` still embeds `reminder.id` |
| Gates | typecheck + lint + test + build | **MET** | 4/4 exit 0; 231 tests (222 + 9) |
| Mutation | removing the guard fails new tests | **MET** | 4/9 fail (§6) |
| Visual | toast delivery + log row + no duplicate | **MET** | §4.1-§4.3; 2 screenshots; 0 console errors |

**Final verdict: PASS.**
