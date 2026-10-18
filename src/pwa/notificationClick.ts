export interface NotificationClickData {
  itemId?: string;
  occKey?: string;
}

export interface NotificationClickPayload {
  type: 'OPEN_ITEM';
  itemId?: string;
  occKey?: string;
  action?: string;
}

export interface NotificationLike {
  data?: unknown;
  close(): void;
}

export interface WindowClientLike {
  focus(): Promise<unknown>;
  postMessage(message: unknown): void;
}

export interface ClientsLike {
  matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<WindowClientLike[]>;
  openWindow(url: string): Promise<unknown>;
}

/**
 * The body of the service worker's `notificationclick` handler. Extracted from `sw.ts` so the
 * focus/postMessage vs. openWindow branch is unit-testable without a service-worker global.
 */
export async function handleNotificationClick(
  clients: ClientsLike,
  notification: NotificationLike,
  action: string | undefined,
): Promise<void> {
  const data = (notification.data ?? {}) as NotificationClickData;
  notification.close();

  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const payload: NotificationClickPayload = {
    type: 'OPEN_ITEM',
    itemId: data.itemId,
    occKey: data.occKey,
    action,
  };
  if (windowClients.length > 0) {
    const client = windowClients[0];
    await client.focus();
    client.postMessage(payload);
  } else {
    await clients.openWindow('./');
  }
}
