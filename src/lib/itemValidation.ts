import { ITEM_KINDS, ITEM_STATUSES } from '@/types';
import type { ChecklistEntry, Item, ItemKind, ItemStatus, Priority, Reminder } from '@/types';

export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === 'string' && (ITEM_KINDS as string[]).includes(value);
}

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === 'string' && (ITEM_STATUSES as string[]).includes(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asPriority(value: unknown): Priority {
  return value === 'high' ? 'high' : 'low';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter(isPlainObject) as T[]) : [];
}

function asOccurrences(value: unknown): Item['occurrences'] {
  return isPlainObject(value) ? (value as Item['occurrences']) : {};
}

export interface ItemShape {
  kind: ItemKind;
  status: ItemStatus;
  urgency: Priority;
  importance: Priority;
  reminders: Reminder[];
  tags: string[];
  checklist: ChecklistEntry[];
  occurrences: Item['occurrences'];
}

/** Coerce the untrusted parts of an item into their expected runtime types. */
export function coerceItemShape(input: unknown): ItemShape {
  const source = isPlainObject(input) ? input : {};
  return {
    kind: isItemKind(source.kind) ? source.kind : 'task',
    status: isItemStatus(source.status) ? source.status : 'todo',
    urgency: asPriority(source.urgency),
    importance: asPriority(source.importance),
    reminders: asObjectArray<Reminder>(source.reminders),
    tags: asStringArray(source.tags),
    checklist: asObjectArray<ChecklistEntry>(source.checklist),
    occurrences: asOccurrences(source.occurrences),
  };
}

export type ItemValidation = { ok: true; shape: ItemShape } | { ok: false; reason: string };

/** Reject values that cannot become an item; otherwise return the coerced shape. */
export function validateItem(input: unknown): ItemValidation {
  if (!isPlainObject(input)) return { ok: false, reason: 'not an object' };
  if (typeof input.id !== 'string' || input.id.trim() === '') {
    return { ok: false, reason: 'missing id' };
  }
  return { ok: true, shape: coerceItemShape(input) };
}
