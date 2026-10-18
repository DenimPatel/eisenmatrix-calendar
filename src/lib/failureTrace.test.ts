import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeFailure, traceFailure } from './failureTrace';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('describeFailure', () => {
  it('reduces an Error to its name and message only', () => {
    const error = new Error('boom');
    error.stack = 'at secret (file:///private/path.ts:1:1)';

    expect(describeFailure(error)).toBe('Error: boom');
    expect(describeFailure(new TypeError('bad'))).toBe('TypeError: bad');
  });

  it('passes strings through and normalizes other values', () => {
    expect(describeFailure('plain')).toBe('plain');
    expect(describeFailure({ secret: 'payload' })).toBe('Unknown error');
    expect(describeFailure(undefined)).toBeUndefined();
    expect(describeFailure(null)).toBeUndefined();
  });
});

describe('traceFailure', () => {
  it('logs the message and the sanitized error, never the raw object', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('boom');
    error.stack = 'at secret (file:///private/path.ts:1:1)';

    traceFailure('Something failed', error);

    expect(warn).toHaveBeenCalledWith('Something failed', 'Error: boom');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private/path');
  });

  it('uses the requested level and logs undefined when no error is given', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    traceFailure('Quiet', undefined, 'debug');

    expect(debug).toHaveBeenCalledWith('Quiet', undefined);
  });
});
