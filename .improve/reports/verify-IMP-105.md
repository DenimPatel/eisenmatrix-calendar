# verify-IMP-105 — Independent verification of IMP-104 / IMP-105 / IMP-107

Reviewer: independent skeptical pass. Read-only on `src`; no source modified.
Impl under review: `.improve/reports/impl-IMP-105.md`, working-tree diff (`git status` shows
`src/App.tsx`, `src/lib/bootFailure.ts`, `SettingsView.tsx`, the four `*View.tsx` headers, and
the test files; new `headerCta.test.tsx`, `test/appBootFailure.test.tsx`). Build was clean.

## Gates (all four, on the reviewed tree)

| Gate | Command | Result |
| ---- | ------- | ------ |
| Typecheck | `npm run typecheck` | PASS (exit 0) |
| Lint | `npm run lint` | PASS (exit 0) |
| Tests | `npm run test` | PASS — 54 files, 575 tests |
| Format | `npm run format:check` | PASS |

Browser: `npm run build` → `npm run preview` (4173); service worker unregistered and all caches
deleted in-page, `about:blank` round-trip to force a real document load. Server stopped after.

---

## IMP-104 — digest time input (V4)

Source: `SettingsView.tsx` `w-28` → `w-36`; `aria-label="Daily digest time"` unchanged.

Independent measurements of the `input[type="time"]`:

| Viewport / theme | class | clientWidth | scrollWidth | rect width | fits |
| ---------------- | ----- | ----------- | ----------- | ---------- | ---- |
| 390 light | `input w-36` | 142 | 142 | 144 | yes |
| 390 dark  | `input w-36` | 142 | 142 | 144 | yes |
| 1280 dark | `input w-36` | 142 | 142 | 144 | yes |

- 390 light screenshot: `08:00 AM` renders in full, clock icon clear of the text.
- 390 dark screenshot: same, no overlap.
- **Defect reproduction:** forcing the box back to 112 px (inline, runtime only) renders
  `08:00 A` with the clock icon over the clipped `M` — the original defect is real and the
  `w-36` change resolves it.
- Accessible name present (`Daily digest time`), satisfying criterion 2.
- No page-level horizontal overflow (`documentElement.scrollWidth === viewport` at 390 and 1280).

Artifacts: `.improve/artifacts/IMP-105/verify-digest-390-{light,dark}.png`,
`verify-digest-390-forced-w28.png`, `verify-digest-390-de24h-light.png`.

**Weakness (verification method, not the fix):** `scrollWidth <= clientWidth` — the method
named in the criteria and used by the impl — is **not** a valid probe for this control: it
reads `142 == 142` both with the fix **and** with the clipped 112 px box. The genuine evidence
is the screenshot and the `rectW`/class, not the scroll metric. The unit test only asserts the
class string (`not w-28`, matches `/\bw-3[2-9]\b/`), which is a class-string assertion, not a
rendered-width check. Behaviour is nevertheless correct.

**24h locale:** a `de-DE` context (`playwright_browser_run_code_unsafe`, `locale: 'de-DE'`)
still rendered `08:00 AM` because Chromium's time-control UI language is the browser UI locale,
not the JS context locale, and cannot be changed per-context here. 24h renders strictly fewer
glyphs (`HH:mm`, no meridiem) in the same 144 px box, so it fits by construction; this is
reasoned, not empirically rendered.

Verdict: **PASS**.

## IMP-105 — header CTAs on one line (V5)

Measured across Goals / Bills / Habits / Notes at 360, 390, 768, 1280. All four headers are
`flex flex-wrap items-center justify-between gap-3`; CTAs carry `whitespace-nowrap`. CTA label
line-rect count (1 = single line), button box, and page overflow:

| View | 360 | 390 | 768 | 1280 |
| ---- | --- | --- | --- | ---- |
| Goals — New goal | 1 line, 95×32, own row | 1 line, 95×32, own row | 1 line, 95×32, same row | 1 line, 95×32, same row |
| Bills — New bill | 1 line, 88×32, own row | 1 line, 88×32, own row | 1 line, 88×32, same row | 1 line, 88×32, same row |
| Habits — New habit | 1 line, 100×32, same row | 1 line, 100×32, same row | 1 line, 100×32, same row | 1 line, 100×32, same row |
| Notes — Add note (capture card) | 1 line, 94×32 | 1 line, 94×32 | 1 line | 1 line |

- `documentElement.scrollWidth === viewport` at every combination — no horizontal overflow.
- Title + CTA share one row at 768/1280; at 360/390 Goals and Bills correctly wrap the CTA to
  its own row instead of squeezing it (that is the intended fix, not a regression).
- **Defect reproduction:** removing `flex-wrap` and `whitespace-nowrap` from the Goals header at
  390 px makes `New goal` wrap to **2** lines and shrink to 78 px (from 95). The guard is doing
  the work.

Notes has no header CTA; the impl applied the guard to the capture-card `Add note` button and
still added `flex-wrap`/`gap-3` to the Notes header. The criterion's literal wording ("Notes
headers") is not applicable since that header has no CTA — acceptable, but the Notes test's CTA
lookup scans the whole host, so its "one-line" guarantee is on the capture card, not the header.

**Weakness:** `headerCta.test.tsx` asserts only class strings (`flex-wrap`, `gap-3`,
`whitespace-nowrap`). Such tests would still pass under a conflicting override (e.g. an added
`flex-nowrap`, or a width class that clamps the button) and assert no rendered line count or
overflow. The independent browser measurement above is what actually establishes the behaviour.

Verdict: **PASS**.

## IMP-107 — boot failure toast names the database (U4)

Reproduced the U4 scenario in a fresh context with `window.indexedDB` forced to `undefined`
while `localStorage` works (`ls-probe` round-trips to `1`). Toasts rendered:

1. `The local database is unavailable — changes may not be saved.` ← new (ensureDbOpen path) ✔
2. `Data migration failed — some items may be missing.`
3. `Local storage is unavailable — changes may not be saved.` ← **still present**
4. `Notification settings could not be restored.`

- Criterion 1 (a database-open failure produces a database-naming message): **met** for the
  `ensureDbOpen()` call site — `App.tsx:49` now reports `DATABASE_UNAVAILABLE_MESSAGE`.
- Criterion 2 (the message is shown only when persistence is genuinely unavailable / names the
  right API): **not fully met.** The misleading "Local storage is unavailable" toast still fires
  from `useTheme.ts:20`/`:39`, whose `settingsRepo.get/merge` are **Dexie/IndexedDB** operations,
  not `localStorage`. This is exactly the U4 symptom the item set out to remove: a user with
  blocked IndexedDB and working localStorage is still told to fix "local storage". The impl
  report's justification ("that path really is localStorage") is **factually wrong** —
  `settingsRepo` is the IndexedDB seam. `grep` confirms `useTheme.ts` is the only remaining
  `STORAGE_UNAVAILABLE_MESSAGE` call site.
- Criterion 3 (copy asserted by a test on the call sites): **partially met.** `appBootFailure.test.tsx`
  genuinely mounts `App` and asserts the `ensureDbOpen` call site — good. But the added case in
  `bootFailure.test.ts` is tautological: it calls `reportBootFailure(DATABASE_UNAVAILABLE_MESSAGE, …)`
  and asserts the resulting toast equals `DATABASE_UNAVAILABLE_MESSAGE`, i.e. it tests the
  constant against itself, not any call site. No test covers the `useTheme` call site.

Verdict: **PARTIAL** — the primary toast is corrected, but the original misleading
"Local storage is unavailable" toast persists in the same scenario, and the residual call-site
justification is inaccurate.

---

## Summary

| Item | Verdict | Notes |
| ---- | ------- | ----- |
| IMP-104 | PASS | Fix real and effective; `scrollWidth` probe is invalid, class-string test weak; 24h only reasoned. |
| IMP-105 | PASS | All four views, four widths, one line, no overflow; pre-fix defect reproduced; tests are class-string only. |
| IMP-107 | PARTIAL | `ensureDbOpen` message fixed; `useTheme` still emits "Local storage is unavailable" for an IndexedDB failure (U4 symptom survives); one tautological test. |

Gates all green. No source modified by this review.
