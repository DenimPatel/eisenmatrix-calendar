// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_UNAVAILABLE_MESSAGE } from '@/lib/bootFailure';
import { useUiStore } from '@/store/useUiStore';

interface RegisterOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisterError?: (error: unknown) => void;
}

const pwa = vi.hoisted(() => ({
  updateSW: vi.fn(async () => undefined),
  options: null as RegisterOptions | null,
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: RegisterOptions) => {
    pwa.options = options;
    return pwa.updateSW;
  },
}));

import { setupPWA } from './register';

function removeServiceWorker(): void {
  Reflect.deleteProperty(navigator, 'serviceWorker');
}

function stubServiceWorker(): void {
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} });
}

beforeEach(() => {
  pwa.options = null;
  pwa.updateSW.mockClear();
  useUiStore.setState({ toasts: [] });
});

afterEach(() => {
  removeServiceWorker();
  useUiStore.setState({ toasts: [] });
});

describe('setupPWA', () => {
  it('does not register when the navigator has no service worker', () => {
    removeServiceWorker();
    setupPWA();
    expect(pwa.options).toBeNull();
  });

  it('registers immediately with all lifecycle callbacks', () => {
    stubServiceWorker();
    setupPWA();

    expect(pwa.options?.immediate).toBe(true);
    expect(pwa.options?.onNeedRefresh).toBeTypeOf('function');
    expect(pwa.options?.onOfflineReady).toBeTypeOf('function');
    expect(pwa.options?.onRegisterError).toBeTypeOf('function');
  });

  it('offers a Reload toast on refresh that reloads through the updater', async () => {
    stubServiceWorker();
    setupPWA();

    pwa.options?.onNeedRefresh?.();

    const [toast] = useUiStore.getState().toasts;
    expect(toast.message).toBe('A new version is available');
    expect(toast.tone).toBe('info');
    expect(toast.actionLabel).toBe('Reload');
    expect(toast.duration).toBe(0);

    await toast.onAction?.();
    expect(pwa.updateSW).toHaveBeenCalledWith(true);
  });

  it('announces offline readiness with a success toast', () => {
    stubServiceWorker();
    setupPWA();

    pwa.options?.onOfflineReady?.();

    const [toast] = useUiStore.getState().toasts;
    expect(toast.message).toBe('Ready to work offline');
    expect(toast.tone).toBe('success');
  });

  it('reports a registration error through the boot-failure path', () => {
    stubServiceWorker();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    setupPWA();

    pwa.options?.onRegisterError?.(new Error('boom'));

    const [toast] = useUiStore.getState().toasts;
    expect(toast.message).toBe(OFFLINE_UNAVAILABLE_MESSAGE);
    expect(toast.tone).toBe('error');
    expect(error).toHaveBeenCalledWith(OFFLINE_UNAVAILABLE_MESSAGE, expect.any(Error));
    error.mockRestore();
  });
});
