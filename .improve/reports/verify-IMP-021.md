# IMP-021 — Independent verification report (re-verification, attempt 2)

**Verdict: PASS** — all four blocking issues from the previous FAIL report are genuinely fixed, the
new test file is deterministic (20/20 consecutive green runs, including under load), the migration
is correct and idempotent, all four gates are green, all six mutations are caught, and the live
browser confirms the single control, non-overclaiming copy, and reload-free toggling.

Reviewer: independent verifier (did not write the change). No commit made; only this report added.

---

## 1. Previous issues → genuinely fixed

### 1.1 `src/pwa/ReminderRuntime.test.tsx` flakiness — FIXED

The file now polls the observable **gate boolean** (`deliver(…, { notifyEnabled })`) instead of
asserting on `Date.now()` / setInterval firing order, and waits on the live-query rebuild rather
than sleeping.

| Run type | Command | Result |
| --- | --- | --- |
| Full suite × 8, consecutive | `npm run test` (loop) | **8/8 green, 258/258 each** |
| File in isolation × 12, under CPU load (6 spinners) | `npx vitest run src/pwa/ReminderRuntime.test.tsx` | **12/12 green, 2 passed each** |

Total: **20/20 consecutive green runs of that file**, zero failures. Durations 8.18–9.73 s, no
timeout pressure. Previous report measured ~55 % flake; not reproducible.

### 1.2 Backward-compat migration — FIXED

`src/db/migrations/notificationGate.ts` (79 lines) satisfies every stated property. Verified
**independently of the author's tests** with a throwaway probe suite
(`src/db/migrations/zz-verify-probe.test.ts`, 5 assertions, run then deleted):

| Property | Probe | Result |
| --- | --- | --- |
| Seeds `true` exactly once when key absent + permission granted | 1st run → `seeded`, value `true`; 2nd run → `already-migrated`, stored `app` row byte-identical to snapshot | PASS |
| Never overrides an explicit stored `false`, even with granted permission | stored `false` + granted → `already-decided`, value stays `false` | PASS |
| Leaves a permission-less install unmarked so a later grant is still picked up | run with `permission: 'default'` → `permission-not-granted`, no `app` row written, **no marker**; next run with `granted` → `seeded`, value `true` | PASS |
| Idempotency (running twice changes nothing) | covered by rows 1 and 3 above; marker guard + `already-decided` both engage | PASS |
| A later opt-out is never re-enabled even if the marker is force-deleted | marker deleted + granted → `already-decided`, `false` preserved | PASS |
| Unknown sibling keys survive the seed write | `futureFlag: 42` preserved, `notificationsEnabled` set | PASS |

Author suite `src/db/migrations/notificationGate.test.ts` (10 tests) remains meaningful and passes.

One probe assertion of mine failed on first write — I had seeded the fixture with
`{...DEFAULT_SETTINGS, futureFlag: 42}`, which *includes* `notificationsEnabled: false`, so the
key-present guard correctly declined. My probe was wrong, not the code; corrected probe: 5 passed.

### 1.3 Migration invoked at boot — CONFIRMED

- Code: `src/App.tsx` imports `runNotificationGateMigration` and calls it in the same mount effect
  as `runLegacyMigration`, wrapped in a try/catch.
- **Live browser proof**: with the marker deleted and `notificationsEnabled` removed from the `app`
  row, a reload with `Notification.permission === 'default'` left IndexedDB with **no**
  `migration.notificationGate` row and **no** `notificationsEnabled` key — i.e. the boot migration
  ran and deliberately took the `permission-not-granted` branch. With an explicit stored `false`,
  the same boot run wrote the marker `{version:1}` and left the value at `false`
  (`already-decided`).

### 1.4 Settings: one coherent control, no overclaim — CONFIRMED

Accessibility snapshot of `#/settings` shows **exactly one** `switch` named "Device notifications"
plus the pre-existing "Daily digest" switch. The "Enable" button is gone. Copy reads:
*"Permission: … While this app is open, reminders and the digest show as in-app banners; this
switch controls device notifications only. If the permission prompt was blocked, re-allow
notifications for this site in your browser's site settings. Without a push server, background
delivery depends on your OS and is best-effort."* — no "always appear", no "always work", no
background guarantee. `expect(host.textContent).not.toContain('Enable')` and the two negative-copy
assertions back this up.

---

## 2. AC1–AC3 still hold

| AC | Result | Evidence |
| --- | --- | --- |
| **AC1** setting gates only the device-notification arm; toasts + digest untouched | PASS | `src/pwa/delivery.ts:80` is the only gated statement; the toast + `reminderLogRepo.record` fallthrough at `:88–92` is unconditional, and `deliverDigest` spreads `...options` (`:125`). `delivery.test.ts` "notificationsEnabled gate" suite: gate off ⇒ `show` not called, toast delivered, row recorded; digest gate off ⇒ toast only. **Live:** gate off ⇒ 0 device notifications, toast "Daily digest — 3 scheduled today · 5 overdue · 1 habits" rendered. |
| **AC2** delivery still works with the setting true + permission granted | PASS | Live: `notificationsEnabled: true`, permission `granted` ⇒ exactly **1** device notification (`"Your day at a glance"`, tag `__digest__`) and **no** toast. Also 4 `delivery.test.ts` tests exercising the notification arm with `notifyEnabled: true`. |
| **AC3** fail-closed default | PASS | `src/types/settings.ts:30` `notificationsEnabled: false`; `src/pwa/delivery.ts:73` `notifyEnabled = false` (a caller that omits it gets "off"); test *"treats a caller that passes no gate as notifications off"*. |

---

## 3. No regression

- Full suite: **29 files / 258 tests pass**. `delivery.test.ts` grew from 13 to 22 tests; every
  pre-existing notification-arm test was updated to pass `notifyEnabled: true`, so it still
  tests the arm it was written for rather than silently becoming a toast test.
- `notificationGate.test.ts` (10) and the migration behaviour are unchanged in substance.
- Live end-to-end: gate ON ⇒ device notification; gate OFF ⇒ in-app toast; both without a page
  reload (`performance.getEntriesByType('navigation').length === 1` throughout).

---

## 4. `git diff` review — scope, style, leftovers, secrets

`git diff --stat`: 3 source files changed (`App.tsx`, `SettingsView.tsx` + test, `ReminderRuntime.tsx`,
`delivery.ts` + test, `types/settings.ts`) plus `agents.md`, `.improve/FEATURES.md`,
`.improve/PROGRESS.log`. Untracked: `notificationGate.ts` (79), `notificationGate.test.ts` (128),
`ReminderRuntime.test.tsx` (149), plus the three IMP-021 reports. Every line traces to the
stated scope or the workflow's report/log files.

- **No scope creep.** The new migration file is in scope.
- **No unrelated changes.** The only non-`src` edits are the two prescribed doc-truth updates and
  the two prescribed workflow logs.
- **Style**: `npx prettier --check src/db/migrations/notificationGate.ts` → `Checking formatting…
  All matched files use Prettier code style!` `agents.md` is a single tracked file named in
  lowercase (`git ls-files` confirms), so the doc edit is the same file loaded as project context.
  Semantic Tailwind tokens only; grep for `slate-|gray-[0-9]|bg-white|text-black|z-\[` in the diff
  and in the three new files: **no matches**.
- **No debug leftovers**: no `debugger`, no `console.log`, no `.only(`/`.skip(` anywhere in `src`
  (`grep -rnE "\.(skip|only)\("` → none). The single added `console.warn` (`App.tsx:59`) is a real
  failure-reporting path for a failed migration, not debug output.
- **No secrets**: grep for `api_key|secret|token|password|bearer|sk-[A-Za-z0-9]{10,}` over the diff
  → none.

---

## 5. Gates

```
npm run typecheck   → exit 0 (tsc --noEmit, no output)
npm run lint        → exit 0 (eslint ., no output)
npm run test        → Test Files 29 passed (29) · Tests 258 passed (258)
npm run build       → 53 modules transformed · dist/sw.js generated · 18 precache entries
```

---

## 6. Mutation check — every mutation is caught

| # | Mutation | Command | Result |
| --- | --- | --- | --- |
| M1 | Ungated notification arm — `if (notifyEnabled && (await show(...)))` → `if (await show(...))` | `npx vitest run src/pwa/delivery.test.ts` | **4 failed / 9 passed** — CAUGHT |
| M2 | Fail-open default — `notifyEnabled = false` → `true` | `npx vitest run src/pwa/delivery.test.ts` | **1 failed / 12 passed** — CAUGHT |
| M3 | Drop `notifyEnabled` from the effect deps | `npx vitest run src/pwa/ReminderRuntime.test.tsx` | **2 failed / 2** — CAUGHT |
| M4 | Drop the "already decided" (key-presence) guard | `npx vitest run src/db/migrations/notificationGate.test.ts` | **2 failed / 8 passed** — CAUGHT |
| M5 | Drop the permission check (seed regardless of permission) | same | **5 failed / 5 passed** — CAUGHT |
| M6 | Drop the once-only marker guard | same | **1 failed / 9 passed** — CAUGHT |

All six sources were restored from backups afterwards; `diff /tmp/ng.bak
src/db/migrations/notificationGate.ts` → identical, and `git diff --stat` for the three sources
matches the pre-mutation state exactly.

---

## 7. Visual verification (Playwright, `vite preview` on :4173)

Screenshots: `.improve/artifacts/IMP-021/`

- `05-verify2-single-control-OFF.png` — single Device notifications switch (off), no "Enable"
  button, corrected copy.
- `06-verify2-gate-OFF-toast-fallback.png` — gate off: 0 device notifications, digest delivered as
  the in-app toast (visible bottom-right), Daily digest switch independent and on.

Sequence observed:

1. Boot with `permission: 'default'`, key absent, marker absent → migration wrote nothing
   (permission-less install left unmarked).
2. Clicked the switch with `requestPermission` stubbed to `granted` → `aria-checked=true`,
   `notificationsEnabled: true` persisted, permission line updated to "granted", **no reload**.
3. Gate ON + permission granted, digest window forced → **1** device notification
   (`"Your day at a glance"`), no toast.
4. Clicked the switch off → gate OFF, digest re-fired → **0** device notifications, toast
   `"Daily digest — 3 scheduled today · 5 overdue · 1 habits"` in the `aria-live` region.

`playwright_browser_console_messages` returned **zero messages of any severity** for the entire
session (navigation, reload, both toggles, both digest firings). The service worker was
unregistered and `workbox-precache-v2-…` deleted before the screenshots, so the artifacts reflect
the freshly built bundle, not a stale precache.

Local data was restored to its pre-verification state
(`digestEnabled: false`, `digestTime: '08:00'`, `notificationsEnabled: false`); the temp `.playwright-mcp/`
directory was removed.

---

## 8. Remaining observations (non-blocking)

1. `grep -o 'setInterval'` shows the app also schedules a 60 s interval in `Hooks.tsx`
   (`src/pwa/Hooks.tsx:22`) and a 30 s one in `useKeyboardShortcuts.ts`. Neither is seeded with
   `vi.useFakeTimers`, so neither can affect this file. No test-fidelity concern; noted only
   because the file installs its own fake timers.
2. `useSetting` (and `useItems`) do not see raw IndexedDB writes made outside Dexie — a
   pre-existing limitation I hit while scripting the browser check. This is why the live checks
   toggle through the real UI (which routes through `settingsRepo.patch`) rather than writing the
   row directly. Out of scope for IMP-021.
3. `src/pwa/delivery.test.ts` ends without a trailing newline. Pre-existing, and `npm run lint`
   passes; noted for tidiness only.

No blocking issues.