# Recon: Architect

**Repo:** `eisenmatrix-calendar` · **Root:** `/Users/denimpatel/Desktop/git/eisenmatrix-calendar`
**Date:** 2026-10-04 · **Base SHA:** b9d23246b948187c0239e8c95373e3e1f27cc43f
**Mission:** Map the architecture, data flow, entry points, public surfaces, feature ownership and architectural seams/inconsistencies.

---

## 1. What the app is

A **static, local-first SPA / installable PWA**. React 19 + TypeScript (strict) + Vite 6, Tailwind with CSS-variable tokens, Dexie 4 (IndexedDB) persistence via `dexie-react-hooks`, Zustand session state, `react-router-dom` v7 `HashRouter`, `@dnd-kit` for drag/drop, `date-fns`, `vite-plugin-pwa` (`injectManifest`). No backend; export via JSON/CSV/ICS.

Everything is one unified `Item` entity (discriminated union on `kind`) so a single recurrence engine and a single reminder engine serve every feature. See `src/types/item.ts:116`.

---

## 2. Entry points

| Entry | File | Role |
|---|---|---|
| HTML shell | `index.html` (repo root) | mounts `#root` |
| React entry | `src/main.tsx:11` | `createRoot(...).render(<App/>)` in `StrictMode` |
| App shell | `src/App.tsx:24` | `HashRouter`, route table, global overlays, one-shot `runLegacyMigration()` + `setupPWA()` on mount (`:27-31`) |
| Theme bootstrap | `src/hooks/useTheme.ts` | loads/persists theme, toggles `html.dark` |
| Service worker | `src/pwa/sw.ts` | `injectManifest` worker, excluded from `tsc` (webworker lib) |
| DB handle | `src/db/schema.ts:45` `getDb()` | lazy singleton; `db` exported at `:54` |

---

## 3. Module / component map

### Core layers (dependency direction: features → domain/hooks → db → types; lib is leaf)

| Module | Responsibility | Key files |
|---|---|---|
| `src/types/` | Unified `Item` discriminated union, `RecurrenceRule`, `OccurrenceState`, `List`, `AppSettings`, `Occurrence` | `item.ts`, `recurrence.ts`, `list.ts`, `settings.ts`, `index.ts` |
| `src/lib/` | Pure leaf utilities: local-date helpers, ids, labels, `cn`, CSV/ICS/backup codecs | `date.ts`, `id.ts`, `labels.ts`, `cn.ts`, `csv.ts`, `ics.ts`, `backup.ts` |
| `src/db/` | **Only** module touching Dexie. Versioned schema + repositories (the future sync seam) | `schema.ts`, `repository.ts`, `migrations/legacyTasks.ts`, `sync/SyncAdapter.ts` |
| `src/domain/` | Pure business logic: recurrence expansion, reminders, stats/streaks, quick-add parser, Eisenhower mapping, item factory, persistence actions | `recurrence.ts`, `reminders.ts`, `stats.ts`, `quickadd.ts`, `eisenhower.ts`, `itemFactory.ts`, `itemActions.ts` |
| `src/hooks/` | Reactive read wrappers + browser hooks | `useData.ts`, `useOccurrences.ts`, `useTheme.ts`, `useKeyboardShortcuts.ts`, `useFocusTrap.ts` |
| `src/store/` | Zustand UI/session state: theme, filters, editor, toasts, undo stack | `useUiStore.ts` |
| `src/components/ui/` | Reusable primitives (no domain logic) | `Button`, `Dialog`, `Sheet`, `Tabs`, `Form`, `Badge`, `ProgressRing`, `EmptyState`, `ToastHost` |
| `src/pwa/` | Service-worker registration, notification delivery, reminder runtime | `register.ts`, `notifications.ts`, `ReminderRuntime.tsx`, `sw.ts` |
| `src/features/` | One folder per route/feature + shared item/shell components | see below |

### Features and the files that own them

| Feature | Route | Owner files | Notes |
|---|---|---|---|
| Today (dashboard) | `/today` | `features/today/TodayView.tsx` | agenda, overdue, habits, bills, goals, "what's next" |
| Calendar | `/calendar` | `features/calendar/CalendarView.tsx` | day/week/month/year; drag-to-day |
| Matrix | `/matrix` | `features/matrix/MatrixView.tsx` | 4 quadrants, drag to reprioritise |
| Lists | `/lists` | `features/list/ListView.tsx` | filtering, sorting, bulk ops, list CRUD |
| Goals | `/goals` | `features/goals/GoalsView.tsx` | metric progress + milestones (`parentId`) |
| Habits | `/habits` | `features/habits/HabitsView.tsx` | 12-week heatmap + streaks |
| Bills | `/bills` | `features/bills/BillsView.tsx` | occurrence payments, month totals |
| Shopping | `/shopping` | `features/shopping/ShoppingView.tsx` | aisle grouping, purchased toggle |
| Notes | `/notes` | `features/notes/NotesView.tsx` | pin, quick capture |
| Settings | `/settings` | `features/settings/SettingsView.tsx` | theme, notifications, export/import/backup, reset, migration re-run |
| Item editing (shared) | overlay | `features/item/ItemEditorSheet.tsx` + `KindFields.tsx`, `RecurrenceEditor.tsx`, `ReminderEditor.tsx`, `ItemCard.tsx`, `kindMeta.ts` | tabs: details/schedule/analytics/history; recurrence scope picker |
| Quick add | overlay | `features/quickadd/QuickAdd.tsx` | NL parse → editable chips |
| Command palette | overlay | `features/command/CommandPalette.tsx` | nav, create, theme, item jump |
| Shell | layout | `features/shell/AppShell.tsx`, `nav.ts`, `Droppable.tsx`, `dnd.ts`, `ShortcutSheet.tsx` | nav rail + mobile nav, global `DndContext`, shortcut sheet |
| Reminders runtime | overlay | `pwa/ReminderRuntime.tsx` | fires on load/visibility/60s tick; records `reminderLog` |

Route table: `src/App.tsx:36-49` (`/` and `*` redirect to `/today`). Nav + shortcuts: `src/features/shell/nav.ts:22`.

---

## 4. Public surfaces

### UI routes/views
`/today`, `/calendar`, `/matrix`, `/lists`, `/goals`, `/habits`, `/bills`, `/shopping`, `/notes`, `/settings`; redirect `/* → /today`.
Global overlays mounted in `App.tsx:52-57`: `ItemEditorSheet`, `QuickAdd`, `CommandPalette`, `ShortcutSheet`, `ReminderRuntime`, `ToastHost`.

### Exported programmatic APIs (by module)
- **Domain:** `expandOccurrences`, `nextOccurrence`, `splitSeries`, `isItemActiveOnDate` (`recurrence.ts`); `reminderFireTime`, `upcomingReminders` (`reminders.ts`); `habitStreak`, `goalProgress`, `completionStats`, `activeDayStreak`, `overallCompletion` (`stats.ts`); `parseQuickAdd`, `quickAddToItem` (`quickadd.ts`); `quadrantOf`, `priorityScore`, `itemsInQuadrant`, `QUADRANTS` (`eisenhower.ts`); `createItem`, `normalizeItem`, `defaultDataFor` (`itemFactory.ts`); `createItemPersisted`, `saveItem`, `patchItem`, `deleteItem`, `setStatus`, `toggleDone`, `updateRecurring`, `skipOccurrence`, `archiveItem`, `restoreItem` (`itemActions.ts`).
- **db:** `itemRepo`, `listRepo`, `settingsRepo`, `reminderLogRepo`, `backupRepo` (`repository.ts`); `getDb`, `resetDbInstance`, `DB_NAME` (`schema.ts`); `runLegacyMigration`, `mapLegacyTask`, reset helpers (`legacyTasks.ts`); `SyncAdapter`/`LocalOnlyAdapter` (`SyncAdapter.ts`).
- **lib:** `buildBackup`/`parseBackup`/`mergeImportedItems`/`downloadFile`/`pickFile` (`backup.ts`), `itemsToCSV`/`csvToItems` (`csv.ts`), `itemsToICS`/`recurrenceToRRule` (`ics.ts`), the full `lib/date.ts` local-date surface, `labels.ts`.

---

## 5. Data flow

### Read path
1. Components call hooks in `src/hooks/useData.ts` (`useItems`, `useLists`, `useItem`, `useChildren`, `useSetting`), each wrapping `useLiveQuery` around a `*Repo` method.
2. `useOccurrences(items, from, to)` (`src/hooks/useOccurrences.ts:5`) flattens `expandOccurrences` over items and sorts — the single read-time recurrence projection.
3. Dexie live queries re-render automatically on table writes; there is **no** client cache or query client.

### Write path
1. UI gathers a full `Item`/patch and calls a domain action in `src/domain/itemActions.ts` (e.g. `saveItem`, `patchItem`, `setStatus`, `toggleDone`, `deleteItem`, `updateRecurring`).
2. The action writes through `src/db/repository.ts` (`itemRepo.*`), which is the only Dexie caller.
3. The action records a `HistoryEntry` diff (via `buildHistory`), pushes an **undo closure** onto `useUiStore.undoStack`, and pushes a toast.
4. `useLiveQuery` re-fires; UI updates. `useKeyboardShortcuts` ⌘/Ctrl+Z calls `useUiStore.undo()`.
5. Settings writes bypass item actions: `SettingsView.persist` (`:59`) and `useTheme` call `settingsRepo.set` directly.
6. List writes also bypass `itemActions`: `listRepo.create` is called inline from features (see §7).

### Reminder flow
`ReminderRuntime` reads items via `useItems`, computes `upcomingReminders` over `[now-24h, now+30s]`, dedupes through `reminderLogRepo.wasFired` on key `occKey::reminderId`, shows an SW notification or toast, then `reminderLogRepo.record`. Digest uses the synthetic `__digest__` tag. No push server.

---

## 6. Architectural seams (intentional)

| Seam | Location | State |
|---|---|---|
| Repository pattern | `src/db/repository.ts` | enforced: Dexie only appears under `src/db/` (verified by grep; only db files and tests reference `getDb`/`.items.`) |
| Recurrence engine | `src/domain/recurrence.ts` `expandOccurrences` | pure RRULE subset: daily/weekly/monthly/yearly, interval, byWeekday, byMonthDay (−1 = last day), byMonth, count, until, exceptions, overrides; month-end clamped |
| Reminder engine | `src/domain/reminders.ts` | pure fire-time computation over occurrences |
| Sync adapter | `src/db/sync/SyncAdapter.ts` | interface + `LocalOnlyAdapter` no-op; **no consumer anywhere** — true future seam |
| Legacy migration | `src/db/migrations/legacyTasks.ts` | idempotent, always backs up raw payload to `backups` + `eisenmatrix-tasks.v1.bak` |
| Undo/history | `useUiStore.undoStack` + `itemActions.buildHistory` | per-action closures, capped at 25 |
| UI/session state | `src/store/useUiStore.ts` | Zustand is only for session/UI, never domain data |

---

## 7. Inconsistencies / violations found

1. **Domain depends on UI store (layering inversion).** `src/domain/itemActions.ts:4` imports `useUiStore` and calls `getState().pushUndo/pushToast` (`:9-26`). Domain logic is therefore coupled to Zustand session state; the documented direction is features → domain, not domain → store.
2. **`toggleDone` bypasses its own action layer for habits.** `src/domain/itemActions.ts:180` calls `itemRepo.update(item.id, { data: ... streak })` directly instead of `patchItem`; the streak write produces **no history and no undo entry**.
3. **`updateRecurring` "future" split bypasses repository/undo contracts.** `src/domain/itemActions.ts:261-262` calls `itemRepo.create(head)` / `itemRepo.create(tailPatched)` directly, with no `pushUndo`, so a series split cannot be undone (unlike every other edit).
4. **Features mutate lists directly through `listRepo`, bypassing `itemActions`** (the documented write path). Call sites: `src/features/list/ListView.tsx:12,117`; `src/features/shopping/ShoppingView.tsx:10,73,98`; `src/features/quickadd/QuickAdd.tsx:11,63`; `src/features/settings/SettingsView.tsx:14,103-104,138`. These get no undo/history/toast consistency.
5. **Two sources of truth for theme.** `AppSettings.theme` in Dexie (`src/types/settings.ts:9`) and `useUiStore.theme` (`src/store/useUiStore.ts:37`) are reconciled imperatively in `src/hooks/useTheme.ts:11-35`; a future refactor must keep both in sync.
6. **`db` singleton vs. reset path.** `src/db/schema.ts:54` exports a module-load `db` while repositories use `getDb()`; `resetDbInstance()` (`:50`) only clears the lazy instance, so the exported `db` is stale after a reset (only tests use it today).
7. **Overview of `Occurrence` ignores non-start patch fields.** `updateOccurrence` for non-recurring items only applies `start` (`src/domain/itemActions.ts:199`), silently dropping `end`/`status`/`notes`.
8. **Tautological ternary.** `src/features/item/ItemEditorSheet.tsx:128` `kind: draft.kind === 'goal' ? 'task' : 'task'` always yields `'task'` (intent likely differed).
9. **`ReminderRuntime` (a feature/pwa module) reads `itemRepo` and writes `reminderLogRepo` directly** (`src/pwa/ReminderRuntime.tsx:3,26,45,94,135,171`). Reads are harmless; direct reminder-log writes sidestep any domain reminder action, though none exists.
10. **`db/repository.ts:42-48` `updateMany` uses `this.update`** inside a transaction; it breaks if the method is ever detached from `itemRepo`. Minor robustness issue.
11. **Reset path is intentionally non-atomic with other actions.** `SettingsView.resetAll` (`:137-141`) does three independent repo calls with no undo (acceptable for a destructive, confirmed action).

**Clean areas (verified):** no direct `localStorage`/`sessionStorage` outside `src/db/migrations/legacyTasks.ts:209`; no direct Dexie outside `src/db/`; all IDs via `newId()`; ISO date keys via `lib/date.ts` (no `toISOString()` date keys); labels centralized in `lib/labels.ts`.

---

## 8. Top files an improver should know

1. `src/types/item.ts` — the unified model every feature depends on.
2. `src/db/repository.ts` — the only persistence seam; add methods here, never Dexie elsewhere.
3. `src/domain/itemActions.ts` — the sanctioned write path (undo/history/toasts); most inconsistency risks live here.
4. `src/domain/recurrence.ts` — `expandOccurrences`; highest-blast-radius pure logic.
5. `src/hooks/useData.ts` + `src/hooks/useOccurrences.ts` — the read path.
6. `src/store/useUiStore.ts` — editor/filters/toasts/undo state.
7. `src/App.tsx` — routes, overlays, boot migration/PWA wiring.
8. `src/db/migrations/legacyTasks.ts` — v1 import semantics and the migration marker.
