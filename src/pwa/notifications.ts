export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function notificationPermission(): NotificationPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  const result = await Notification.requestPermission();
  return result as NotificationPermissionState;
}

export interface AppNotificationOptions {
  body?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
}

/**
 * Prefer the service worker registration so notifications work when the app is
 * backgrounded; fall back to the page Notification constructor otherwise.
 */
export async function showAppNotification(
  title: string,
  options: AppNotificationOptions = {},
): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false;
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          body: options.body,
          tag: options.tag,
          data: options.data,
          actions: options.actions,
          requireInteraction: options.requireInteraction,
          icon: './pwa-192.svg',
          badge: './pwa-192.svg',
        } as unknown as NotificationOptions);
        return true;
      }
    }
    new Notification(title, { body: options.body, tag: options.tag, data: options.data });
    return true;
  } catch {
    return false;
  }
}

/** Ask the active service worker to activate a waiting update. */
export function sendSkipWaiting(): void {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.getRegistration().then((registration) => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  });
}
