import type { Item, List } from '@/types';

export interface SyncSnapshot {
  items: Item[];
  lists: List[];
  updatedAt: number;
}

/**
 * The seam a future sync backend plugs into. Nothing in the app calls this
 * except `LocalOnlyAdapter` today, so adding a remote adapter requires no
 * changes to features or repositories.
 */
export interface SyncAdapter {
  readonly id: string;
  readonly label: string;
  isAvailable(): boolean;
  pull(): Promise<SyncSnapshot | null>;
  push(snapshot: SyncSnapshot): Promise<void>;
  subscribe?(onChange: () => void): () => void;
}

/** Default adapter: there is no remote; IndexedDB is the source of truth. */
export class LocalOnlyAdapter implements SyncAdapter {
  readonly id = 'local-only';
  readonly label = 'This device only';

  isAvailable(): boolean {
    return true;
  }

  async pull(): Promise<SyncSnapshot | null> {
    return null;
  }

  async push(): Promise<void> {
    // Intentionally a no-op. Local writes already persisted to IndexedDB.
  }
}

export const localOnlyAdapter: SyncAdapter = new LocalOnlyAdapter();
