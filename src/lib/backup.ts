import { newId } from './id';
import { validateItem } from './itemValidation';
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
  invalid: number;
}

export function parseBackup(json: string): ParsedBackup {
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Not an EisenMatrix backup');
  }
  const payload = parsed as {
    app?: unknown;
    version?: unknown;
    exportedAt?: unknown;
    items?: unknown;
    tasks?: unknown;
    lists?: unknown;
  };
  // Backups predating the `app` marker carry no identity field, so only a
  // present-and-different value proves the file is from another producer.
  if (payload.app !== undefined && payload.app !== 'eisenmatrix') {
    throw new Error(`Not an EisenMatrix backup (found app "${String(payload.app)}")`);
  }
  const version = typeof payload.version === 'number' ? payload.version : 1;
  if (version > BACKUP_VERSION) {
    throw new Error(
      `Backup is format v${version}, but this app only imports up to v${BACKUP_VERSION}`,
    );
  }
  const hasItems = Array.isArray(payload.items);
  const hasTasks = Array.isArray(payload.tasks);
  if (!hasItems && !hasTasks) {
    throw new Error('Not an EisenMatrix backup (no items or tasks array)');
  }
  const rawItems = (hasItems ? payload.items : payload.tasks) as unknown[];
  const lists = Array.isArray(payload.lists) ? payload.lists : [];
  const items: Item[] = [];
  let invalid = 0;
  for (const raw of rawItems) {
    const validated = validateItem(raw);
    if (!validated.ok) {
      invalid++;
      continue;
    }
    items.push({ ...(raw as Partial<Item>), ...validated.shape } as Item);
  }
  return {
    items,
    lists: lists as List[],
    exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : null,
    version,
    invalid,
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

  // Pre-pass so a child can be remapped to its parent's new id even when the
  // parent appears later in the incoming array.
  const idMap = new Map<string, string>();
  if (strategy === 'duplicate') {
    for (const item of incoming) {
      if (existingIds.has(item.id) && !idMap.has(item.id)) idMap.set(item.id, newId());
    }
  }

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
      toPut.push({
        ...item,
        id: idMap.get(item.id) ?? newId(),
        parentId: item.parentId ? (idMap.get(item.parentId) ?? item.parentId) : item.parentId,
      });
      continue;
    }
    if (strategy === 'duplicate' && item.parentId && idMap.has(item.parentId)) {
      toPut.push({ ...item, parentId: idMap.get(item.parentId) ?? item.parentId });
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
