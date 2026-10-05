// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/schema';
import { itemRepo, settingsRepo } from '@/db/repository';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import { formatISODate } from '@/lib/date';
import { DEFAULT_SETTINGS, type Item } from '@/types';
import { ReminderRuntime } from './ReminderRuntime';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** The `notifyEnabled` value each delivery call received, in order. */
const gates = vi.hoisted(() => ({
  deliver: [] as Array<boolean | undefined>,
  digest: [] as boolean[],
}));

vi.mock('./delivery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./delivery')>();
  return {
    ...actual,
    deliver: async (...args: unknown[]) => {
      gates.deliver.push((args[6] as { notifyEnabled?: boolean } | undefined)?.notifyEnabled);
      return false;
    },
    deliverDigest: async (...args: unknown[]) => {
      gates.digest.push(
        (args[2] as { notifyEnabled?: boolean } | undefined)?.notifyEnabled === true,
      );
      return false;
    },
  };
});

function dueItem(): Item {
  const base = normalizeItem({
    ...createItem({ kind: 'task', title: 'IMP-021 gate probe', start: formatISODate(new Date()) }),
    id: 'gate-probe',
  });
  return { ...base, reminders: [{ id: 'r1', absolute: Date.now() - 1_000, label: 'probe' }] };
}

/** Let the live query, the render and the runtime tick settle. */
async function settle(rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/**
 * Flushes real macrotasks inside `act` until `assertion` passes. `useSetting`
 * serves `DEFAULT_SETTINGS` until the Dexie live query resolves, so how many
 * turns that takes is load-dependent: a fixed number of rounds races the first
 * tick, which legitimately sees the not-yet-resolved value. Re-running the
 * assertion until it settles makes the outcome deterministic; a genuinely
 * unmet expectation still fails, with its own message.
 */
const SETTLE_ATTEMPTS = 150;

async function settleUntil(assertion: () => void): Promise<void> {
  let failure: unknown;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
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
  await settle();
}

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  gates.deliver.length = 0;
  gates.digest.length = 0;
  await itemRepo.create(dueItem());
});

afterEach(async () => {
  if (root) await act(async () => void root!.unmount());
  root = null;
  host?.remove();
  host = null;
});

afterAll(async () => {
  await db.delete();
});

describe('ReminderRuntime notificationsEnabled gate', () => {
  it('passes the stored setting to every delivery, and follows it live without a reload', async () => {
    await mountRuntime();

    await settleUntil(() => expect(gates.deliver.length).toBeGreaterThan(0));
    // DEFAULT_SETTINGS ships notificationsEnabled: false, so no device notification.
    expect(gates.deliver.every((gate) => gate === false)).toBe(true);

    const before = gates.deliver.length;
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, notificationsEnabled: true });
    await settleUntil(() => expect(gates.deliver.length).toBeGreaterThan(before));

    // Only calls from the tick that read the resolved setting are asserted on: the
    // tick before it ran while the live query still served the default.
    const resolvedAt = gates.deliver.findIndex((gate, index) => index >= before && gate === true);
    expect(resolvedAt).toBeGreaterThanOrEqual(before);
    expect(gates.deliver.slice(resolvedAt)).not.toContain(false);
  });

  it('stops notifying again as soon as the setting is turned back off', async () => {
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, notificationsEnabled: true });
    await mountRuntime();

    await settleUntil(() => expect(gates.deliver).toContain(true));
    const resolvedAt = gates.deliver.indexOf(true);
    expect(gates.deliver.slice(resolvedAt)).not.toContain(false);

    const before = gates.deliver.length;
    await settingsRepo.set('app', { ...DEFAULT_SETTINGS, notificationsEnabled: false });
    await settleUntil(() => expect(gates.deliver.length).toBeGreaterThan(before));

    expect(gates.deliver.slice(before).every((gate) => gate === false)).toBe(true);
  });
});
