import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/store/useUiStore';
import { reportFailure, resetReportedFailures } from './reportFailure';

beforeEach(() => {
  resetReportedFailures();
  useUiStore.setState({ toasts: [] });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reportFailure', () => {
  it('traces a sanitized error and raises one deduped toast', () => {
    reportFailure('Failure message one', new Error('secret-detail'));
    reportFailure('Failure message one', new Error('other-secret'));

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenNthCalledWith(1, 'Failure message one', 'Error: secret-detail');
    const toasts = useUiStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: 'Failure message one', tone: 'error' });
    expect(JSON.stringify(toasts)).not.toContain('secret-detail');
  });

  it('traces at debug and skips the toast when toast is false', () => {
    reportFailure('Quiet message two', new Error('x'), { level: 'debug', toast: false });

    expect(console.debug).toHaveBeenCalledWith('Quiet message two', 'Error: x');
    expect(console.warn).not.toHaveBeenCalled();
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it('omits the error detail when none is given', () => {
    reportFailure('Message three without error');

    expect(console.warn).toHaveBeenCalledWith('Message three without error', undefined);
    expect(useUiStore.getState().toasts).toHaveLength(1);
  });
});
