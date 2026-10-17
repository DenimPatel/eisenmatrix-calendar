// @vitest-environment jsdom
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SettingsView } from './SettingsView';
import { db } from '@/db/schema';
import { itemRepo, settingsRepo } from '@/db/repository';
import { useUiStore } from '@/store/useUiStore';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// `*Throws` separates "no failure configured" from "fail with this exact value", so the
// `undefined` and `null` rejection cases are reachable.
const picked = vi.hoisted(() => ({
  file: null as File | null,
  pickCalls: 0,
  readThrows: false,
  readError: undefined as unknown,
  pickThrows: false,
  pickError: undefined as unknown,
}));

vi.mock('@/lib/backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backup')>();
  return {
    ...actual,
    pickFile: async () => {
      picked.pickCalls += 1;
      if (picked.pickThrows) throw picked.pickError;
      return picked.file;
    },
    readTextFile: async (file: File) => {
      if (picked.readThrows) throw picked.readError;
      return actual.readTextFile(file);
    },
  };
});

const VALID_CSV = ['id,kind,title,status', 'csv-1,task,Imported task,todo', ''].join('\r\n');

interface Mounted {
  host: HTMLElement;
  root: Root;
}

async function mountSettings(): Promise<Mounted> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<SettingsView />);
  });
  return { host, root };
}

async function unmount({ host, root }: Mounted): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

/**
 * Flushes real macrotasks inside `act` so FileReader callbacks, Dexie writes and the
 * React commit that renders their result all run before the caller continues. A fixed
 * number of turns keeps this independent of machine load; nothing is asserted on it.
 */
async function drain(turns = 12): Promise<void> {
  for (let turn = 0; turn < turns; turn++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function clickImportCSV(host: HTMLElement): Promise<void> {
  const button = Array.from(host.querySelectorAll('button')).find(
    (el) => el.textContent?.trim() === 'Import CSV',
  );
  expect(button).toBeDefined();
  const before = picked.pickCalls;
  await act(async () => {
    button!.click();
  });
  await vi.waitFor(() => expect(picked.pickCalls).toBe(before + 1));
}

function messages(): string[] {
  return useUiStore.getState().toasts.map((t) => t.message);
}

function tones(): string[] {
  return useUiStore.getState().toasts.map((t) => t.tone);
}

beforeEach(async () => {
  await db.items.clear();
  picked.file = new File([VALID_CSV], 'items.csv', { type: 'text/csv' });
  picked.readThrows = false;
  picked.readError = undefined;
  picked.pickThrows = false;
  picked.pickError = undefined;
  picked.pickCalls = 0;
  useUiStore.setState({ theme: 'system', toasts: [], undoStack: [] });
});

afterEach(async () => {
  // Drain before restoring mocks so no import started by this test can land in the next one.
  await drain();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.delete();
});

describe('SettingsView CSV import', () => {
  it('reports the import and shows the summary on success', async () => {
    const mounted = await mountSettings();
    await clickImportCSV(mounted.host);

    await vi.waitFor(() => expect(messages()).toContain('CSV imported'));
    await vi.waitFor(async () => expect((await itemRepo.all()).length).toBe(1));
    await vi.waitFor(() => expect(mounted.host.textContent).toContain('Import complete'));
    await drain();

    expect(tones().every((tone) => tone !== 'error')).toBe(true);
    expect((await itemRepo.all()).map((i) => i.title)).toEqual(['Imported task']);
    await unmount(mounted);
  });

  it('shows an error toast and no success toast when the file cannot be read', async () => {
    picked.readThrows = true;
    picked.readError = new Error('could not read file');
    const mounted = await mountSettings();
    await clickImportCSV(mounted.host);

    await vi.waitFor(() => expect(messages()).toEqual(['Import failed: could not read file']));
    await drain();

    expect(tones()).toEqual(['error']);
    expect(mounted.host.textContent).not.toContain('Import complete');
    expect(await itemRepo.all()).toHaveLength(0);
    await unmount(mounted);
  });

  it('shows an error toast and no success toast when persisting fails', async () => {
    vi.spyOn(itemRepo, 'createMany').mockRejectedValue(new Error('database is full'));
    const mounted = await mountSettings();
    await clickImportCSV(mounted.host);

    await vi.waitFor(() => expect(messages()).toEqual(['Import failed: database is full']));
    await drain();

    expect(tones()).toEqual(['error']);
    expect(mounted.host.textContent).not.toContain('Import complete');
    await unmount(mounted);
  });

  it('shows an error toast when the file picker rejects', async () => {
    picked.pickThrows = true;
    picked.pickError = new Error('picker exploded');
    const mounted = await mountSettings();
    await clickImportCSV(mounted.host);

    await vi.waitFor(() => expect(messages()).toEqual(['Import failed: picker exploded']));
    await drain();

    expect(tones()).toEqual(['error']);
    expect(mounted.host.textContent).not.toContain('Import complete');
    await unmount(mounted);
  });

  it.each([
    ['null', null, 'Import failed: Unknown error'],
    ['undefined', undefined, 'Import failed: Unknown error'],
    ['a bare string', 'boom', 'Import failed: boom'],
    ['an object without a message', { code: 500 }, 'Import failed: Unknown error'],
    ['an Error subclass with an empty message', new RangeError(''), 'Import failed: Unknown error'],
  ])('always toasts when the failure value is %s', async (_label, value, expected) => {
    picked.readThrows = true;
    picked.readError = value;
    const mounted = await mountSettings();
    await clickImportCSV(mounted.host);

    await vi.waitFor(() => expect(messages()).toEqual([expected]));
    await drain();

    expect(tones()).toEqual(['error']);
    await unmount(mounted);
  });

  it('does not toast when the file picker is dismissed', async () => {
    picked.file = null;
    const mounted = await mountSettings();
    await clickImportCSV(mounted.host);
    await drain();

    expect(messages()).toEqual([]);
    expect(await itemRepo.all()).toHaveLength(0);
    await unmount(mounted);
  });
});

describe('SettingsView theme control', () => {
  function themeButton(host: HTMLElement, option: string): HTMLButtonElement {
    const button = Array.from(host.querySelectorAll('button')).find(
      (el) => el.textContent?.trim() === option,
    );
    expect(button).toBeDefined();
    return button!;
  }

  it('exposes aria-pressed for the selected theme and updates after choosing one', async () => {
    const mounted = await mountSettings();
    await drain();

    expect(themeButton(mounted.host, 'system').getAttribute('aria-pressed')).toBe('true');
    expect(themeButton(mounted.host, 'light').getAttribute('aria-pressed')).toBe('false');
    expect(themeButton(mounted.host, 'dark').getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      themeButton(mounted.host, 'dark').click();
    });

    expect(useUiStore.getState().theme).toBe('dark');
    expect(themeButton(mounted.host, 'dark').getAttribute('aria-pressed')).toBe('true');
    expect(themeButton(mounted.host, 'system').getAttribute('aria-pressed')).toBe('false');
    expect(themeButton(mounted.host, 'light').getAttribute('aria-pressed')).toBe('false');
    await unmount(mounted);
  });
});

describe('SettingsView device notifications', () => {
  function notificationsSwitch(host: HTMLElement): HTMLButtonElement {
    const control = host.querySelector<HTMLButtonElement>(
      '[role="switch"][aria-label="Device notifications"]',
    );
    expect(control).not.toBeNull();
    return control!;
  }

  async function storedNotifications(): Promise<boolean> {
    return (await settingsRepo.get<AppSettings>('app', DEFAULT_SETTINGS)).notificationsEnabled;
  }

  beforeEach(async () => {
    await db.settings.clear();
    vi.stubGlobal(
      'Notification',
      class {
        static permission = 'granted';
        static requestPermission = vi.fn(async () => 'granted');
      },
    );
  });

  it('explains that in-app banners are app-only and the switch is device notifications only', async () => {
    const mounted = await mountSettings();
    await drain();

    expect(mounted.host.textContent).toContain('While this app is open');
    expect(mounted.host.textContent).toContain('show as in-app banners');
    expect(mounted.host.textContent).toContain('this switch controls device');
    expect(mounted.host.textContent).not.toContain('always appear as in-app banners');
    expect(mounted.host.textContent).not.toContain('In-app banners always work');
    await unmount(mounted);
  });

  it('offers a single control: no duplicate Enable button next to the switch', async () => {
    const mounted = await mountSettings();
    await drain();

    expect(mounted.host.textContent).not.toContain('Enable');
    const buttons = Array.from(mounted.host.querySelectorAll('button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(buttons).not.toContain('Enable');
    expect(notificationsSwitch(mounted.host)).not.toBeNull();
    await unmount(mounted);
  });

  it('reflects the stored setting and persists turning device notifications off', async () => {
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, notificationsEnabled: true });
    const mounted = await mountSettings();
    await drain();

    const control = notificationsSwitch(mounted.host);
    expect(control.getAttribute('aria-checked')).toBe('true');

    await act(async () => {
      control.click();
    });
    await vi.waitFor(async () => expect(await storedNotifications()).toBe(false));
    await drain();
    expect(notificationsSwitch(mounted.host).getAttribute('aria-checked')).toBe('false');
    await unmount(mounted);
  });

  it.each([
    [
      'denied',
      'Browser blocked notifications — re-allow them for this site in your browser settings',
    ],
    ['default', 'Device notifications stay off without browser permission'],
  ])(
    'asks for browser permission when turned on and stays off if it is %s',
    async (result, expected) => {
      vi.stubGlobal(
        'Notification',
        class {
          static permission = 'default';
          static requestPermission = vi.fn(async () => result);
        },
      );
      const mounted = await mountSettings();
      await drain();

      await act(async () => {
        notificationsSwitch(mounted.host).click();
      });
      await drain();

      expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
      expect(await storedNotifications()).toBe(false);
      expect(messages()).toContain(expected);
      await unmount(mounted);
    },
  );

  it('enables the setting when the browser grants permission', async () => {
    const mounted = await mountSettings();
    await drain();

    await act(async () => {
      notificationsSwitch(mounted.host).click();
    });
    await drain();

    expect(await storedNotifications()).toBe(true);
    expect(notificationsSwitch(mounted.host).getAttribute('aria-checked')).toBe('true');
    expect(messages()).not.toContain('Device notifications stay off without browser permission');
    await unmount(mounted);
  });
});
