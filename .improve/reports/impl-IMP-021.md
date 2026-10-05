# IMP-021 — Implementation report (retry 2)

**Status:** implemented; all four gates pass, 8/8 consecutive full-suite runs green; **not marked DONE in
FEATURES.md**; **not committed**.

Retry 2 addresses the three issues from `.improve/reports/verify-IMP-021.md` (FAIL): the flaky
`ReminderRuntime.test.tsx` assertion, the silent regression for existing users of the
`notificationsEnabled` default, and the incoherent/overclaiming Settings UI. The original gate itself
(§2 of that report: AC1/AC2/AC3 met, fail-closed, mutation-proof) is unchanged and was re-verified.

---

## 1. The change

Six production files (four from attempt 1, two new), no new dependency:

**`src/pwa/delivery.ts`** _(unchanged in retry 2)_ — `DeliverOptions.notifyEnabled?: boolean`,
defaulting to `false`, and the notification branch becomes
`if (notifyEnabled && (await show(title, notification)))` (`:80`). Fail-closed: a caller that forgets the
option cannot leak a notification. Only the `show` arm is gated, so the in-app toast path and the
IMP-019 record-only-on-real-delivery rule are structurally untouched. `deliverDigest` forwards the gate
for free — its `...options` spread (`:124`) already sits last.

**`src/pwa/ReminderRuntime.tsx`** _(unchanged in retry 2)_ — reads the live setting per render
(`:19`), passes `{ notifyEnabled }` to `deliver` (`:49`) and `deliverDigest` (`:59`), and lists it in
the effect deps (`:112`). The dep list was **not** weakened; §3 explains why it must stay.

**`src/types/settings.ts`** — doc comment on `notificationsEnabled` recording that it gates device
notifications only, that in-app banners are the fallback, and that
`runNotificationGateMigration` prevents the gate from revoking an existing grant.

**`src/features/settings/SettingsView.tsx`** — one control instead of two (see §4).

**`src/db/migrations/notificationGate.ts`** _(new)_ — the back-compat seed (see §2).

**`src/App.tsx`** — runs `runNotificationGateMigration()` in the existing mount effect next to
`runLegacyMigration()`, with its own `console.warn` on failure.

## 2. Backward compatibility — the seed (retry-2 issue 2)

`DEFAULT_SETTINGS.notificationsEnabled === false` plus a gate that reads the setting means every
installation that had **already granted** browser permission — via the pre-existing Enable button, via
a browser-level grant for the origin, or from a grant predating that button — would have silently
dropped to in-app banners. `deliver()` stays fail-closed; the fix is a one-time seed instead of a
looser default.

`runNotificationGateMigration()` (`src/db/migrations/notificationGate.ts`), called once per app boot:

| Stored state                         | Permission                           | Outcome                  | Effect                                                                           |
| ------------------------------------ | ------------------------------------ | ------------------------ | -------------------------------------------------------------------------------- |
| no `app` row, or row without the key | `granted`                            | `seeded`                 | writes `{...DEFAULT_SETTINGS, ...existing, notificationsEnabled: true}` + marker |
| key present (incl. explicit `false`) | any                                  | `already-decided`        | marker only; value untouched                                                     |
| key absent                           | `denied` / `default` / `unsupported` | `permission-not-granted` | nothing written, **no marker**                                                   |
| marker present                       | any                                  | `already-migrated`       | no-op                                                                            |

Design points, each covered by a test:

- **Never forces it on.** A permission-less install is not seeded _and_ not marked, so it keeps the
  opt-in default; a later grant made outside the app is still picked up on a subsequent launch
  ("picks up a grant made later on a later launch").
- **Never overrides a real choice.** The key-presence check, not the value, is the decision point, so an
  explicit `false` (deliberate opt-out, or the legacy Enable button persisting a refusal) survives.
- **Idempotent twice over.** The marker short-circuits repeat runs _and_ the key-presence check alone
  would block a re-seed. The test flips the setting back to `false` after a seed and re-runs, proving the
  migration can never re-enable a gate the user turned off.
- **Testable without a browser.** The permission probe is an injectable dep
  (`{ settings?, permission? }`, mirroring `runLegacyMigration`'s `MigrationDeps`); the ambient default
  reads `Notification` with an `typeof` guard, so it resolves to `'unsupported'` in Node. The module
  persists only through `settingsRepo` — no direct Dexie, no `localStorage`.

Timing: `ReminderRuntime`'s first tick can run before the seed lands (a child effect runs before the
parent's), but the seed is a live-query write, so the dep rebuild re-ticks immediately — nothing is lost
and nothing is duplicated. This is the same benign first-tick note the verifier already recorded.

## 3. The flaky test (retry-2 issue 1)

Root cause was exactly as reported: `useSetting` serves `DEFAULT_SETTINGS` until the Dexie live query
resolves (`src/hooks/useData.ts:39-46`), so the **first** tick legitimately saw
`notificationsEnabled === false`. `mountRuntime` settled a fixed six `setTimeout(0)` rounds and the
assertions then demanded _every_ recorded gate be `true` — which fails whenever resolution lands after
those six rounds, i.e. under parallel-worker load.

The **assertions** changed; the **effect dep list did not**.

- Added `settleUntil(assertion)` (`src/pwa/ReminderRuntime.test.tsx:66-79`): it re-runs one `act`-wrapped
  macrotask flush plus the expectation until it passes, up to 150 attempts, rethrowing the real
  expectation error if it never settles. `act`-wrapping each attempt keeps React state updates from the
  live query inside the act environment, so no warning path is introduced.
- Each test now **waits for the stored value to reach the delivery path** (`settleUntil(() =>
expect(gates.deliver).toContain(true))`) and asserts only on the calls from that tick onwards:
  `expect(gates.deliver.slice(resolvedAt)).not.toContain(false)`. The pre-resolution `false` calls are
  legitimate and are no longer asserted against.
- The "turn it back off" direction keeps the strict all-`false` assertion, because after the write
  settles every subsequent call must be `false` — the mock `deliver` resolves immediately and the
  fixture has a single due reminder, so no old-closure tick can interleave after the snapshot.
- Nothing is weakened into vacuity: the stale-closure requirement (a new tick on flip, same mount, no
  60 s wait, no remount) is still asserted, and mutation 3 below still fails **both** tests.

## 4. Settings UI (retry-2 issue 3)

- **One control.** The duplicate **Enable** button is removed; the switch is the only control. It was
  already the complete control — turning it on requests browser permission and persists the result,
  turning it off persists `false` and never touches permission — so the button was pure duplication
  (when the switch was on, Enable was a no-op that re-persisted the same value). The `Bell` import is
  gone.
- **No overclaim.** "Reminders and the digest **always** appear as in-app banners" became "_While this
  app is open_, reminders and the digest show as in-app banners; this switch controls device
  notifications only." IMP-019 deliberately suppresses the toast in a hidden tab and retries on the next
  tick, so "always" was false.
- **Coherent recovery path.** A new sentence tells the user how to recover when the browser blocked the
  prompt, and the refusal toast now distinguishes the two refusals instead of one vague message:
  `denied` → "Browser blocked notifications — re-allow them for this site in your browser settings";
  otherwise → "Device notifications stay off without browser permission".

## 5. Acceptance criteria

| AC                    | Requirement                                                                       | Result  | Evidence                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                     | `notificationsEnabled` false ⇒ no `showAppNotification`; in-app toasts still work | **MET** | `delivery.ts:80` gates only the `show` arm; 4 gate tests in `delivery.test.ts` + 2 runtime tests. Re-verified by mutation 1/2.                                                         |
| 2                     | true + permission granted ⇒ behavior unchanged                                    | **MET** | the 9 IMP-019 tests pass `notifyEnabled: true` explicitly and still pass; `ReminderRuntime.test.tsx` shows the runtime passes the resolved `true` live.                                |
| 3                     | Settings copy matches actual behavior                                             | **MET** | copy names both delivery paths, scopes in-app banners to "while this app is open", and no longer claims "always"; asserted in `SettingsView.test.tsx` (old sentences asserted absent). |
| back-compat (retry 2) | no existing user silently loses device notifications                              | **MET** | `notificationGate.ts` + 10 tests + browser evidence (§7).                                                                                                                              |

## 6. Tests and mutation checks

`npm run test`: **29 files / 258 tests** (was 246; baseline 236) — **+12**.

- `src/db/migrations/notificationGate.test.ts` **(new, 10 cases)** — seed with no row; seed into a partial
  row preserving `theme`/`weekStartsOn`; `denied`/`default`/`unsupported` write nothing and leave no
  marker; explicit `false` untouched with permission granted; existing `true` not rewritten; idempotent
  and never re-enabling after an opt-out; a later grant is picked up; ambient `Notification.permission`
  is read when no probe is injected.
- `src/pwa/ReminderRuntime.test.tsx` — the two gate tests, now settling deterministically (above).
- `src/features/settings/SettingsView.test.tsx` — **6** device-notification cases: new copy (old
  sentences asserted gone), single control (no `Enable` button next to the switch), reflects/persists
  off, refusal toast for `denied` and for a dismissed prompt (`it.each`), and grant ⇒ `true` + checked.
- `src/pwa/delivery.test.ts` — unchanged from attempt 1.

| #   | Mutation                                                           | Result                                                                        |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | `delivery.ts:80` → `if (await show(title, notification))` (ungate) | **4** gate tests fail (re-verified by the previous verifier; logic untouched) |
| 2   | `delivery.ts:73` → `notifyEnabled = true` (fail-open default)      | 1 test fails (previous verifier)                                              |
| 3   | `ReminderRuntime.tsx:112` → drop `notifyEnabled` from deps         | **2/2** runtime tests fail (no further tick) — **re-run in retry 2**          |
| 4   | `notificationGate.ts` → drop the explicit-choice guard             | **2** fail (`already-decided` cases)                                          |
| 5   | `notificationGate.ts` → seed regardless of permission              | **5** fail (refusal + later-grant cases)                                      |
| 6   | `notificationGate.ts` → drop the once-only marker guard            | **1** fails (idempotency)                                                     |

Mutations 3–6 were applied and reverted in this retry; `git diff` for the pre-existing files is
identical to the attempt-1 implementation.

## 7. Browser verification (Playwright, `npm run preview` on :4173, freshly built `dist/`)

The first load again served the **old** service-worker precache (old copy still showed **Enable** and
the "always appear" sentence) until the SW was unregistered, the precache cache dropped and the app's
own _"A new version is available → Reload"_ prompt clicked — the stale-SW trap the previous run documented.

- Notifications card now renders **one** control per row: `switch "Device notifications"` (`aria-checked
="false"`), no Enable button — screenshot
  `.improve/artifacts/IMP-021/04-retry2-notifications-single-control.png`.
- Copy rendered as intended; the migration ran on boot and wrote
  `migration.notificationGate {version: 1}`. This profile's `app` row already stored an explicit
  `notificationsEnabled: false`, so the outcome was `already-decided`: **the stored `false` was left
  untouched**, which is the exact no-silent-regression property. (`Notification.permission` is
  `default` in this headless context, so the seed branch was not reachable here — it is covered by the
  10 unit tests and cannot be reached in headless Chromium without stubbing, the same limitation
  `discovered-IMP-021.md` §1 records for the Enable button.)
- **Console: 0 messages** for the whole session. Preview server stopped; no settings or items were
  changed beyond the marker the migration itself wrote.

## 8. Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run build` OK (`dist/sw.js`, 18 precache
entries, 609.04 KiB) · `npm run test` **258/258**.

**Determinism proof.** 8 consecutive full `npm run test` runs: **8 green, 0 failures** (258/258 each;
the previous verifier measured 6 failures in 11 runs). Additionally, with 4 CPU-burner processes
competing for the machine, the previously flaky file was run 12 more times: **0 failures**.

`prettier --check` passes on both new files and on every file this retry created or rewrote. The three
files the verifier reported as already dirty at HEAD (`delivery.ts`, `delivery.test.ts`,
`ReminderRuntime.tsx`) are untouched by this retry and keep their pre-existing status.

## 9. Bookkeeping

- `FEATURES.md` keeps `### IMP-021 … **Status:** TODO` per instruction; its Notes now record the gate, the
  seed and the UI change so the item's bookkeeping gap is closed without marking it DONE.
- `AGENTS.md` ("Migration from v1") documents `notificationGate.ts` alongside `legacyTasks.ts`, since
  both run from the `App` mount effect.
- `.improve/PROGRESS.log` was left untouched: its one uncommitted line is the IMP-020 entry for commit
  `9361ca1`, which is already in history, so removing it would lose a real record. No IMP-021 line was
  added because nothing is committed yet.
