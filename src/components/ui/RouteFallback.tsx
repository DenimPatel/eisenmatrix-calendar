import { LoaderCircle } from 'lucide-react';

/**
 * Suspense fallback for lazily-loaded route chunks. Reserves vertical space so swapping
 * in the real view does not shift the shell, and announces the pending state to
 * assistive technology without stealing focus.
 */
export function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-muted"
    >
      <LoaderCircle className="motion-safe:animate-spin" size={24} aria-hidden="true" />
      <span className="text-sm">Loading view…</span>
    </div>
  );
}
