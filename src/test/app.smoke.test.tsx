// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App, { type BootEffects } from '@/App';
import { LEGACY_MIGRATION_KEY } from '@/db/migrations/legacyTasks';
import { NOTIFICATION_GATE_MIGRATION_KEY } from '@/db/migrations/notificationGate';
import { getDb } from '@/db/schema';

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    },
  });

  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: { permission: 'granted' },
  });
});

describe('App', () => {
  it('mounts, renders the Today dashboard shell, and completes the boot migrations', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let bootEffects: BootEffects | undefined;

    await act(async () => {
      root.render(
        <App
          onBootEffects={(effects) => {
            bootEffects = effects;
          }}
        />,
      );
    });

    expect(bootEffects).toBeDefined();
    await act(async () => {
      await bootEffects!.legacy;
      await bootEffects!.notificationGate;
    });

    expect(host.textContent).toBeTruthy();
    expect(host.textContent).toContain('EisenMatrix');

    const db = getDb();
    const legacyMarker = await db.settings.get(LEGACY_MIGRATION_KEY);
    expect(legacyMarker?.value).toMatchObject({ version: 1, count: 0 });
    const gateMarker = await db.settings.get(NOTIFICATION_GATE_MIGRATION_KEY);
    expect(gateMarker?.value).toMatchObject({ version: 1 });
    const appSettings = await db.settings.get('app');
    expect(appSettings?.value).toMatchObject({ notificationsEnabled: true });

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
