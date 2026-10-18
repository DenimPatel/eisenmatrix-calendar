// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  notificationPermission,
  requestNotificationPermission,
  sendSkipWaiting,
  showAppNotification,
} from './notifications';

interface NotificationInstance {
  title: string;
  options?: unknown;
}

function stubNotification(permission: NotificationPermission): {
  instances: NotificationInstance[];
  requestPermission: ReturnType<typeof vi.fn>;
} {
  const instances: NotificationInstance[] = [];
  const requestPermission = vi.fn(async () => permission);
  function NotificationCtor(this: unknown, title: string, options?: unknown): void {
    instances.push({ title, options });
  }
  const Ctor = NotificationCtor as unknown as {
    permission: NotificationPermission;
    requestPermission: typeof requestPermission;
  };
  Ctor.permission = permission;
  Ctor.requestPermission = requestPermission;
  vi.stubGlobal('Notification', Ctor);
  return { instances, requestPermission };
}

function stubServiceWorker(getRegistration: () => Promise<unknown>): {
  getRegistration: ReturnType<typeof vi.fn>;
} {
  const serviceWorker = { getRegistration: vi.fn(getRegistration) };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
  return serviceWorker;
}

function removeServiceWorker(): void {
  Reflect.deleteProperty(navigator, 'serviceWorker');
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.unstubAllGlobals();
  removeServiceWorker();
});

describe('notificationPermission', () => {
  it('reports unsupported when the Notification API is missing', () => {
    vi.stubGlobal('Notification', undefined);
    expect(notificationPermission()).toBe('unsupported');
  });

  it('reflects the browser permission when the API exists', () => {
    stubNotification('granted');
    expect(notificationPermission()).toBe('granted');
  });
});

describe('requestNotificationPermission', () => {
  it('returns unsupported without touching the API when it is missing', async () => {
    vi.stubGlobal('Notification', undefined);
    await expect(requestNotificationPermission()).resolves.toBe('unsupported');
  });

  it('returns the resolved permission state', async () => {
    const { requestPermission } = stubNotification('default');
    await expect(requestNotificationPermission()).resolves.toBe('default');
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });
});

describe('showAppNotification', () => {
  it('returns false without calling anything when permission is not granted', async () => {
    const { instances } = stubNotification('denied');
    const registration = { showNotification: vi.fn(async () => undefined) };
    const sw = stubServiceWorker(async () => registration);

    await expect(showAppNotification('Title')).resolves.toBe(false);

    expect(sw.getRegistration).not.toHaveBeenCalled();
    expect(registration.showNotification).not.toHaveBeenCalled();
    expect(instances).toHaveLength(0);
  });

  it('uses the service worker registration when one exists', async () => {
    stubNotification('granted');
    const registration = { showNotification: vi.fn(async () => undefined) };
    stubServiceWorker(async () => registration);

    const options = {
      body: 'Body',
      tag: 'tag',
      data: { itemId: 'x' },
      actions: [{ action: 'done', title: 'Done' }],
      requireInteraction: true,
    };
    await expect(showAppNotification('Title', options)).resolves.toBe(true);

    expect(registration.showNotification).toHaveBeenCalledWith('Title', {
      ...options,
      icon: './pwa-192.svg',
      badge: './pwa-192.svg',
    });
  });

  it('falls back to the page Notification constructor when no registration exists', async () => {
    const { instances } = stubNotification('granted');
    stubServiceWorker(async () => undefined);

    await expect(
      showAppNotification('Title', { body: 'Body', tag: 'tag', data: { a: 1 } }),
    ).resolves.toBe(true);

    expect(instances).toEqual([
      { title: 'Title', options: { body: 'Body', tag: 'tag', data: { a: 1 } } },
    ]);
  });

  it('falls back to the constructor when the navigator has no service worker', async () => {
    const { instances } = stubNotification('granted');
    removeServiceWorker();

    await expect(showAppNotification('Title', { body: 'Body' })).resolves.toBe(true);

    expect(instances).toEqual([
      { title: 'Title', options: { body: 'Body', tag: undefined, data: undefined } },
    ]);
  });

  it('returns false, never throws, when the service worker rejects', async () => {
    stubNotification('granted');
    stubServiceWorker(async () => ({
      showNotification: vi.fn(async () => {
        throw new Error('registration failed');
      }),
    }));

    await expect(showAppNotification('Title')).resolves.toBe(false);
  });

  it('returns false, never throws, when the constructor rejects', async () => {
    stubNotification('granted');
    removeServiceWorker();
    const throwing = function NotificationCtor(): void {
      throw new Error('constructor failed');
    };
    const Ctor = throwing as unknown as { permission: NotificationPermission };
    Ctor.permission = 'granted';
    vi.stubGlobal('Notification', Ctor);

    await expect(showAppNotification('Title')).resolves.toBe(false);
  });
});

describe('sendSkipWaiting', () => {
  it('does nothing when the navigator has no service worker', async () => {
    removeServiceWorker();
    expect(() => sendSkipWaiting()).not.toThrow();
    await flush();
  });

  it('does nothing when there is no registration', async () => {
    const sw = stubServiceWorker(async () => undefined);
    sendSkipWaiting();
    await flush();
    expect(sw.getRegistration).toHaveBeenCalledTimes(1);
  });

  it('posts SKIP_WAITING to a waiting worker', async () => {
    const postMessage = vi.fn();
    stubServiceWorker(async () => ({ waiting: { postMessage } }));

    sendSkipWaiting();
    await flush();

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('does not post when the registration has no waiting worker', async () => {
    const postMessage = vi.fn();
    stubServiceWorker(async () => ({ waiting: null, postMessage }));

    sendSkipWaiting();
    await flush();

    expect(postMessage).not.toHaveBeenCalled();
  });
});
