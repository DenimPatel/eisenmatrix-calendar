export type FailureLevel = 'debug' | 'warn';

/** A sink for a swallowed failure: a short message plus the originating error. */
export type FailureReporter = (message: string, error?: unknown) => void;

/**
 * Reduce an arbitrary thrown value to a short, PII-limited `Name: message` string.
 * The raw object (and any enumerable payload it carries) is never logged.
 */
export function describeFailure(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/** Console-only trace for a swallowed failure. No UI/store dependency, so `db` can use it. */
export function traceFailure(message: string, error?: unknown, level: FailureLevel = 'warn'): void {
  console[level](message, describeFailure(error));
}
