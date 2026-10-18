import { describe, expect, it, vi } from 'vitest';
import {
  handleNotificationClick,
  type ClientsLike,
  type NotificationLike,
  type WindowClientLike,
} from './notificationClick';

function fakeClient(): {
  client: WindowClientLike;
  focus: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
} {
  const focus = vi.fn(async () => undefined);
  const postMessage = vi.fn();
  return { client: { focus, postMessage }, focus, postMessage };
}

function fakeClients(windowClients: WindowClientLike[]): {
  clients: ClientsLike;
  matchAll: ReturnType<typeof vi.fn>;
  openWindow: ReturnType<typeof vi.fn>;
} {
  const matchAll = vi.fn(async () => windowClients);
  const openWindow = vi.fn(async () => null);
  return { clients: { matchAll, openWindow }, matchAll, openWindow };
}

function fakeNotification(data?: unknown): {
  notification: NotificationLike;
  close: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  return { notification: { data, close }, close };
}

describe('handleNotificationClick', () => {
  it('closes the notification and focuses the first window client with an OPEN_ITEM message', async () => {
    const { client, focus, postMessage } = fakeClient();
    const { clients, matchAll, openWindow } = fakeClients([client]);
    const { notification, close } = fakeNotification({ itemId: 'item-1', occKey: '2026-01-05' });

    await handleNotificationClick(clients, notification, 'done');

    expect(close).toHaveBeenCalledTimes(1);
    expect(matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      type: 'OPEN_ITEM',
      itemId: 'item-1',
      occKey: '2026-01-05',
      action: 'done',
    });
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens a new window when no client is open', async () => {
    const { clients, openWindow } = fakeClients([]);
    const { notification, close } = fakeNotification({ itemId: 'item-2', occKey: '2026-02-01' });

    await handleNotificationClick(clients, notification, undefined);

    expect(openWindow).toHaveBeenCalledWith('./');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('carries undefined identity fields and action when the notification has no data', async () => {
    const { client, postMessage } = fakeClient();
    const { clients } = fakeClients([client]);
    const { notification } = fakeNotification(undefined);

    await handleNotificationClick(clients, notification, undefined);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'OPEN_ITEM',
      itemId: undefined,
      occKey: undefined,
      action: undefined,
    });
  });

  it('uses only the first client when several windows are open', async () => {
    const first = fakeClient();
    const second = fakeClient();
    const { clients } = fakeClients([first.client, second.client]);

    await handleNotificationClick(
      clients,
      fakeNotification({ itemId: 'a' }).notification,
      'snooze-10',
    );

    expect(first.postMessage).toHaveBeenCalledTimes(1);
    expect(second.focus).not.toHaveBeenCalled();
    expect(second.postMessage).not.toHaveBeenCalled();
  });
});
