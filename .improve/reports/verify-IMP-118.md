# verify-IMP-118 — Independent verification of IMP-118/119/120

Reviewer: independent, skeptical. Scope: the `sw.ts` → `notificationClick.ts` extraction,
the new/extended tests, TZ robustness, flakiness and all gates. No source was left modified.

Verdict: **PASS with one non-blocking, pre-existing caveat** (a flaky test in an unrelated,
unmodified file — see below).

## 1. sw.ts refactor preserves behavior exactly

Original handler (git HEAD) ran `notification.close()` synchronously in the listener, then
`event.waitUntil(<async IIFE>)`. New code calls
`event.waitUntil(handleNotificationClick(self.clients, event.notification, event.action))`.

- `handleNotificationClick` is `async`; the argument is evaluated before `waitUntil`, so the
  function runs synchronously up to its first `await`. `notification.close()` sits **before**
  the first `await`, so it still runs synchronously within the event dispatch — identical to
  the original, which called it before constructing the promise.
- `data = notification.data ?? {}`, `matchAll({type:'window', includeUncontrolled:true})`,
  first-client `focus()` then `postMessage({type:'OPEN_ITEM', itemId, occKey, action})`, else
  `openWindow('./')` — all field-for-field identical (`src/pwa/notificationClick.ts:32-53`).
- The listener is byte-equivalent: `event.waitUntil(handleNotificationClick(self.clients,
  event.notification, event.action))` (`src/pwa/sw.ts:23-25`).

`sw.ts` diff is only: add the import, delete the inline body. No other change.

## 2. sw.ts still builds into dist/sw.js and the handler is bundled

`npm run build` succeeded (`✓ built`, PWA `injectManifest`, `files generated: dist/sw.js`).
`dist/sw.js` is 18,458 bytes and contains the extracted logic:

```
addEventListener("notificationclick",a=>{a.waitUntil(re(self.clients,a.notification,a.action))})
function re(a,e,t){const s=e.data??{};e.close();const n=await a.matchAll({type:"window",
includeUncontrolled:!0}),c={type:"OPEN_ITEM",itemId:s.itemId,occKey:s.occKey,action:t};
if(n.length>0){const r=n[0];await r.focus(),r.postMessage(c)}else await a.openWindow("./")}
```

The minified `re(...)` is `handleNotificationClick`, invoked from the real `notificationclick`
listener with `self.clients`. Bundling is intact.

## 3. Tests are non-vacuous (temporary mutation testing)

Each mutation was applied, the target test file run, then the file restored. Tracked files
restored with `git checkout -- <file>`; the untracked `notificationClick.ts` restored from a
temp backup (verified byte-identical via `diff`). `git status` afterwards matches the original
change set exactly.

| # | File | Mutation | Result |
| - | ---- | -------- | ------ |
| A | `src/pwa/notificationClick.ts` | `openWindow('./')` → `openWindow('/')` | 1 failed / 3 passed |
| B | `src/pwa/notifications.ts` | `pwa-192.svg` → `pwa-999.svg` (icon+badge) | 1 failed / 13 passed |
| C | `src/domain/reminders.ts` | `'At start'` → `'At zero'` | 1 failed / 27 passed |
| D | `src/lib/labels.ts` | todo `bg-elevated` → `bg-surface` | 1 failed / 8 passed |
| E | `src/lib/date.ts` | `dateKeyOf` datetime `slice(0,10)` → `slice(0,7)` | 3 failed / rest passed |
| F | `src/pwa/register.ts` | `'A new version is available'` → `'Update available'` | 1 failed / 4 passed |
| G | `src/lib/backup.ts` | `readTextFile` `event.target?.result` → `undefined` | 1 failed / 26 passed |
| H | `src/db/repository.ts` | `backupRepo.prune` `all.slice(keep)` → `all.slice(0)` | 2 failed / 22 passed |

All eight mutations were caught by the new tests: the suite is not vacuous.

## 4. Flakiness

- Full suite, plain: **689 passed (69 files)** twice in a row.
- Full suite, `TZ=America/New_York`: 689 passed on 3 of 4 runs; one run showed **1 failure**.
- Full suite, `TZ=Asia/Kolkata`: 689 passed.
- Targeted run of the 8 touched/added files: **125 passed** under both
  `TZ=America/New_York` and `TZ=Asia/Kolkata`.

The single failure is **pre-existing and unrelated** to this change:
`src/features/noDataRows.test.tsx > views with nested partial payloads > renders habits with a
null target and a partial target`. `waitForText(host,'Raw habit')` matches as soon as the
*first* of two identically-titled habit rows renders, so the second (`2× per day`) is
occasionally absent when the assertion runs — a `useLiveQuery` render race. The file and every
module it imports (`HabitsView`, `useData`, …) are unmodified by IMP-118/119/120, and it
reproduces independently of these changes (failed in 1 of 5 NY loop runs; passed 8/8 in
isolation). None of the changed/new test files flaked.

## 5. Time / TZ-dependent assertions

The new assertions use only local-construction pairs, so they are TZ-invariant:

- `reminders.test.ts`: `new Date('…T10:00')` vs `new Date('…T08:00').getTime()` — both parsed
  as local, so the delta is TZ-independent. Absolute-label test compares
  `new Date(at).toLocaleString()` against the same `toLocaleString`, so locale/TZ cancel.
- `date.test.ts`: `dateKeyOf`/`stripTime`/`setTimeOnDateString` are pure string ops on local
  `YYYY-MM-DD[THH:mm]`; the only "now" use (`setTimeOnDateString('nonsense', …)` →
  `todayKey()`) could flake only across a midnight boundary during the assertion — not
  observed.

Both TZ runs pass, confirming robustness.

## 6. Gates

| Gate | Command | Result |
| ---- | ------- | ------ |
| Typecheck | `npm run typecheck` | pass (exit 0) |
| Lint | `npm run lint` | pass (exit 0) |
| Tests | `npm run test` | 689 passed (69 files) |
| Format | `npx prettier --check .` | pass |
| Build | `npm run build` | pass; `dist/sw.js` emitted with handler |

## Residual issues

1. **Pre-existing flake** in `src/features/noDataRows.test.tsx` (habits partial-target test),
   unrelated to this change. Recommend fixing the `waitForText` wait to key on the second row
   (e.g. wait for `'2× per day'`) or give the two habits distinct titles. Not a blocker for
   IMP-118.
2. `src/pwa/sw.ts` remains at 0% coverage by design (workbox bootstrap + `addEventListener`s);
   only its extracted body is covered. Disclosed in the impl report and acceptable.
