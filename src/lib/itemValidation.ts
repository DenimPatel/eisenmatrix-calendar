import { ITEM_KINDS, ITEM_STATUSES } from '@/types';
import type {
  ChecklistEntry,
  Frequency,
  Item,
  ItemKind,
  ItemStatus,
  OccurrenceOverride,
  OccurrenceStatus,
  Priority,
  RecurrenceRule,
  Reminder,
} from '@/types';

const RECURRENCE_FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

const OCCURRENCE_STATUSES: OccurrenceStatus[] = ['todo', 'doing', 'done', 'cancelled'];

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

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
    : [];
}

function isOccurrenceStatus(value: unknown): value is OccurrenceStatus {
  return typeof value === 'string' && (OCCURRENCE_STATUSES as string[]).includes(value);
}

/**
 * Coerce one untrusted override entry, dropping unknown fields. Returns `null` when a known
 * field carries the wrong type so the caller can drop the whole override rather than apply a
 * partially-typed one to the occurrence engine.
 */
function asOccurrenceOverride(value: unknown): OccurrenceOverride | null {
  if (!isPlainObject(value)) return null;
  const out: OccurrenceOverride = {};
  if ('start' in value) {
    if (typeof value.start !== 'string') return null;
    out.start = value.start;
  }
  if ('end' in value) {
    if (value.end !== null && typeof value.end !== 'string') return null;
    out.end = value.end;
  }
  if ('allDay' in value) {
    if (typeof value.allDay !== 'boolean') return null;
    out.allDay = value.allDay;
  }
  if ('title' in value) {
    if (typeof value.title !== 'string') return null;
    out.title = value.title;
  }
  if ('notes' in value) {
    if (typeof value.notes !== 'string') return null;
    out.notes = value.notes;
  }
  if ('status' in value) {
    if (!isOccurrenceStatus(value.status)) return null;
    out.status = value.status;
  }
  return out;
}

function asOverrides(value: unknown): Record<string, OccurrenceOverride> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, OccurrenceOverride> = {};
  for (const [key, entry] of Object.entries(value)) {
    const override = asOccurrenceOverride(entry);
    if (override) out[key] = override;
  }
  return out;
}

function isFrequency(value: unknown): value is Frequency {
  return typeof value === 'string' && (RECURRENCE_FREQUENCIES as string[]).includes(value);
}

export type RecurrenceCoercion =
  { ok: true; rule: RecurrenceRule | null } | { ok: false; reason: string };

/**
 * Coerce an untrusted value into a complete `RecurrenceRule`. An absent or non-object value
 * becomes `null` (no recurrence); a rule with an unknown/missing `freq` is flagged so the
 * importing seam can reject the row instead of letting it fall through to the yearly branch.
 */
export function coerceRecurrence(value: unknown): RecurrenceCoercion {
  if (value === undefined || value === null || !isPlainObject(value)) {
    return { ok: true, rule: null };
  }
  if (!isFrequency(value.freq)) {
    return { ok: false, reason: `invalid recurrence frequency "${String(value.freq)}"` };
  }
  const interval = typeof value.interval === 'number' ? value.interval : Number(value.interval);
  const rule: RecurrenceRule = {
    freq: value.freq,
    interval: Number.isFinite(interval) && interval >= 1 ? Math.floor(interval) : 1,
    weekStartsOn: value.weekStartsOn === 0 ? 0 : 1,
    exceptions: asStringArray(value.exceptions),
    overrides: asOverrides(value.overrides),
  };
  const byWeekday = asNumberArray(value.byWeekday);
  if (byWeekday.length) rule.byWeekday = byWeekday;
  const byMonthDay = asNumberArray(value.byMonthDay);
  if (byMonthDay.length) rule.byMonthDay = byMonthDay;
  const byMonth = asNumberArray(value.byMonth);
  if (byMonth.length) rule.byMonth = byMonth;
  if (typeof value.count === 'number' && Number.isFinite(value.count) && value.count >= 0) {
    rule.count = Math.floor(value.count);
  }
  if (typeof value.until === 'string' || value.until === null) rule.until = value.until;
  return { ok: true, rule };
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
  recurrence: RecurrenceRule | null;
}

/** Coerce the untrusted parts of an item into their expected runtime types. */
export function coerceItemShape(input: unknown): ItemShape {
  const source = isPlainObject(input) ? input : {};
  const recurrence = coerceRecurrence(source.recurrence);
  return {
    kind: isItemKind(source.kind) ? source.kind : 'task',
    status: isItemStatus(source.status) ? source.status : 'todo',
    urgency: asPriority(source.urgency),
    importance: asPriority(source.importance),
    reminders: asObjectArray<Reminder>(source.reminders),
    tags: asStringArray(source.tags),
    checklist: asObjectArray<ChecklistEntry>(source.checklist),
    occurrences: asOccurrences(source.occurrences),
    recurrence: recurrence.ok ? recurrence.rule : null,
  };
}

export type ItemValidation = { ok: true; shape: ItemShape } | { ok: false; reason: string };

/** Reject values that cannot become an item; otherwise return the coerced shape. */
export function validateItem(input: unknown): ItemValidation {
  if (!isPlainObject(input)) return { ok: false, reason: 'not an object' };
  if (typeof input.id !== 'string' || input.id.trim() === '') {
    return { ok: false, reason: 'missing id' };
  }
  const recurrence = coerceRecurrence(input.recurrence);
  if (!recurrence.ok) return { ok: false, reason: recurrence.reason };
  return { ok: true, shape: coerceItemShape(input) };
}
