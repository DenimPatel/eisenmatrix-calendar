import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Task, Frequency, TaskStatus } from '../types';
import { getWeek, format, endOfWeek, endOfMonth } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateTimeReadable(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function parseLocalTaskDate(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'To Do': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'In Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Done': return 'bg-green-50 text-green-700 border-green-200';
    default: return 'bg-slate-100';
  }
};

export function getPeriodKey(date: Date, frequency: Frequency): string {
  const d = new Date(date);
  const y = d.getFullYear();

  switch (frequency) {
    case Frequency.DAILY:
      return formatDate(d);
    case Frequency.WEEKLY:
      // Use ISO week number
      return `${y}-W${getWeek(d)}`;
    case Frequency.MONTHLY:
      return format(d, 'yyyy-MM');
    case Frequency.YEARLY:
      return `${y}`;
    default:
      return '';
  }
}

export function getTaskStatus(task: Task, date: Date): TaskStatus {
  // If the series has ended and we are looking at a date strictly after the end date, 
  // we could technically return 'Done' or just whatever history says. 
  // However, isTaskActiveOnDate should prevent this from being rendered in most cases.
  // If it is rendered (e.g. in list view), we defer to standard logic.

  if (!task.frequency || task.frequency === Frequency.NONE) {
    return task.status;
  }
  const key = getPeriodKey(date, task.frequency);
  return task.completionHistory?.[key] || TaskStatus.TODO;
}

export function isTaskActiveOnDate(task: Task, date: Date): boolean {
  // Check if recurrence has ended
  if (task.recurrenceEndedAt) {
    const endDate = new Date(task.recurrenceEndedAt);
    endDate.setHours(0, 0, 0, 0);

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate > endDate) {
      return false;
    }
  }

  // Parse task date strictly as local YYYY-MM-DD using helper
  const startDate = parseLocalTaskDate(task.date);

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  // If the check date is before the task start date, it's not active
  if (checkDate < startDate) return false;

  switch (task.frequency) {
    case Frequency.DAILY:
      return true;
    case Frequency.WEEKLY:
      // Show on the same day of week as the "deadline" (task.date)
      return checkDate.getDay() === startDate.getDay();
    case Frequency.MONTHLY:
      // Show on the same day of month
      // Simple check:
      return checkDate.getDate() === startDate.getDate();
    case Frequency.YEARLY:
      return checkDate.getDate() === startDate.getDate() &&
        checkDate.getMonth() === startDate.getMonth();
    case Frequency.NONE:
    default:
      return checkDate.getTime() === startDate.getTime();
  }
}

export function getRecurrenceDeadline(date: Date, frequency: Frequency): Date {
  const d = new Date(date);
  switch (frequency) {
    case Frequency.WEEKLY:
      return endOfWeek(d); // Defaults to Saturday or Sunday depending on locale
    case Frequency.MONTHLY:
      return endOfMonth(d);
    default:
      return d;
  }
}

export function startOfWeek(date: Date, options?: { weekStartsOn?: number }): Date {
  const d = new Date(date);
  const day = d.getDay();
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;

  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfYear(date: Date): Date {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function exportToCSV(tasks: Task[]): string {
  const headers = ['id', 'title', 'description', 'urgency', 'importance', 'status', 'date', 'frequency', 'createdAt', 'updatedAt', 'completedAt', 'recurrenceEndedAt'];
  const rows = tasks.map(task => {
    return headers.map(header => {
      const value = (task as any)[header];
      if (value === undefined || value === null) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

export function parseCSV(csvText: string): Partial<Task>[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const task: any = {
      history: [],
      completionHistory: {}
    };

    headers.forEach((header, index) => {
      const val = values[index];
      if (val === undefined) return;

      if (['createdAt', 'updatedAt', 'completedAt', 'recurrenceEndedAt'].includes(header)) {
        task[header] = val ? Number(val) : undefined;
      } else {
        task[header] = val;
      }
    });

    return task as Partial<Task>;
  });
}