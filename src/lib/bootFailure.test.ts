// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/store/useUiStore';
import { reportBootFailure } from './bootFailure';

beforeEach(() => {
  useUiStore.setState({ toasts: [] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reportBootFailure', () => {
  it('shows a persistent error toast without exposing the error text', () => {
    reportBootFailure(
      'Local storage is unavailable — changes may not be saved.',
      new Error('secret'),
    );

    const toast = useUiStore.getState().toasts.at(-1);
    expect(toast).toMatchObject({
      message: 'Local storage is unavailable — changes may not be saved.',
      tone: 'error',
      duration: 0,
      actionLabel: 'Reload',
    });
    expect(JSON.stringify(useUiStore.getState().toasts)).not.toContain('secret');
  });

  it('reports each distinct failure only once', () => {
    reportBootFailure('Offline support could not start.', new Error('first'));
    reportBootFailure('Offline support could not start.', new Error('second'));

    expect(useUiStore.getState().toasts).toHaveLength(1);
  });
});
