/**
 * Generate a stable, collision-resistant id.
 * Uses `crypto.randomUUID()` when available (all modern browsers + Node 19+).
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old environments.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
