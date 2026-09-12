# 🎯 EisenMatrix Calendar — Project Context for AI Agents

> **Purpose**: This document gives AI agents the context needed to work safely and
> effectively in the EisenMatrix Calendar codebase.

---

## What this is

EisenMatrix Calendar is a **local-first personal operating system** that combines the
Eisenhower Matrix with a calendar, goals, habits, bills, shopping lists, notes and
reminders. It is 100% static, has no backend, and is deployable to GitHub Pages.

The app is a React 19 + TypeScript + Vite SPA. It uses:

| Concern          | Choice                                                             |
| ---------------- | ------------------------------------------------------------------ |
| Framework        | React 19 + TypeScript (strict)                                     |
| Build            | Vite 6                                                             |
| Styling          | Tailwind CSS (real build, not CDN) with CSS-variable design tokens |
| Persistence      | IndexedDB via Dexie 4 (versioned schema + migrations)              |
| Reactive data    | `dexie-react-hooks` `useLiveQuery`                                 |
| UI/session state | Zustand                                                            |
| Routing          | `react-router-dom` `HashRouter` (works on the Pages subpath)       |
| Drag & drop      | `@dnd-kit/core` (+ `sortable`, `utilities`)                        |
| Dates            | `date-fns`                                                         |
| PWA              | `vite-plugin-pwa` with an `injectManifest` service worker          |
| Tests            | Vitest + fake-indexeddb (+ jsdom for a mount smoke test)           |

---

## Commands

```bash
npm install
npm run dev          # Vite dev server on port 3000 at /eisenmatrix-calendar/
npm run build        # tsc --noEmit && vite build (includes the service worker)
npm run preview      # preview the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run format       # prettier --write .
npm run test         # vitest run
npm run test:watch   # vitest
```

Always run `npm run typecheck`, `npm run lint` and `npm run test` before finishing a change.
The build is only considered healthy if all three pass.

---

## Architecture

```
src/
  main.tsx                 app entry
  App.tsx                  shell: router + providers + global overlays
  types/
    item.ts                unified Item model (discriminated union on `kind`)
    recurrence.ts          RecurrenceRule, OccurrenceState
    list.ts                List entity (project | shopping | area)
    settings.ts            AppSettings
  db/
    schema.ts              Dexie DB + version()s
    repository.ts          itemRepo / listRepo / settingsRepo / reminderLogRepo / backupRepo
    migrations/legacyTasks.ts   v1 localStorage -> IndexedDB import + backup
    sync/SyncAdapter.ts    the (unimplemented) sync seam
  domain/
    recurrence.ts          expandOccurrences() — the scheduling engine
    reminders.ts           reminder fire-time computation
    stats.ts               streaks, completion rate, goal progress
    quickadd.ts            natural-language quick add parser
    eisenhower.ts          quadrant mapping + priority score
    itemFactory.ts         createItem / normalizeItem
    itemActions.ts         persistence actions with history + undo
  store/useUiStore.ts      theme, filters, editor, toasts, undo stack
  features/
    shell/                 AppShell, nav, DnD wrapper, shortcut sheet
    today/ calendar/ matrix/ list/ goals/ habits/ bills/ shopping/ notes/ settings/
    item/                   ItemCard, ItemEditorSheet, KindFields, RecurrenceEditor, ReminderEditor
    quickadd/ command/     QuickAdd, CommandPalette
  components/ui/           Button, Dialog, Sheet, Tabs, Form, Badge, ProgressRing, ToastHost, EmptyState
  hooks/                   useData, useOccurrences, useTheme, useKeyboardShortcuts, useFocusTrap
  lib/                     date, cn, id, labels, csv, ics, backup
  pwa/                     sw.ts, notifications.ts, ReminderRuntime.tsx, register.ts
  styles/index.css         Tailwind directives + design tokens
```

### The unified `Item` model

Everything (tasks, events, habits, goals, bills, shopping items, notes) is one `Item`
with a `kind` discriminator and a kind-specific `data` payload. The shared fields
(`start`, `end`, `allDay`, `dueAt`, `recurrence`, `reminders`, `tags`, `listId`,
`parentId`, `occurrences`, `history`) mean **one recurrence engine and one reminder
engine serve every feature**.

Enums use stable lowercase slugs (`'todo'`, `'doing'`, `'done'`, `'cancelled'`,
`'high'`/`'low'`). Display labels live in `src/lib/labels.ts` — never persist UI copy.

### Data flow

1. Components read data with `useLiveQuery` wrappers in `src/hooks/useData.ts`
   (`useItems`, `useLists`, `useSetting`, …).
2. Mutations go through `src/domain/itemActions.ts`, never directly to Dexie.
   Actions record `history`, push an undo entry, and show a toast.
3. `src/db/repository.ts` is the **only** module that touches Dexie tables. This is the
   seam a future `SyncAdapter` plugs into.
4. UI/session state lives in `src/store/useUiStore.ts`.

### Recurrence engine

`expandOccurrences(item, from, to)` in `src/domain/recurrence.ts` is a pure RRULE
subset: daily/weekly/monthly/yearly, `interval`, `byWeekday`, `byMonthDay` (including
`-1` = last day), `byMonth`, `count`, `until`, `exceptions`, and per-occurrence
`overrides`. Month-end is **clamped** (Jan 31 → Feb 28/29), never skipped. The
occurrence key is the local `YYYY-MM-DD` of the occurrence start.

### Dates

Always use helpers from `src/lib/date.ts`. Never use `Date.toISOString()` to produce a
date key — that is a UTC conversion and causes off-by-one bugs. Use `formatISODate`
(local) instead. Weeks are Monday-first by default.

---

## Conventions

- **No direct `localStorage`** in features. All persistence is Dexie via repositories.
- **No direct Dexie** outside `src/db/`. Add repository methods instead.
- **Dates**: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` local strings in `start`/`end`/`dueAt`.
- **IDs**: use `newId()` from `src/lib/id.ts` (`crypto.randomUUID` with a fallback).
- **Styling**: use the semantic Tailwind tokens (`bg-bg`, `bg-surface`, `text-fg`,
  `text-muted`, `border-border`, `bg-accent`, `text-q1`…). Never hardcode slate/white;
  that breaks dark mode. Use `cn()` from `src/lib/cn.ts` for conditional classes.
- **Components**: keep UI primitives in `src/components/ui/`; feature components in
  `src/features/<feature>/`.
- **Accessibility**: dialogs/sheets use `useFocusTrap`; toasts are `aria-live`; keyboard
  shortcuts are registered in `useKeyboardShortcuts`. Respect reduced motion.
- Do not add comments unless they explain non-obvious intent.

---

## Adding a new item field

1. Add it to `BaseItem` or the relevant kind payload in `src/types/item.ts`.
2. Default it in `createItem` / `defaultDataFor` in `src/domain/itemFactory.ts`.
3. Surface it in the editor (`src/features/item/KindFields.tsx` or the schedule tab).
4. If it must persist across export, add it to `CSV_COLUMNS` and `csvToItems` in
   `src/lib/csv.ts`, and to JSON backup if it is not part of the `Item` object.
5. Add or update tests.

## Keyboard shortcuts

`C` quick add · `N` new task · `/` and `⌘/Ctrl+K` command palette · `1–9` views ·
`⌘/Ctrl+Z` undo · `?` shortcut sheet · `Esc` close.

---

## PWA & reminders

- `vite-plugin-pwa` uses `injectManifest`; the worker lives at `src/pwa/sw.ts` and is
  excluded from `tsc` (it uses the webworker lib).
- `src/pwa/ReminderRuntime.tsx` expands the next-24h window on load, on
  `visibilitychange`, and every 60s, then fires via `registration.showNotification()`.
- Delivery is recorded in the `reminderLog` table keyed by `[itemId+occKey]` so nothing
  double-fires.
- There is **no push server**. Background delivery depends on the OS and is
  best-effort; in-app toasts always work. Settings states this plainly.

---

## Migration from v1

`src/db/migrations/legacyTasks.ts` imports `localStorage['eisenmatrix-tasks']` into
IndexedDB exactly once (tracked by the `migration.legacy` setting). It always writes the
raw payload to the `backups` table and to `eisenmatrix-tasks.v1.bak`, maps all four
`completionHistory` period-key formats onto real occurrence keys, and keeps the raw map
at `item.legacy.completionHistory`. It is idempotent and can be re-run from
Settings → Data.

---

## Deployment

GitHub Pages, automatic on push to `main`, base path `/eisenmatrix-calendar/`
(configured in `vite.config.ts` and the PWA manifest). `HashRouter` is used so deep
links work on the Pages subpath.

---

_Last updated: 2026 — rewritten for the unified Item architecture._
