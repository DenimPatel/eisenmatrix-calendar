// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DATABASE_UNAVAILABLE_MESSAGE } from '@/lib/bootFailure';
import { useUiStore } from '@/store/useUiStore';
import { useTheme } from './useTheme';
import { db } from '@/db/schema';

const repo = vi.hoisted(() => ({ getRejects: false }));

vi.mock('@/db/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/repository')>();
  return {
    ...actual,
    settingsRepo: {
      ...actual.settingsRepo,
      get: (async (...args: unknown[]) => {
        if (repo.getRejects) throw new Error('database is blocked');
        return (actual.settingsRepo.get as (...a: unknown[]) => Promise<unknown>)(...args);
      }) as typeof actual.settingsRepo.get,
    },
  };
});

function Probe() {
  useTheme();
  return null;
}

async function flush(turns = 8): Promise<void> {
  for (let turn = 0; turn < turns; turn++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

let root: Root | undefined;

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
});

beforeEach(() => {
  repo.getRejects = false;
  useUiStore.setState({ toasts: [] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = undefined;
  }
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.delete();
});

describe('useTheme theme-load failure', () => {
  it('toasts the database-naming message when reading the theme fails', async () => {
    repo.getRejects = true;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root!.render(<Probe />);
    });
    await flush();

    const messages = useUiStore.getState().toasts.map((t) => t.message);
    expect(messages).toContain(DATABASE_UNAVAILABLE_MESSAGE);
    expect(messages.join(' ')).not.toContain('local storage');
  });

  it('does not toast when the theme loads', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root!.render(<Probe />);
    });
    await flush();

    const messages = useUiStore.getState().toasts.map((t) => t.message);
    expect(messages).not.toContain(DATABASE_UNAVAILABLE_MESSAGE);
  });
});
