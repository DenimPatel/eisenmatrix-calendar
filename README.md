# 🎯 EisenMatrix Calendar

> A local-first personal operating system: Eisenhower Matrix, calendar, goals, habits,
> bills, shopping lists, notes and reminders — in one installable, offline-capable app.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## Why

A to-do app, a reminders app, a habit tracker and a bill tracker usually means four
logins and four places your data can drift apart. EisenMatrix Calendar unifies all of it
behind one **`Item`** model with a shared recurrence engine, reminder engine and
calendar, so recurring anything stays consistent everywhere.

Everything lives in **IndexedDB on your device**. There is no account, no server and no
telemetry. It is 100% static and deploys to GitHub Pages.

---

## Features

- **Today dashboard** — overdue strip, today's agenda, habit rings, bills due this week,
  goal progress and "what's next".
- **Eisenhower Matrix** — drag items between Do First / Schedule / Delegate / Eliminate.
- **Calendar** — day / week / month / year views. Drag items onto a day to reschedule.
- **Tasks & events** — time-of-day, duration, all-day, subtasks, checklists, tags,
  projects, estimates, bulk edit, archive.
- **Goals** — binary / numeric / milestone metrics, horizons (week → year), progress
  rings, milestones as child items.
- **Habits** — targets per day/week/month, current + best streaks, a 12-week heatmap.
- **Bills** — amount, payee, autopay, recurring schedule, per-occurrence paid state,
  upcoming-due strip and monthly totals.
- **Shopping** — quantity, unit, aisle grouping, running estimate, check-off and
  "clear purchased".
- **Notes** — pinned quick notes, attachable to any item.
- **Reminders** — multiple per item, relative or absolute, snooze, and a daily digest.
- **Recurrence** — every N days/weeks/months/years, specific weekdays, month-day
  including "last day", until/after-N, skip and edit single occurrences.
- **Quick add** — natural language: `pay electricity $120 every month on the 5th !urgent`,
  `buy milk 2L #groceries`, `gym mon/wed/fri 7am`. Parsed chips are editable before commit.
- **Command palette** — `⌘/Ctrl+K` to jump, create or search anything.
- **Data portability** — JSON backup/restore (canonical), CSV v2 and ICS export.
- **PWA** — installable, offline-first, with an update prompt.

---

## Getting started

### Prerequisites

- Node.js 20+ (latest LTS recommended)
- npm

### Install & run

```bash
npm install
npm run dev      # http://localhost:3000/eisenmatrix-calendar/
```

### Build & preview

```bash
npm run build
npm run preview
```

The production app is served under the `/eisenmatrix-calendar/` base path so it works on
GitHub Pages.

### Quality gates

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint .
npm run test        # vitest run
```

---

## Architecture at a glance

| Concern       | Choice                                                |
| ------------- | ----------------------------------------------------- |
| UI            | React 19 + TypeScript (strict)                        |
| Build         | Vite 6                                                |
| Styling       | Tailwind + CSS-variable design tokens (light/dark)    |
| Persistence   | IndexedDB via Dexie 4 (versioned schema + migrations) |
| Reactive data | `dexie-react-hooks` `useLiveQuery`                    |
| UI state      | Zustand                                               |
| Routing       | `react-router-dom` `HashRouter`                       |
| Drag & drop   | `@dnd-kit`                                            |
| Dates         | `date-fns`                                            |
| PWA           | `vite-plugin-pwa` (`injectManifest`)                  |
| Tests         | Vitest + fake-indexeddb + jsdom                       |

All reads and writes go through repositories in `src/db/repository.ts`, and every
mutation goes through `src/domain/itemActions.ts` (history + undo + toast). That boundary
is the seam a future sync adapter plugs into.

See [agents.md](./agents.md) for a deeper architecture and contribution guide.

---

## Data & privacy

- Everything is stored locally in IndexedDB.
- Export a JSON backup or CSV at any time from **Settings → Data**.
- Reminders are best-effort without a push server; in-app banners always work.
- The v1 `localStorage` payload is imported automatically on first run and the raw copy
  is preserved at `localStorage['eisenmatrix-tasks.v1.bak']`.

---

## Deployment

Pushing to `main` builds and publishes to GitHub Pages. The base path, PWA manifest and
`HashRouter` are configured for the repository subpath, so deep links work.

---

## License

MIT
