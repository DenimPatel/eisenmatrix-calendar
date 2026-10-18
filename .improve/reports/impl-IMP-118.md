# IMP-118 / IMP-119 / IMP-120 — Test the PWA boundary, reminder helpers and lib glue

Test-only work. One minimal source change for testability (an extraction), disclosed below.
No production behavior was changed. Nothing committed or pushed.

## Files changed

### Source (testability only)

- `src/pwa/notificationClick.ts` — **new**. The body of the service worker's
  `notificationclick` handler, moved out of `sw.ts` into a pure, dependency-injected
  function `handleNotificationClick(clients, notification, action)`. `sw.ts` is excluded
  from `tsc` and references `self`/workbox, so its handler could not be loaded under
  Vitest; the extraction makes the focus/`postMessage` vs. `openWindow` branch testable
  without a service-worker global. Behavior is byte-for-byte the same: `notification.close()`
  runs synchronously, `matchAll({type:'window', includeUncontrolled:true})` is awaited, the
  first client is focused and receives `{type:'OPEN_ITEM', itemId, occKey, action}`, and no
  client means `clients.openWindow('./')`.
- `src/pwa/sw.ts` — the `notificationclick` listener now delegates to
  `handleNotificationClick(self.clients, event.notification, event.action)`.

### Tests (new)

- `src/pwa/notifications.test.ts` (jsdom, 14 tests) — `notificationPermission`
  (unsupported / granted), `requestNotificationPermission` (unsupported / resolved state),
  `showAppNotification` (permission ≠ granted → `false` with no call; registration present →
  `registration.showNotification` with the exact payload including `icon`/`badge`;
  no registration → `new Notification`; no `serviceWorker` in `navigator` → constructor;
  a rejecting `showNotification` → `false`; a throwing constructor → `false`), and
  `sendSkipWaiting` (no `serviceWorker`; no registration; `waiting` worker posts
  `SKIP_WAITING`; no `waiting` → no post).
- `src/pwa/notificationClick.test.ts` (4 tests) — client present → close + focus + payload;
  no client → `openWindow('./')`; missing notification data → `undefined` identity fields;
  several windows → only the first is used.
- `src/pwa/register.test.ts` (jsdom, 5 tests) — `setupPWA` returns early without
  `serviceWorker`; registers with `immediate` and all three callbacks; `onNeedRefresh`
  pushes a `duration: 0` "A new version is available" info toast whose action reloads
  through `updateSW(true)`; `onOfflineReady` pushes the success toast; `onRegisterError`
  routes through `reportBootFailure` (`console.error` + error toast).

### Tests (extended)

- `src/domain/reminders.test.ts` (+12) — `fireTimesForOccurrence` with mixed triggers
  (absolute + offset + `timeOfDay` + duplicate offset + no-trigger) asserting sorted,
  de-duplicated epochs; empty list when nothing is usable; same-instant collapse.
  `reminderFireTime` `timeOfDay` on a timed occurrence, the `:30` component fallback,
  `null` with no trigger, and absolute-over-relative precedence.
  `formatReminderLabel` for absolute, `timeOfDay`, `0`, `±1440`, `2880`, `±60`, `120`,
  `±30`, `90` and the no-trigger fallback.
- `src/lib/labels.test.ts` (+6) — `statusClasses` distinct per status, coloured statuses
  carry `dark:`, `todo` uses `bg-elevated`/`text-muted` and intentionally has no `dark:`;
  `priorityBadgeClasses` distinct and dark-safe.
- `src/lib/date.test.ts` (+8) — `dateKeyOf` for date-only, datetime, non-ISO parseable and
  unparseable/null; `withTime`, `setTimeOnDateString` (replaces time, today fallback),
  `stripTime`.
- `src/lib/backup.test.ts` (+3) — `readTextFile` resolve, empty-result fallback, and
  `onerror` rejection, using a stubbed `FileReader`.
- `src/db/repository.test.ts` (+5) — `itemRepo.replaceAll` clears then bulk-puts;
  `backupRepo.add/all` newest-first, `latest`, `remove`, `prune(keep)` keeps the newest
  `keep`, and `prune` with fewer rows than `keep`.

## Coverage delta (v8, `--coverage.include` over the target modules)

| File | Stmts before | Stmts after | Branch before | Branch after |
| --- | --- | --- | --- | --- |
| `src/pwa/notifications.ts` | 13.63% | **100%** | 15.38% | **100%** |
| `src/pwa/register.ts` | 28.57% | **100%** | — | **100%** |
| `src/pwa/notificationClick.ts` | n/a (new) | **100%** | n/a | **100%** |
| `src/pwa/sw.ts` | 0% | 0% (unchanged) | 0% | 0% |
| `src/domain/reminders.ts` | 80% | **97.56%** | 70.96% | **94.73%** |
| `src/lib/labels.ts` | 64.7% | **100%** | 0% | **100%** |
| `src/lib/date.ts` | 83.1% | **96.92%** | — | **94.73%** |
| `src/lib/backup.ts` | 78.8% | 80% | 71.1% | 87.71% |
| `src/db/repository.ts` | — | 88.14% | — | 87.87% |

`sw.ts` stays at 0% by design: it is the workbox precache bootstrap plus three
`addEventListener` registrations that cannot be loaded outside a service-worker global.
Its only testable logic (the `notificationclick` body) now lives in `notificationClick.ts`
at 100%. `backup.ts` still shows `downloadFile`/`pickFile` uncovered — they were out of
scope for IMP-120 (only `readTextFile` was required) and are DOM/file-picker side effects.

## Commands / results

```
npm run typecheck   # pass, no diagnostics
npm run lint        # pass, no output
npm run test        # pass, 69 files / 689 tests (57 added: 632 → 689)
npm run format:check  # pass, "All matched files use Prettier code style!"
```

Targeted run of the 8 touched/added test files: 125 tests, all green.

## Uncertainties / disclosures

- The extraction of `handleNotificationClick` is the only source change and exists solely
  to make the SW handler testable; `sw.ts`'s emitted behavior is unchanged. `sw.ts` is
  excluded from `tsc`, so the new import is type-checked via `notificationClick.ts`
  instead.
- `statusClasses('todo')` has no `dark:` variant. Spec AC-2 for IMP-120 assumed every
  variant would carry one, but the default branch deliberately uses theme-aware semantic
  tokens (`bg-elevated`, `text-muted`) per the repo's styling convention. The test asserts
  the real behavior instead of the spec's assumption; see `discovered-IMP-118.md`.
- Browser/Playwright verification was not run; these are pure unit tests over the exact
  code paths.
