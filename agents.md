# 🎯 EisenMatrix Calendar - Project Context for AI Agents

> **Purpose**: This document provides AI agents with comprehensive context about the EisenMatrix Calendar project to enable effective assistance in future sessions.

---

## 📋 Project Overview

**EisenMatrix Calendar** is a productivity web application that integrates the **Eisenhower Matrix** (prioritization system based on urgency/importance) with a calendar interface. It helps users categorize and manage tasks across four quadrants:

| | Urgent | Not Urgent |
|---|---|---|
| **Important** | **Q1: Do First** (red) | **Q2: Schedule** (blue) |
| **Not Important** | **Q3: Delegate** (yellow) | **Q4: Eliminate** (gray) |

### Key Features
- **Drag-and-drop** task movement between quadrants
- **Multiple view modes**: Day, Week, Month, Year
- **Recurring tasks**: Daily, Weekly, Monthly, Yearly frequencies
- **Task history tracking**: Automatic changelog for modifications
- **Local-first architecture**: Data persists via `localStorage`
- **Deployed to GitHub Pages** via automated CI/CD

---

## 🏗️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 19 with TypeScript |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS (CDN-based) |
| **Drag & Drop** | @dnd-kit/core |
| **Date Utilities** | date-fns |
| **Icons** | Lucide React |
| **Utilities** | clsx, tailwind-merge |

---

## 📁 Project Structure

```
eisenmatrix-calendar/
├── index.html            # Entry point HTML
├── index.tsx             # React app mount point
├── App.tsx               # Main application component (451 lines)
├── types.ts              # TypeScript type definitions & enums
├── package.json          # Dependencies & scripts
├── vite.config.ts        # Vite configuration (base: /eisenmatrix-calendar/)
├── tsconfig.json         # TypeScript configuration
│
├── components/           # React UI components
│   ├── CalendarControl.tsx   # Date navigation & view mode controls
│   ├── CalendarView.tsx      # Calendar grid display (Month/Week/Day/Year)
│   ├── MatrixGrid.tsx        # 2x2 Eisenhower Matrix layout
│   ├── TaskCard.tsx          # Individual task card (draggable)
│   ├── TaskListView.tsx      # Full task list view
│   └── TaskModal.tsx         # Create/Edit task dialog
│
├── lib/
│   └── utils.ts          # Utility functions (date handling, status, cn())
│
├── dist/                 # Production build output
├── .github/workflows/
│   └── deploy.yml        # GitHub Pages deployment workflow
└── .env.local            # Environment variables (local)
```

---

## 🔑 Core Concepts

### Task Model (`types.ts`)
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  urgency: Urgency;           // HIGH | LOW
  importance: Importance;     // HIGH | LOW
  status: TaskStatus;         // 'To Do' | 'In Progress' | 'Done'
  date: string;               // YYYY-MM-DD format
  frequency: Frequency;       // NONE | DAILY | WEEKLY | MONTHLY | YEARLY
  createdAt: number;          // Timestamp
  updatedAt: number;          // Timestamp
  completedAt?: number;       // For single tasks
  history: HistoryEntry[];    // Change log
  completionHistory?: Record<string, TaskStatus>; // For recurring tasks
  recurrenceEndedAt?: number; // When recurring series ended
}
```

### Quadrant Mapping
- **Q1 (Do First)**: Urgency=HIGH, Importance=HIGH → Red theme
- **Q2 (Schedule)**: Urgency=LOW, Importance=HIGH → Blue theme
- **Q3 (Delegate)**: Urgency=HIGH, Importance=LOW → Yellow theme
- **Q4 (Eliminate)**: Urgency=LOW, Importance=LOW → Gray theme

### View Modes & Filtering Logic
- **Daily tasks** only appear in **Day** view
- **Weekly tasks** appear in **Day** and **Week** views
- **Monthly tasks** appear in **Day**, **Week**, and **Month** views
- **Non-recurring tasks** appear when their date falls within the current view interval

---

## 🧩 Key Components

| Component | Responsibility |
|-----------|----------------|
| `App.tsx` | Main state management, CRUD operations, DnD context |
| `MatrixGrid.tsx` | Renders 2x2 quadrant grid with droppable zones |
| `CalendarView.tsx` | Date-based task visualization |
| `TaskListView.tsx` | Sortable/filterable list of all tasks |
| `TaskModal.tsx` | Full task editor with history display |
| `TaskCard.tsx` | Compact task display (draggable in Matrix view) |
| `CalendarControl.tsx` | Date picker & view mode switcher |

---

## 💾 Data Persistence

- **Storage Key**: `eisenmatrix-tasks`
- **Mechanism**: `localStorage`
- Tasks are JSON-serialized and stored on every state change
- On load, data is sanitized to ensure `history` and `frequency` fields exist

---

## 🚀 Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🌐 Deployment

- **Platform**: GitHub Pages
- **Trigger**: Automatic on push to `main` branch
- **Workflow**: `.github/workflows/deploy.yml`
- **Base URL**: `/eisenmatrix-calendar/` (configured in `vite.config.ts`)
- **Live URL**: `https://denimpatel.github.io/eisenmatrix-calendar`

---

## 🛠️ Common Development Patterns

### Adding a New Task Field
1. Update `Task` interface in `types.ts`
2. Handle in `handleSaveTask()` in `App.tsx`
3. Add UI controls in `TaskModal.tsx`
4. Update storage sanitization in `App.tsx` `useEffect`

### Modifying Quadrant Behavior
- Edit `QUADRANTS` constant in `types.ts`
- Update `MatrixGrid.tsx` for visual changes

### Date Handling
- Always use `parseLocalTaskDate()` from `lib/utils.ts` for consistency
- Task dates are stored as `YYYY-MM-DD` strings (no timezone issues)

---

## 📌 Important Notes for AI Agents

1. **Tailwind via CDN**: Styling uses CDN-loaded Tailwind, not a config file
2. **No backend**: Fully client-side, localStorage only
3. **React 19**: Uses latest React features
4. **TypeScript strict**: Type safety enforced throughout
5. **Date-fns used**: Prefer date-fns over native Date methods for complex operations
6. **DnD Kit**: Drag-and-drop uses @dnd-kit, not react-dnd

---

## 🔗 Related Resources

- [Eisenhower Matrix Explanation](https://www.eisenhower.me/eisenhower-matrix/)
- [DnD Kit Documentation](https://docs.dndkit.com/)
- [date-fns Documentation](https://date-fns.org/)
- [Vite Documentation](https://vitejs.dev/)

---

*Last updated: February 2026*
