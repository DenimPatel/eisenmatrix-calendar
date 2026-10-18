import { newId } from '@/lib/id';
import { coerceItemShape, isPlainObject } from '@/lib/itemValidation';
import type { BaseItem, Item, ItemKind, Priority } from '@/types';

export function defaultDataFor(kind: ItemKind): Item['data'] {
  switch (kind) {
    case 'task':
      return {};
    case 'event':
      return {};
    case 'habit':
      return {
        target: { count: 1, per: 'day' },
        streak: { current: 0, best: 0, lastAt: null },
      };
    case 'goal':
      return { metric: { type: 'binary' }, horizon: 'month' };
    case 'bill':
      return { amount: 0, currency: 'USD', payee: '', autopay: false, payments: {} };
    case 'shopping':
      return { quantity: 1, purchased: false };
    case 'note':
      return { pinned: false };
  }
}

function defaultRecurrenceFor(kind: ItemKind): BaseItem['recurrence'] {
  if (kind !== 'habit') return null;
  return { freq: 'daily', interval: 1, weekStartsOn: 1, exceptions: [], overrides: {} };
}

export interface CreateItemOptions {
  kind: ItemKind;
  title?: string;
  notes?: string;
  status?: BaseItem['status'];
  urgency?: Priority;
  importance?: Priority;
  start?: string | null;
  end?: string | null;
  allDay?: boolean;
  dueAt?: string | null;
  recurrence?: BaseItem['recurrence'];
  listId?: string | null;
  parentId?: string | null;
  tags?: string[];
  reminders?: BaseItem['reminders'];
  checklist?: BaseItem['checklist'];
  order?: number;
  data?: Partial<Item['data']>;
}

export function createItem(options: CreateItemOptions): Item {
  const now = Date.now();
  const base = {
    id: newId(),
    kind: options.kind,
    title: options.title ?? '',
    notes: options.notes ?? '',
    status: options.status ?? 'todo',
    urgency: options.urgency ?? 'low',
    importance: options.importance ?? 'low',
    start: options.start ?? null,
    end: options.end ?? null,
    allDay: options.allDay ?? true,
    dueAt: options.dueAt ?? options.start ?? null,
    recurrence: options.recurrence ?? defaultRecurrenceFor(options.kind),
    tags: options.tags ?? [],
    listId: options.listId ?? null,
    parentId: options.parentId ?? null,
    order: options.order ?? 0,
    reminders: options.reminders ?? [],
    checklist: options.checklist ?? [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archivedAt: null,
    history: [],
    occurrences: {},
    data: { ...(defaultDataFor(options.kind) as object), ...(options.data ?? {}) },
  } as Item;
  return base;
}

/** Whether an item kind is schedulable on the calendar by default. */
export function isScheduledKind(kind: ItemKind): boolean {
  return kind === 'task' || kind === 'event' || kind === 'bill';
}

export function isRecurringKind(kind: ItemKind): boolean {
  return kind === 'habit' || kind === 'bill';
}

function normalizeRecurrence(value: unknown): BaseItem['recurrence'] {
  return isPlainObject(value) ? (value as unknown as BaseItem['recurrence']) : null;
}

/** Coerce a partial/imported item into a fully-formed Item without losing fields. */
export function normalizeItem(partial: Partial<Item>): Item {
  const shape = coerceItemShape(partial);
  const kind = shape.kind;
  const base = createItem({
    kind,
    title: partial.title ?? '',
    notes: partial.notes ?? '',
    status: shape.status,
    urgency: shape.urgency,
    importance: shape.importance,
    start: partial.start ?? null,
    end: partial.end ?? null,
    allDay: partial.allDay ?? true,
    dueAt: partial.dueAt ?? null,
    listId: partial.listId ?? null,
    parentId: partial.parentId ?? null,
    tags: shape.tags,
    reminders: shape.reminders,
    checklist: shape.checklist,
    order: partial.order ?? 0,
  });
  return {
    ...base,
    ...partial,
    id: partial.id ?? base.id,
    kind,
    status: shape.status,
    urgency: shape.urgency,
    importance: shape.importance,
    tags: shape.tags,
    reminders: shape.reminders,
    checklist: shape.checklist,
    recurrence: normalizeRecurrence(partial.recurrence),
    createdAt: partial.createdAt ?? base.createdAt,
    updatedAt: partial.updatedAt ?? base.updatedAt,
    completedAt: partial.completedAt ?? null,
    archivedAt: partial.archivedAt ?? null,
    history: Array.isArray(partial.history) ? partial.history : [],
    occurrences: shape.occurrences,
    data: {
      ...(defaultDataFor(kind) as object),
      ...(isPlainObject(partial.data) ? partial.data : {}),
    },
  } as Item;
}
