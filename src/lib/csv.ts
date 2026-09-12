import type { Item } from '@/types';

/** RFC-4180 CSV serialiser. Handles quotes, commas and newlines. */
export function toCSV(rows: Record<string, unknown>[], headers?: string[]): string {
  const cols = headers ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [cols.map(escape).join(',')];
  for (const row of rows) lines.push(cols.map((col) => escape(row[col])).join(','));
  return lines.join('\r\n');
}

/**
 * Quote-aware CSV parser. Splits records on real newlines only, so
 * multi-line quoted fields survive the round-trip.
 */
export function parseCSV(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ',') {
      pushField();
      i++;
      continue;
    }
    if (char === '\r') {
      i++;
      continue;
    }
    if (char === '\n') {
      pushRecord();
      i++;
      continue;
    }
    field += char;
    i++;
  }
  // Final field/record if the file did not end with a newline.
  if (field.length > 0 || record.length > 0) pushRecord();

  return records.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const CSV_COLUMNS = [
  'id',
  'kind',
  'title',
  'notes',
  'status',
  'urgency',
  'importance',
  'start',
  'end',
  'allDay',
  'dueAt',
  'recurrence',
  'tags',
  'listId',
  'parentId',
  'order',
  'reminders',
  'checklist',
  'createdAt',
  'updatedAt',
  'completedAt',
  'archivedAt',
  'history',
  'occurrences',
  'legacy',
  'data',
];

export function itemsToCSV(items: Item[]): string {
  return toCSV(items as unknown as Record<string, unknown>[], CSV_COLUMNS);
}

function safeJSON<T>(value: string, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function csvToItems(text: string): Partial<Item>[] {
  const records = parseCSV(text);
  if (records.length < 2) return [];
  const [header, ...rows] = records;
  const index = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

  return rows.map((row) => {
    const get = (key: string) => {
      const i = index[key];
      return i === undefined ? '' : (row[i] ?? '');
    };
    const item: Record<string, unknown> = {
      id: get('id') || undefined,
      kind: get('kind') || 'task',
      title: get('title'),
      notes: get('notes'),
      status: get('status') || 'todo',
      urgency: get('urgency') || 'low',
      importance: get('importance') || 'low',
      start: get('start') || null,
      end: get('end') || null,
      allDay: get('allDay') === 'true' || get('allDay') === '1',
      dueAt: get('dueAt') || null,
      recurrence: safeJSON(get('recurrence'), null),
      tags: safeJSON(get('tags'), []),
      listId: get('listId') || null,
      parentId: get('parentId') || null,
      order: Number(get('order')) || 0,
      reminders: safeJSON(get('reminders'), []),
      checklist: safeJSON(get('checklist'), []),
      createdAt: Number(get('createdAt')) || Date.now(),
      updatedAt: Number(get('updatedAt')) || Date.now(),
      completedAt: get('completedAt') ? Number(get('completedAt')) : null,
      archivedAt: get('archivedAt') ? Number(get('archivedAt')) : null,
      history: safeJSON(get('history'), []),
      occurrences: safeJSON(get('occurrences'), {}),
      data: safeJSON(get('data'), {}),
    };
    const legacyRaw = get('legacy');
    if (legacyRaw) item.legacy = safeJSON(legacyRaw, undefined);
    return item as Partial<Item>;
  });
}
