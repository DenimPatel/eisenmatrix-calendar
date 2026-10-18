import { useUiStore } from '@/store/useUiStore';
import { traceFailure, type FailureLevel } from './failureTrace';

const reported = new Set<string>();

/** Clears the dedupe memory; tests use it to isolate the once-per-message toast. */
export function resetReportedFailures(): void {
  reported.clear();
}

export interface ReportFailureOptions {
  /** Console channel for the trace; defaults to `warn`. */
  level?: FailureLevel;
  /** When false, emit only the console trace and skip the toast (blocked-storage passes). */
  toast?: boolean;
  tone?: 'info' | 'error';
}

/**
 * Surface a previously swallowed failure: leave a short, PII-limited console trace, and by
 * default raise one deduped toast so a user-impacting loss is visible without a retry loop
 * spamming the same message.
 */
export function reportFailure(
  message: string,
  error?: unknown,
  { level = 'warn', toast = true, tone = 'error' }: ReportFailureOptions = {},
): void {
  traceFailure(message, error, level);
  if (!toast || reported.has(message)) return;
  reported.add(message);
  useUiStore.getState().pushToast({ message, tone });
}
