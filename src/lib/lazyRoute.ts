import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'eisenmatrix:chunk-reload';

// In-memory fallback for the reload guard. It dedupes chunk failures within the same
// document even when sessionStorage is unavailable or throws.
let reloadAttempted = false;

function storageIsWritable(): boolean {
  try {
    const probe = `${RELOAD_FLAG}:probe`;
    sessionStorage.setItem(probe, '1');
    sessionStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function alreadyReloaded(): boolean {
  if (reloadAttempted) return true;
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * Decide whether a failed chunk import should trigger the one-shot reload.
 *
 * Returns false when we already reloaded, and also when the guard cannot be persisted
 * because sessionStorage is blocked (private mode / embedded webview). In that case the
 * caller throws so the route error boundary shows, instead of reloading forever.
 */
export function shouldReloadChunk(): boolean {
  if (alreadyReloaded()) return false;
  reloadAttempted = true;
  if (!storageIsWritable()) return false;
  try {
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    return false;
  }
  return true;
}

export function clearChunkReloadGuard(): void {
  reloadAttempted = false;
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // sessionStorage can be unavailable (private mode, embedded webview).
  }
}

/**
 * `React.lazy` for route chunks. A deploy that replaces the hashed chunks can 404 a chunk
 * that an already-open tab still references, so the first failure reloads once to pick up
 * the new build. A second failure, or a failure while the guard cannot be persisted,
 * throws to the route error boundary instead of reloading in a loop.
 */
export function lazyRoute(factory: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      const module = await factory();
      clearChunkReloadGuard();
      return module;
    } catch (error) {
      if (shouldReloadChunk() && typeof window !== 'undefined') {
        window.location.reload();
        await new Promise<never>(() => {});
      }
      throw error;
    }
  });
}
