export enum Urgency {
  HIGH = 'High',
  LOW = 'Low'
}

export enum Importance {
  HIGH = 'High',
  LOW = 'Low'
}

export enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done'
}

export enum ViewMode {
  DAY = 'Day',
  WEEK = 'Week',
  MONTH = 'Month',
  YEAR = 'Year'
}

export enum Frequency {
  NONE = 'None',
  DAILY = 'Daily',
  WEEKLY = 'Weekly',
  MONTHLY = 'Monthly',
  YEARLY = 'Yearly'
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  field: string;
  oldValue: string;
  newValue: string;
  user: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  urgency: Urgency;
  importance: Importance;
  status: TaskStatus;
  date: string; // ISO Date string YYYY-MM-DD
  frequency: Frequency;
  createdAt: number;
  updatedAt: number;
  completedAt?: number; // Timestamp when a single task was completed
  history: HistoryEntry[];
  completionHistory?: Record<string, TaskStatus>;
  recurrenceEndedAt?: number; // Timestamp when the recurring series was completed/stopped
}

export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';

export const QUADRANTS: Record<QuadrantId, { urgency: Urgency; importance: Importance; title: string; color: string }> = {
  q1: {
    urgency: Urgency.HIGH,
    importance: Importance.HIGH,
    title: 'Do First',
    color: 'red'
  },
  q2: {
    urgency: Urgency.LOW,
    importance: Importance.HIGH,
    title: 'Schedule',
    color: 'blue'
  },
  q3: {
    urgency: Urgency.HIGH,
    importance: Importance.LOW,
    title: 'Delegate',
    color: 'yellow'
  },
  q4: {
    urgency: Urgency.LOW,
    importance: Importance.LOW,
    title: 'Eliminate',
    color: 'gray'
  }
};