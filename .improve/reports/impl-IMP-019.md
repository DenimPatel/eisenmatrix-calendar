# IMP-019 — Implementation report

**Status:** implemented; all four gates pass; not marked DONE in FEATURES.md; not committed.

## 1. The change

New module `src/pwa/delivery.ts` owns reminder delivery; `src/pwa/ReminderRuntime.tsx` keeps only
scheduling (when to attempt) and imports `deliver` / `deliverDigest` / `LOOKBACK_MS` from it. The
digest block moved out of the component into `deliverDigest`, so there is now exactly **one**
implementation of "show → record" instead of two copies — the duplication was the root cause.

`deliver` (`:38-83`) after the change:

```ts
if (await reminderLogRepo.wasFired(itemId, dedupeKey)) return false;

if (await show(title, notification)) {
  await reminderLogRepo.record(itemId, dedupeKey);
  return true;
}

// A toast nobody can see is not delivery, so it is not queued while hidden:
// that is what keeps repeated retries from stacking duplicate, already stale
// toasts for when the tab regains focus.
if (!isVisible()) return false;

pushToast({ message: `${toastTitle} — ${body}`, tone, duration: toastDuration });
await reminderLogRepo.record(itemId, dedupeKey);
return true;
```

Three seams (`show`, `pushToast`, `isVisible`) default to the real notification API, the Zustand
store and `document.hidden`, and are injectable for tests — no React mounting, no `vi.mock` of the
component. `DeliverOptions` also carries the toast duration/prefix and the notification payload, so
the digest can keep its own (action-free, `tag: __digest__`) notification and its
`Daily digest — …` toast copy without a second delivery path.

`deliverDigest` (`:86-115`) is the previous component block verbatim (same `expandOccurrences`
maths, same `wasFired(DIGEST_TAG, todayKey)` pre-check that keeps the two occurrence sweeps from
re-running on every tick) followed by a `deliver` call with `itemId = DIGEST_TAG`,
`dedupeKey = occKey = todayKey`.

### Retry behaviour (the "no storm" requirement)

Nothing new was scheduled. An undelivered reminder is simply **not recorded**, so the existing
`60s` `setInterval` and the existing `visibilitychange` handler retry it. The bound is the
existing `LOOKBACK_MS` window, unchanged:

- reminders: `upcomingReminders(items, now - 24h, now + 30s)` stops returning a reminder once its
  `fireAt` is older than 24h, so retries stop after ≤1440 ticks and then the reminder ages out —
  the same 24h horizon that already existed;
- digest: the component's `nowMs - digestAt.getTime() < LOOKBACK_MS` guard is unchanged;
- no new timers, no backoff state, no new tables, no writes on the failing path (the hidden branch
  returns before both `pushToast` and `record`), so a denied permission costs one IndexedDB
  `wasFired` read per tick;
- **toasts are not queued while hidden**. This is the decision that prevents the duplicate pile-up:
  with the old code a hidden tab recorded the reminder and pushed an invisible toast; with the naive
  "don't record, but still toast" fix the user would return to a tab holding several already-stale
  copies of the same reminder, one per tick. Instead the hidden attempt is a no-op and the
  `visibilitychange` tick (which only fires on *becoming* visible) delivers once, visibly.

## 2. Acceptance criteria

| AC | Where satisfied |
| --- | --- |
| 1. recorded only when a notification was shown **or** the document was visible when the toast appeared | `delivery.ts:70-82` — `record` is reached only from the `show()` branch or immediately after the `isVisible()` check that guards `pushToast`; tests *"records the reminder when the notification was shown"* and *"records the reminder when only a visible toast was shown"* (the latter injects `isVisible: () => true`) |
| 2. if neither holds, retried next tick (not recorded) | `delivery.ts:78` returns `false` before `record`; tests *"does not record when the notification failed and the document is hidden"* (real `document.hidden === true`, stubbed `show` returning `false`) and *"retries an undelivered reminder on the next tick instead of deduping it"* (three ticks: two hidden, one visible; `show` called 3×, exactly one toast, one log row, and the 4th tick deduped) |
| 3. digest follows the same rule | the digest calls `deliver`; `deliverDigest` tests cover recorded-when-shown, not-recorded-when-hidden, and retry-once-when-visible |

## 3. Tests

New `src/pwa/delivery.test.ts` (`@vitest-environment jsdom`, real Dexie + `fake-indexeddb`), **+9**
tests (222 → 231). No React is mounted; `useUiStore` is imported only for its types/seams.

Mutation check: deleting the `if (!isVisible()) return false;` guard — i.e. restoring the old
"toast and record unconditionally" behaviour — fails **4** of the 9 (both hidden-not-recorded tests
and both retry tests). Stashing the whole module fails 5.

## 4. Browser verification (Playwright, `npm run preview` on :4173, current build)

Served bundle confirmed current (`index-ByYh47vR.js` matches `dist/`). Notification permission in
the test browser is `default`, so `showAppNotification` returns `false` — the toast fallback path.

1. **New task** → title `IMP-019 runtime probe` → **Schedule** tab → Reminders **Add** → time set to
   `00:00` (already past) → **Save**.
2. Two toasts: `Saved` and `IMP-019 runtime probe — 2026-10-05 · 2026-10-05` — the reminder was
   delivered by the runtime tick on the same commit, i.e. the refactored path is wired up.
3. `reminderLog` row written: `{ itemId: 37fa866e…, occKey: "2026-10-05::ee643d36…", firedAt }`.
4. Console: **0 messages**; no unhandled rejections.

Cleanup: the probe item and its log row were deleted with a raw IndexedDB transaction and the app
reloaded (agenda back to 3 seeded items, `reminderLog` empty). Seeded data untouched.

## 5. Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run test` 27 files / 231 tests ·
`npm run build` OK (`dist/sw.js`, 18 precache entries, 607.64 KiB).

## 6. Out of scope

Four observations (an eventually-dropped undelivered reminder, the always-retried digest body
build, `deliver`'s return value being ignored by the runtime, and a Playwright/Dexie liveQuery gotcha
for future verifiers) are in `.improve/reports/discovered-IMP-019.md`. None were changed.