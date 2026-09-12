import type { Frequency, GoalData, ItemKind, ItemStatus, ListKind, Priority } from '@/types';

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  task: 'Task',
  event: 'Event',
  habit: 'Habit',
  goal: 'Goal',
  bill: 'Bill',
  shopping: 'Shopping',
  note: 'Note',
};

export const ITEM_KIND_PLURAL: Record<ItemKind, string> = {
  task: 'Tasks',
  event: 'Events',
  habit: 'Habits',
  goal: 'Goals',
  bill: 'Bills',
  shopping: 'Shopping',
  note: 'Notes',
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  todo: 'To Do',
  doing: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  low: 'Low',
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export const HORIZON_LABELS: Record<GoalData['horizon'], string> = {
  week: 'This week',
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
};

export const LIST_KIND_LABELS: Record<ListKind, string> = {
  project: 'Project',
  shopping: 'Shopping',
  area: 'Area',
};

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export function statusClasses(status: ItemStatus): string {
  switch (status) {
    case 'done':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300';
    case 'doing':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300';
    case 'cancelled':
      return 'border-slate-200 bg-slate-100 text-slate-500 line-through dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400';
    default:
      return 'border-border bg-elevated text-muted';
  }
}

export function priorityBadgeClasses(priority: Priority): string {
  return priority === 'high'
    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'
    : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300';
}

/** Natural colour per quadrant, driven by CSS tokens. */
export const QUADRANT_META = {
  q1: { title: 'Do First', urgency: 'high', importance: 'high' },
  q2: { title: 'Schedule', urgency: 'low', importance: 'high' },
  q3: { title: 'Delegate', urgency: 'high', importance: 'low' },
  q4: { title: 'Eliminate', urgency: 'low', importance: 'low' },
} as const;

export type QuadrantId = keyof typeof QUADRANT_META;
