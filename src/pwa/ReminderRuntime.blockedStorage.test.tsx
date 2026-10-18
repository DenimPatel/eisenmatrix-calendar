// @vitest-environment jsdom
/**
 * The runtime's boot passes read storage that may be unavailable. A rejected pass has to
 * degrade quietly: the boot already reports the storage failure once, so it must not become an
 * unhandled rejection or a repeated toast. `pruneItemReminders` is wrapped so the async prune
 * can reject without breaking the live item query that drives the delivery tick.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/schema';
import { itemRepo, reminderFailureRepo, reminderLogRepo } from '@/db/repository';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import { formatISODate } from '@/lib/date';
import { useUiStore } from '@/store/useUiStore';
import type { Item, Reminder } from '@/types';
import { ReminderRuntime } from './ReminderRuntime';

const prune = vi.hoisted(() => ({ calls: 0, reject: false }));

vi.mock('@/domain/itemActions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/itemActions')>();
  return {
    ...actual,
    pruneItemReminders: async (...args: Parameters<typeof actual.pruneItemReminders>) => {
      prune.calls += 1;
      if (prune.reject) throw new Error('database is blocked');
      return actual.pruneItemReminders(...args);
    },
  };
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SETTLE_ATTEMPTS = 150;

async function actRounds(rounds: number): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
    });
  }
}

async function settleUntil(assertion: () => void): Promise<void> {
  let failure: unknown;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    await actRounds(1);
    try {
      assertion();
      return;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

async function mountRuntime(): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<ReminderRuntime />);
  });
}

function probeItem(id: string, reminders: Reminder[] = []): Item {
  return normalizeItem({
    ...createItem({ kind: 'task', title: id, start: formatISODate(new Date()) }),
    id,
    reminders,
  });
}

/** Captures unhandled rejections for the duration of `body`. */
async function withUnhandledRejectionCapture(body: (unhandled: unknown[]) => Promise<void>) {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    await body(unhandled);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  await db.reminderLog.clear();
  await db.reminderFailures.clear();
  useUiStore.setState({ toasts: [] });
  prune.calls = 0;
  prune.reject = false;
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (root) await act(async () => void root!.unmount());
  root = null;
  host?.remove();
  host = null;
});

afterAll(async () => {
  await db.delete();
});

describe('ReminderRuntime blocked-storage async paths', () => {
  it('swallows rejected prune passes without an unhandled rejection or a toast', async () => {
    await itemRepo.create(probeItem('probe'));
    const blocked = new Error('database is blocked');
    vi.spyOn(reminderLogRepo, 'pruneBefore').mockRejectedValue(blocked);
    vi.spyOn(reminderFailureRepo, 'pruneBefore').mockRejectedValue(blocked);
    prune.reject = true;

    await withUnhandledRejectionCapture(async (unhandled) => {
      await mountRuntime();
      // Both the fire-and-forget prunes and the gated async prune really ran and rejected.
      await settleUntil(() => expect(prune.calls).toBeGreaterThan(0));
      await actRounds(10);

      expect(unhandled).toEqual([]);
      expect(useUiStore.getState().toasts).toEqual([]);
    });
  });

  it('swallows a rejected pending-undelivered count without an unhandled rejection or a toast', async () => {
    await itemRepo.create(probeItem('probe'));
    vi.spyOn(reminderFailureRepo, 'count').mockRejectedValue(new Error('database is blocked'));

    await withUnhandledRejectionCapture(async (unhandled) => {
      await mountRuntime();
      await settleUntil(() => expect(reminderFailureRepo.count).toHaveBeenCalled());
      await actRounds(10);

      expect(unhandled).toEqual([]);
      expect(useUiStore.getState().toasts).toEqual([]);
    });
  });

  it('still prunes and stays quiet when storage is available', async () => {
    await itemRepo.create(
      probeItem('stale', [{ id: 'old', absolute: Date.now() - 48 * 60 * 60_000, label: 'old' }]),
    );

    await mountRuntime();
    await settleUntil(() => expect(prune.calls).toBeGreaterThan(0));
    await actRounds(10);

    expect((await itemRepo.get('stale'))!.reminders).toEqual([]);
    expect(useUiStore.getState().toasts).toEqual([]);
  });
});
