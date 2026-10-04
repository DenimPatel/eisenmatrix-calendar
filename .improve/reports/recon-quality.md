# Recon: Quality & Safety Audit

Repo: `/Users/denimpatel/Desktop/git/eisenmatrix-calendar`
Date: 2026-10-04
Auditor: quality lane (reconnaissance only — no code changes)
Scope: ~9,262 LOC TS/TSX across 74 source files.

---

## 0. Baseline command results (run once, 180s timeout each)

| Command | Result | Output |
| --- | --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** exit 0 | no diagnostics |
| `npm run lint` (`eslint .`) | **PASS** exit 0 | no errors/warnings |
| `npm run test` (`vitest run`) | **PASS** exit 0 | **10 files / 49 tests passed**, 9.47s |

The tree is clean at baseline. Any failure introduced later is a regression.
(`.improve/reports/recon-runbook.md` additionally records `npm run build` PASS.)

---

## 1. Test coverage

### Test files present (10 files, 49 tests, 2,537 lines incl. duplicated wc artifact)

| Test file | Lines | Target |
| --- | --- | --- |
| `src/domain/recurrence.test.ts` | 152 | recurrence engine |
| `src/domain/reminders.test.ts` | 67 | reminder fire-times |
| `src/domain/quickadd.test.ts` | 56 | NL parser |
| `src/db/repository.test.ts` | 93 | Dexie repos |
| `src/db/migrations/legacyTasks.test.ts` | 190 | v1 migration |
| `src/lib/backup.test.ts` | 56 | backup parse/merge |
| `src/lib/csv.test.ts` | 56 | CSV round-trip |
| `src/lib/ics.test.ts` | 50 | ICS export |
| `src/lib/date.test.ts` | 48 | local date helpers |
| `src/test/app.smoke.test.tsx` | 43 | App mount smoke (jsdom) |

Test harness: `vitest.config.ts` (environment `node`, globals, `src/**/*.test.{ts,tsx}`,
PWA register stub); `src/test/setup.ts`; `src/test/pwaRegisterStub.ts`.

### What is well covered
All six "high-risk" modules named in the mission **do** have dedicated tests:
recurrence (`recurrence.test.ts`, incl. month-end clamp, DST, count/until/exceptions/overrides),
reminders, csv (multi-line quoted round-trip), backup, legacy migration (all four v1 key
formats + idempotency), and repository (CRUD, archive, settings, reminder dedupe/prune).
Pure lib helpers `date.ts` and `ics.ts` are tested.

### Biggest coverage gaps (untested, highest risk first)
- **`src/domain/itemActions.ts` (268 LOC) — every mutation path, history recording and undo
  push is untested.** This is the write path for the whole app (`saveItem`, `patchItem`,
  `toggleDone`, `updateRecurring`/`splitSeries`, `deleteItem`).
- **`src/domain/stats.ts` (148 LOC)** — streaks (`habitStreak`, `activeDayStreak`), completion
  rate, goal progress. No tests; bugs here are silent (wrong streaks).
- **`src/domain/eisenhower.ts` (63 LOC)** — quadrant/priority mapping. No tests.
- **`src/domain/itemFactory.ts`** — only exercised indirectly; `normalizeItem` edge cases
  (malformed imports) untested.
- **All React features/UI** — `src/features/**` (Today, Calendar, Matrix, List, Goals, Habits,
  Bills, Shopping, Notes, Settings, ItemEditorSheet, QuickAdd, CommandPalette, AppShell).
  Only one mount smoke test.
- **All hooks** — `useData`, `useOccurrences`, `useKeyboardShortcuts`, `useFocusTrap`, `useTheme`.
- **PWA runtime** — `src/pwa/ReminderRuntime.tsx`, `notifications.ts`, `sw.ts`, `register.ts`
  have **zero** tests, despite driving notification delivery and the 60s loop.
- **No `test:coverage` script, no coverage thresholds**, despite `@vitest/coverage-v8` being a
  devDependency. No CI test job (see §7).

---

## 2. Typing

- **No `any`** type annotations found in source; **no `@ts-ignore` / `@ts-expect-error` /
  `@ts-nocheck`**. `tsconfig.json` is strict (`strict`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`).
- Lint rule `@typescript-eslint/no-explicit-any` is **disabled** (`eslint.config.js:31`), so a
  future `any` would not be caught. Notable given the otherwise-strong typing.
- **Unsound casts / non-null assertions** (candidates for tightening, not current failures):
  - `settingsRepo.get` returns `row.value as T` with no runtime validation — `repository.ts:133`.
  - `as unknown as` double-casts: `itemActions.ts:35` (history field access),
    `csv.ts:112` (items→CSV rows), `notifications.ts:43` (`as unknown as NotificationOptions`).
  - `as Item` final casts in `itemFactory.ts:74,121`, `repository.ts:12`,
    `itemActions.ts:260`, `csv.ts:164`.
  - Non-null assertions in source: `recurrence.ts:293` (`parseLocalDate(fromKey)!`),
    `repository.ts:183` (`b.id!`), `legacyTasks.ts:240` (`b.id!`),
    `stats.ts:47` (`parseLocalDate(item.start)!`).
  - Unsafe `as` on event values in UI (`ItemEditorSheet.tsx:231,241,248`,
    `QuickAdd.tsx:167`, `SettingsView.tsx:180,251`) — bounded by `<select>` options, low risk.
  - `parsed as LegacyTask[]` with no shape validation — `legacyTasks.ts:197`.

---

## 3. Error handling

- **Unhandled promise rejections** (no `.catch` / no try-catch around async side effects):
  - `App.tsx:29` — `void runLegacyMigration();` on first boot. A Dexie/open failure (e.g.
    private mode, blocked upgrade) becomes an unhandled rejection with no user feedback.
  - `SettingsView.tsx:114-124` — `importCSV()` has **no try/catch**, unlike `importJSON()`
    (`:95-111`). `readTextFile`/`itemRepo.createMany` rejection is unhandled.
  - `QuickAdd.tsx:63,77` — `listRepo.create` / `createItemPersisted` inside `commit()` have no
    try/catch; `onClick={() => void commit()}` (`:108`) and Enter handler (`:124`) swallow it.
  - `useKeyboardShortcuts.ts:35` — `void undo().then(...)` no rejection handler.
  - `App.tsx:30` `setupPWA()`, `SettingsView.tsx:55` `backupRepo.all().then(...)`, `:86`
    `createSnapshot`, `:138` `resetAll`, `ReminderRuntime.tsx:135` `itemRepo.get(...).then` —
    all fire-and-forget with no error path.
- **Empty/silent catch blocks** (all intentional fallbacks, but no logging/diagnostics):
  `legacyTasks.ts:198` (`parseLegacyTasks` → `[]`), `csv.ts:119` (`safeJSON` → fallback),
  `notifications.ts:49` (`showAppNotification` → `false`). The notification one is the most
  opaque: every SW/Notification failure is swallowed with no trace.
- **No try/catch around any Dexie transaction** in `repository.ts`; open/upgrade failures are
  not handled anywhere.
- **Fire-and-forget prune** inside a `.then`: `legacyTasks.ts:234-241` calls
  `db.backups.bulkDelete(...)` without `await`, so the promise is detached.
- **Input validation**: import paths (`parseBackup`/`csvToItems` → `normalizeItem` →
  `itemRepo.createMany`) persist imported data with **no schema validation** (see §4).

---

## 4. Security smells

- **No `dangerouslySetInnerHTML`, no `eval` / `new Function`, no `innerHTML`, no
  `document.write` anywhere in source.** No hardcoded credentials in tracked files.
- **Stale secret-shaped artifact**: `.env.local` contains `GEMINI_API_KEY=<placeholder>`
  (35 bytes). It is correctly **untracked and gitignored** via `.gitignore:13` (`*.local`,
  confirmed with `git check-ignore`). No Gemini/AI dependency exists in `package.json` and no
  source references `GEMINI`/`import.meta.env` — a dead artifact. Low risk, but should be
  removed/rotated if the placeholder ever held a real key.
- **Unvalidated imported data into IndexedDB** (highest real safety concern):
  - `parseBackup` (`backup.ts:35-50`) casts JSON, filters items only by
    `i && typeof i === 'object' && 'id' in i`, and casts `lists as List[]` with no validation.
  - `csvToItems` (`csv.ts:124-165`) builds items from arbitrary CSV with no schema checks.
  - `normalizeItem` (`itemFactory.ts:88-121`) spreads `...partial` **after** the sanitized base,
    so malformed fields survive.
  - Downstream assumes shapes without guards: `item.reminders.length` (`reminders.ts:55`),
    `item.reminders` iteration (`ReminderRuntime.tsx`), `rule.exceptions.includes`
    (`recurrence.ts:234`), `rule.overrides[occKey]` (`recurrence.ts:163`). A corrupt or
    hostile backup/CSV can therefore crash the app (DoS) or persist junk.
  - Impact is bounded: local-first, no server, data only enters via user-chosen file.
- **URL handling**: the only navigation is `self.clients.openWindow('./')` (`sw.ts:40`) and
  `downloadFile` object URLs (`backup.ts:97-104`). No user-controlled URLs are opened. No
  `dangerouslySetInnerHTML`, so no XSS sink found.
- **Dependency vulnerabilities** — `npm audit` (network available, run once):
  **12 total: 9 high, 1 moderate, 2 low, 0 critical.** All are in the dev/build toolchain,
  not the shipped runtime bundle:
  - `vite` (path traversal in optimized-deps `.map` handling + dev-server WebSocket arbitrary
    file read + `launch-editor` NTLMv2 on Windows) — HIGH, fix available.
  - `rollup` (arbitrary file write via path traversal) — HIGH, fix available.
  - `tailwindcss` → `chokidar`/`fast-glob`/`micromatch`/`braces`/`picomatch` — HIGH, fix
    requires **major** bump to `tailwindcss@4.3.3` (`isSemVerMajor: true`).
  - `brace-expansion`, `fast-glob`, `picomatch` — HIGH, fix available.
  - `@babel/core` (arbitrary file read via sourceMappingURL) — LOW.
  - `serialize-javascript` (`</script>` XSS) — LOW.
  - `fast-uri` (host case normalization) — MODERATE.
  Prod dependency count: 22; total 648.

---

## 5. Performance hot spots

- **Unbounded full-table reads everywhere.** `useItems()` calls `itemRepo.all()`
  (`useData.ts:6`, `useArchivedItems` `:12`) then filters archived in JS; `SettingsView`
  uses `useItems(true)`. Every view mounts the whole item set via `useLiveQuery`, so any
  write re-renders each subscriber. Fine for a personal dataset, poor at scale.
- **`ReminderRuntime` (`ReminderRuntime.tsx:59-167`)**: `useEffect` depends on the entire
  `items` array, so the 60s `tick` closure is rebuilt and reminders re-expanded on **every**
  item change, plus the `setInterval` every 60s. `upcomingReminders` (`reminders.ts:48`) loops
  all non-archived items and expands occurrences synchronously. The digest additionally
  expands each item over a 30-day overdue window on every tick (`:99-107`).
- **`repository.ts` bulk-read-then-slice**: `backupRepo.latest()` (`:173-176`) and `prune()`
  (`:180-183`) load **all** backups (`orderBy('createdAt').reverse().toArray()`) just to take
  `[0]` / `slice(keep)`. Same pattern in `legacyTasks.ts:234-241`.
- **`query(predicate)` (`repository.ts:78-80`)** is a full-table `.filter()` scan by design.
- **`habitStreak` (`stats.ts:42-96`)** calls `expandOccurrences` from `item.start` (up to ~12
  months back) on every habit toggle (`itemActions.ts:179`).
- **`nextOccurrence` (`recurrence.ts:252-257`)** defaults to a 3,660-day window; the generator
  is bounded by `MAX_ITERATIONS = 200_000` (`:16`) — safe but can be thousands of iterations.
- `useSetting` deps use `JSON.stringify(fallback)` (`useData.ts:38`); stable only while the
  fallback object identity/data is stable.
- **Correctness bug adjacent to performance**: `removeWithChildren` (`repository.ts:58-64`)
  filters only **direct** children (`i.parentId === id`), not deep descendants, despite the
  name. Nested subtasks are orphaned on parent delete. Undo (`itemActions.ts:108-110`) only
  restores the parent, compounding the leak.

---

## 6. Dependency health

All 13 runtime deps are actually used in source except one:

- `@dnd-kit/core` — `ItemCard.tsx:2`, `AppShell.tsx:13`, `Droppable.tsx:2`. Used.
- `@dnd-kit/sortable` — `AppShell.tsx:14`. Used.
- **`@dnd-kit/utilities` — NOT directly imported in `src/`; referenced only in
  `vite.config.ts:67` manualChunks.** It is a transitive dep of core/sortable, so the direct
  dependency is effectively unused. Low.
- `clsx` + `tailwind-merge` — `lib/cn.ts`. `date-fns` — `lib/date.ts`, `domain/recurrence.ts`.
  `dexie` — `db/schema.ts`; `dexie-react-hooks` — `hooks/useData.ts`. `lucide-react` — 21 files.
  `react`/`react-dom` — entry; `react-router-dom` — `App.tsx`, hooks, shell. `zustand` — store.
- **Major-version risk**: `tailwindcss@^3.4.19` — audit's fix path is the v4 major (breaking
  config/PostCSS changes). `eslint@9`, `react@19`, `vite@6` are current majors. `@dnd-kit/sortable@10`
  pairs with core 6.
- `build` runs `tsc --noEmit && vite build` (good); CI uses `npm install`, not `npm ci`
  (lockfile drift allowed).

---

## 7. CI

`.github/workflows/deploy.yml` (only workflow):

- Triggers: **`push: branches: [main]`** and **`workflow_dispatch`**. **No `pull_request`
  trigger.**
- Jobs: `build` (ubuntu-latest, Node 20, `actions/checkout@v4`, `setup-node@v4` with npm cache,
  `npm install`, `npm run build`, upload `./dist`) → `deploy` (GitHub Pages). Permissions scoped
  (`contents: read`, `pages: write`, `id-token: write`).

### Gaps
1. **No test/lint/typecheck job.** `npm run build` only runs `tsc --noEmit`; `eslint` and
   `vitest` never run in CI. Broken tests/lint can merge and deploy.
2. **No PR validation at all** — nothing runs until code reaches `main`.
3. `npm install` instead of `npm ci` — does not enforce the committed `package-lock.json`.
4. No `npm audit` / Dependabot / dependency-review step despite 9 high advisories.
5. No coverage reporting or threshold gate despite the coverage dependency.
6. Single Node version (20); no matrix. No `concurrency` group (overlapping deploys).
7. Cache key derived only from lockfile via `setup-node` default (acceptable, minor).

---

## Top findings (severity-ranked)

| # | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | High | CI never runs lint/test/typecheck and has no PR trigger; broken code can merge and deploy | `.github/workflows/deploy.yml:3-6,29-30` |
| 2 | High | 9 high / 1 moderate / 2 low dependency advisories, all dev-toolchain (vite, rollup, tailwind chain, picomatch); tailwind fix is a major bump | `npm audit` |
| 3 | High | Imported JSON/CSV is persisted with no schema validation, and downstream assumes array/object shapes → corrupt import can crash app | `backup.ts:35-50`, `csv.ts:124-165`, `itemFactory.ts:108-121`, `reminders.ts:55`, `recurrence.ts:163,234` |
| 4 | Med-High | Unhandled promise rejections on boot, CSV import, quick-add commit and undo | `App.tsx:29`, `SettingsView.tsx:114-124`, `QuickAdd.tsx:63,77`, `useKeyboardShortcuts.ts:35` |
| 5 | Med | `removeWithChildren` deletes only direct children, orphaning deep subtasks on delete | `repository.ts:58-64` |
| 6 | Med | Zero tests for `itemActions` (all writes/undo), `stats`, `eisenhower`, hooks and PWA runtime; no coverage gate | see §1 |
| 7 | Low-Med | Full-table `itemRepo.all()` reads + ReminderRuntime effect re-running on every items change; backup latest/prune load all rows | `useData.ts:6,12`, `ReminderRuntime.tsx:59-167`, `repository.ts:173-183` |
| 8 | Low | Stale `GEMINI_API_KEY` placeholder in gitignored-but-present `.env.local`; `@dnd-kit/utilities` direct dep unused; `showAppNotification` swallows all errors | `.env.local`, `package.json:19` vs `src/`, `notifications.ts:49` |
