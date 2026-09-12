/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute((self as unknown as { __WB_MANIFEST: unknown[] }).__WB_MANIFEST || []);

self.addEventListener('install', () => {
  // Wait for an explicit SKIP_WAITING message so the app can prompt the user.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = (notification.data ?? {}) as { itemId?: string; occKey?: string };
  const action = event.action;
  notification.close();

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const payload = { type: 'OPEN_ITEM', itemId: data.itemId, occKey: data.occKey, action };
      if (windowClients.length > 0) {
        const client = windowClients[0];
        await client.focus();
        client.postMessage(payload);
      } else {
        await self.clients.openWindow('./');
      }
    })(),
  );
});
