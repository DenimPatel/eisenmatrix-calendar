import { newId } from './id';
import type { Item, List } from '@/types';

export const BACKUP_VERSION = 2;

export interface BackupPayload {
  app: 'eisenmatrix';
  version: number;
  exportedAt: string;
  items: Item[];
  lists: List[];
}

export function buildBackup(items: Item[], lists: List[]): BackupPayload {
  return {
    app: 'eisenmatrix',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    lists,
  };
}

export function backupToJSON(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

export interface ParsedBackup {
  items: Item[];
  lists: List[];
  exportedAt: string | null;
  version: number;
}

export function parseBackup(json: string): ParsedBackup {
  const parsed = JSON.parse(json) as Partial<BackupPayload> & { tasks?: Item[] };
  const items = Array.isArray(parsed.items)
    ? parsed.items
    : Array.isArray(parsed.tasks)
      ? parsed.tasks
      : [];
  const lists = Array.isArray(parsed.lists) ? parsed.lists : [];
  if (!Array.isArray(items)) throw new Error('Backup does not contain an items array');
  return {
    items: items.filter((i) => i && typeof i === 'object' && 'id' in i) as Item[],
    lists: lists as List[],
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    version: typeof parsed.version === 'number' ? parsed.version : 1,
  };
}

export type ImportStrategy = 'skip' | 'overwrite' | 'duplicate';

export interface MergeResult {
  toPut: Item[];
  skipped: number;
  overwritten: number;
  duplicated: number;
}

/** Resolve an import against existing items by id. */
export function mergeImportedItems(
  existing: Item[],
  incoming: Item[],
  strategy: ImportStrategy,
): MergeResult {
  const existingIds = new Set(existing.map((i) => i.id));
  const toPut: Item[] = [];
  let skipped = 0;
  let overwritten = 0;
  let duplicated = 0;

  for (const item of incoming) {
    if (existingIds.has(item.id)) {
      if (strategy === 'skip') {
        skipped++;
        continue;
      }
      if (strategy === 'overwrite') {
        overwritten++;
        toPut.push(item);
        continue;
      }
      duplicated++;
      toPut.push({ ...item, id: newId() });
      continue;
    }
    toPut.push(item);
  }

  return { toPut, skipped, overwritten, duplicated };
}

export function downloadFile(filename: string, content: string | Blob, mime = 'text/plain'): void {
  const blob =
    typeof content === 'string' ? new Blob([content], { type: `${mime};charset=utf-8` }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve((event.target?.result as string) ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function timestampedName(prefix: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.${extension}`;
}
