# discovered-IMP-118 — findings while adding IMP-118/119/120 tests

No genuine source bug was fixed, and no source behavior was changed. Two boundary
observations surfaced while writing the tests. Both are recorded here rather than patched,
per the task instruction.

## 1. Spec mismatch: `statusClasses('todo')` has no `dark:` variant (not a bug)

- **Where:** `src/lib/labels.ts:77-88` (`statusClasses`), specifically the `default` branch.
- **Spec:** `.improve/reports/discover3-quality.md` #11 / FEATURES.md IMP-120 AC-2 says
  "every variant carries a `dark:` class".
- **Reality:** `done`/`doing`/`cancelled` return hard-coded palettes with explicit `dark:`
  overrides, but `todo` returns `'border-border bg-elevated text-muted'`. Those are
  CSS-variable design tokens that already flip with the theme, so a `dark:` override is
  neither present nor needed.
- **Assessment:** the source is correct and consistent with the project's stated styling
  convention (AGENTS.md: "use the semantic Tailwind tokens … never hardcode slate/white;
  that breaks dark mode"). The spec's blanket assertion was wrong. The test was written to
  assert the real, intended behavior (coloured statuses carry `dark:`, `todo` uses the
  theme-aware tokens and has none) rather than a tautology.
- **Action:** none to source. No `dark:` added.

## 2. Latent gap: `sendSkipWaiting` has no rejection handler (not fixed, not tested)

- **Where:** `src/pwa/notifications.ts:55-59`.
- **Code:** `void navigator.serviceWorker.getRegistration().then((registration) => { … })`.
- **Issue:** there is no `.catch`. If `getRegistration()` rejects (e.g. a corrupted SW
  registration or a storage/permission failure), the discarded promise produces an
  unhandled rejection. This is the same failure class as IMP-117 / discover3-quality #8
  (unhandled rejections on blocked storage), but for the SW-update path rather than the
  delivery tick.
- **Assessment:** real but low severity — `sendSkipWaiting` is fire-and-forget from the
  update toast, and the call site cannot observe the failure either way. It is not part of
  IMP-118's acceptance criteria.
- **Action:** none. No test was added, because the only assertion available would enshrine
  the unhandled rejection as expected behavior. A future fix would add `.catch(() => {})`
  (or report through `reportBootFailure`) and then assert a rejected `getRegistration`
  settles without an unhandled rejection.

## 3. Observation: `showAppNotification` does not fall back to the constructor when the registration rejects

- **Where:** `src/pwa/notifications.ts:34-48`.
- **Behavior:** when a registration exists, `registration.showNotification(...)` is awaited
  inside the `try`; if it throws, the `catch` returns `false` and the `new Notification`
  fallback is never attempted.
- **Assessment:** by design ("catch → false", which IMP-118 AC-1 explicitly requires:
  "a throwing API → `false` (never throws)"). Noted only for completeness; not a bug and
  not changed.
