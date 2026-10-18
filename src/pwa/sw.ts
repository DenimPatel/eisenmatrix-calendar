/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { handleNotificationClick } from './notificationClick';

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
  event.waitUntil(handleNotificationClick(self.clients, event.notification, event.action));
});
