# Verify IMP-042 — Surface swallowed errors instead of failing silently

Independent skeptical review. Source not modified. Reviewed working-tree diff (nothing committed).

## Verdict

**PASS (with minor issues).** The change does what it claims: previously-empty catches that
swallowed user-impacting failures now leave a trace, and the two data-loss paths raise a
deduped toast. All four gates plus the production build pass. No import cycle. One real
layering inversion (db -> UI store) and a few minor caveats below.

## Diff vs criteria

| Criterion | Result |
| --- | --- |
| Empty catches now trace | Met for notifications.ts, csv.ts `safeJSON`, legacyTasks.ts `parseLegacyTasks`, ReminderRuntime.tsx (4). `lazyRoute.ts` (4) intentionally left. |
| User-impacting losses surfaced via toast | Met: `safeJSON`, `parseLegacyTasks` (both branches). `showAppNotification` trace-only by design. |
| Deduped, no spam | Met: module-level `Set` keyed by message; console traces every call, toast once. |
| User-facing behavior otherwise unchanged | Met except the two deliberate data-loss toasts (documented deviation). |
| Tests | Met: new `reportFailure.test.ts` (3) + assertions in csv/legacyTasks/notifications tests. |

## Layering / import-cycle check (the question asked)

`src/db/migrations/legacyTasks.ts:4` imports `@/lib/reportFailure`, which imports
`@/store/useUiStore` (`src/lib/reportFailure.ts:1`). So the **db layer now transitively depends
on the UI/session store** — a layering inversion. The architecture section says `src/db/` is the
seam a future `SyncAdapter` plugs into; a headless migration/sync path now pulls Zustand and the
toast store.

**No import cycle.** `useUiStore` imports only `zustand`, `@/types` (type-only re-exports;
`item.ts` uses `import type`), and `@/lib/id` (no imports). Nothing in that graph reaches `db`,
so `db -> lib -> store` terminates. Verified by reading the full import graph.

Minor: `reportFailure` and the pre-existing `reportBootFailure` (`src/lib/bootFailure.ts`)
implement the same dedupe+toast pattern with separate `Set`s; they could be unified. Not a
correctness problem.

## Toast dedupe correctness

Correct. Dedupe key is the message string; the toast is emitted at most once per distinct
message per session; `resetReportedFailures()` exists for test isolation. A CSV import with many
malformed fields therefore yields one toast, not one per field. The `toast: false` paths
(notifications, all four ReminderRuntime sites) never enter the `reported` set, so they cannot
suppress or trigger a toast.

## No toast loops during boot

Verified. All ReminderRuntime boot/tick paths (prune, undelivered count, delivery tick,
notificationclick) pass `{ toast: false }`, so the 60s tick cannot re-toast. `reportFailure` is
only ever called from `catch`/effect/callback bodies, never during render, so it cannot drive a
render->effect->toast loop. `runLegacyMigration` runs in a `useEffect([])` (App.tsx:106), once
per mount; a corrupt payload still marks the migration complete (per the impl report), so it is
not retried within the session. At most one toast per boot.

## PII-free logging claim

**Partially true.** The toast messages are static and PII-free, and `reportFailure.test.ts`
asserts the toast JSON never contains the error text. However `reportFailure` logs the raw
`error` object to `console[level]`, so the *console trace* is only PII-free if the error's own
message/serialization is. I checked the main concern — `JSON.parse` errors can embed an input
snippet in newer V8 — and on this machine (Node v24 / V8 13.6) the messages are position-only
("Expected property name or '}' in JSON at position 1"), no snippet, so no imported field
content leaks today. It is not guaranteed for arbitrary errors; the doc wording ("short,
PII-free console trace") overstates what the code enforces.

## Remaining empty catches (grep)

- `src/lib/lazyRoute.ts:15,24,42,52` — 4 empty catches. The report calls them "sessionStorage
  feature probes"; two are actually writes/removes (`setItem`/`removeItem` of the reload flag),
  not probes. All are genuinely benign (private mode / embedded webview) with no user-facing
  loss, so leaving them is defensible, but the description is slightly inaccurate.
- `src/features/settings/SettingsView.tsx:178` — `.catch(() => undefined)` while restoring the
  legacy-migration marker after a failed re-run. An uncovered swallow, though intentional (it
  must not mask the original error already toasted at line 180). Minor.

No other empty or trivial catches in `src` (excluding tests).

## Gates

`npm run typecheck` clean · `npm run lint` clean · `npm run format:check` clean ·
`npm run test` 699 passed / 70 files · `npm run build` succeeds (PWA sw generated, 28 precache
entries).

## Issues summary

1. **Layering inversion (real):** `db/migrations/legacyTasks.ts` -> `lib/reportFailure` ->
   `store/useUiStore`; db now depends on the UI store. No cycle. Consider injecting a reporter
   or keeping the toast emission in the caller/UI layer.
2. **"PII-free" is not enforced:** the raw error is logged; only the toast is guaranteed clean.
3. **Description drift:** lazyRoute's 4 catches are not all "probes"; one `SettingsView` swallow
   (line 178) is uncovered.
4. **Duplication:** `reportFailure` vs `reportBootFailure` share a pattern with separate dedupe
   sets.
