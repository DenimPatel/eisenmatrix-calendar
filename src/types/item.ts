import type { OccurrenceState, OccurrenceStatus, RecurrenceRule } from './recurrence';

export type ItemKind = 'task' | 'event' | 'habit' | 'goal' | 'bill' | 'shopping' | 'note';
export type ItemStatus = 'todo' | 'doing' | 'done' | 'cancelled';
export type Priority = 'high' | 'low';

export interface Reminder {
  id: string;
  /** Minutes relative to the occurrence start/due. Negative fires before. */
  offsetMinutes?: number;
  /** For all-day items: absolute local time-of-day (`HH:mm`) on the day. */
  timeOfDay?: string;
  /** One-off absolute epoch milliseconds. */
  absolute?: number;
  label?: string;
}

export interface ChecklistEntry {
  id: string;
  text: string;
  done: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  field: string;
  oldValue: string;
  newValue: string;
  user: string;
}

export interface BaseItem {
  id: string;
  kind: ItemKind;
  title: string;
  notes: string;
  status: ItemStatus;
  urgency: Priority;
  importance: Priority;

  /** `YYYY-MM-DD` for all-day items, `YYYY-MM-DDTHH:mm` for timed items. */
  start: string | null;
  end: string | null;
  allDay: boolean;
  dueAt: string | null;
  recurrence: RecurrenceRule | null;

  tags: string[];
  listId: string | null;
  parentId: string | null;
  order: number;
  reminders: Reminder[];
  checklist: ChecklistEntry[];

  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  archivedAt: number | null;
  history: HistoryEntry[];
  /** occKey -> per-occurrence state for recurring items. */
  occurrences: Record<string, OccurrenceState>;
  /** Retained raw data from the v1 `localStorage` schema. Never dropped. */
  legacy?: { completionHistory?: Record<string, string> };
}

export interface TaskData {
  estimateMinutes?: number;
  energy?: 'low' | 'med' | 'high';
}

export interface EventData {
  location?: string;
  attendees?: string[];
  travelMinutes?: number;
}

export interface HabitData {
  target: { count: number; per: 'day' | 'week' | 'month' };
  unit?: string;
  streak: { current: number; best: number; lastAt: string | null };
}

export interface GoalData {
  metric: {
    type: 'binary' | 'numeric' | 'checklist';
    target?: number;
    current?: number;
    unit?: string;
  };
  horizon: 'week' | 'month' | 'quarter' | 'year';
  why?: string;
}

export interface BillData {
  amount: number;
  currency: string;
  payee: string;
  account?: string;
  autopay: boolean;
  payments: Record<string, { paidAt: number; amount: number }>;
}

export interface ShoppingData {
  quantity: number;
  unit?: string;
  aisle?: string;
  estPrice?: number;
  purchased: boolean;
}

export interface NoteData {
  pinned: boolean;
}

export type Item =
  | (BaseItem & { kind: 'task'; data: TaskData })
  | (BaseItem & { kind: 'event'; data: EventData })
  | (BaseItem & { kind: 'habit'; data: HabitData })
  | (BaseItem & { kind: 'goal'; data: GoalData })
  | (BaseItem & { kind: 'bill'; data: BillData })
  | (BaseItem & { kind: 'shopping'; data: ShoppingData })
  | (BaseItem & { kind: 'note'; data: NoteData });

export type ItemData = Item['data'];

export type TaskItem = Extract<Item, { kind: 'task' }>;
export type EventItem = Extract<Item, { kind: 'event' }>;
export type HabitItem = Extract<Item, { kind: 'habit' }>;
export type GoalItem = Extract<Item, { kind: 'goal' }>;
export type BillItem = Extract<Item, { kind: 'bill' }>;
export type ShoppingItem = Extract<Item, { kind: 'shopping' }>;
export type NoteItem = Extract<Item, { kind: 'note' }>;

/** A resolved occurrence of an item on a specific local day. */
export interface Occurrence {
  item: Item;
  /** Stable key: local `YYYY-MM-DD` of the occurrence start. */
  occKey: string;
  /** Local start-of-day for the occurrence. */
  date: Date;
  /** Effective start (`YYYY-MM-DD[THH:mm]`) after overrides. */
  start: string | null;
  end: string | null;
  allDay: boolean;
  status: OccurrenceStatus;
  completedAt: number | null;
  isOverride: boolean;
}

export const ITEM_KINDS: ItemKind[] = [
  'task',
  'event',
  'habit',
  'goal',
  'bill',
  'shopping',
  'note',
];

export const ITEM_STATUSES: ItemStatus[] = ['todo', 'doing', 'done', 'cancelled'];
