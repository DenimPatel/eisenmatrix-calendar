// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/schema';
import { itemRepo, settingsRepo } from '@/db/repository';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import { DEFAULT_LOOKBACK_MS } from '@/domain/reminders';
import { formatISODate } from '@/lib/date';
import { DEFAULT_SETTINGS, type Item, type Reminder } from '@/types';
import { LOOKBACK_MS } from './delivery';
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

/**
 * Same re-run trick for assertions that read storage: the prune pass resolves after the
 * mount, so a single read can race it.
 */
async function settleUntilStored(assertion: () => Promise<void>): Promise<void> {
  let failure: unknown;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    try {
      await assertion();
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

describe('ReminderRuntime snooze prune', () => {
  it('prunes with the same window the delivery layer scans back', () => {
    // The pass and the tick must agree on which snoozes are still reachable, so the two copies
    // of the window are pinned together rather than left to drift.
    expect(LOOKBACK_MS).toBe(DEFAULT_LOOKBACK_MS);
    expect(LOOKBACK_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('reclaims expired snooze reminders on load, keeping the pending one', async () => {
    const stale = Date.now() - 48 * 60 * 60_000;
    await itemRepo.create(
      normalizeItem({
        ...createItem({ kind: 'task', title: 'Snoozed', start: formatISODate(new Date()) }),
        id: 'snoozed',
        reminders: [
          { id: 'stale', absolute: stale, label: 'Snoozed 10m' },
          { id: 'rel', offsetMinutes: -10 },
          { id: 'pending', absolute: Date.now() + 10 * 60_000, label: 'Snoozed 10m' },
        ],
      }),
    );

    await mountRuntime();

    await settleUntilStored(async () => {
      const stored = await itemRepo.get('snoozed');
      expect(stored!.reminders.map((r) => r.id)).toEqual(['rel', 'pending']);
    });
  });

  it('keeps a 60-minute snooze that a delivered 10-minute snooze once destroyed', async () => {
    // Reported repro: 10m snooze → it fires → 60m snooze → reload at +20m. The load pass used
    // to keep the soonest row still above the cutoff, which was the *fired* 10m row, so the
    // 60-minute request was deleted with no toast, no history and no undo — and the boot tick,
    // whose horizon is +30s, could not rescue it.
    const now = Date.now();
    await itemRepo.create(
      normalizeItem({
        ...createItem({ kind: 'task', title: 'A/B', start: formatISODate(new Date()) }),
        id: 'ab',
        reminders: [
          { id: 'fired', absolute: now - 10 * 60_000, label: 'Snoozed 10m' },
          { id: 'owed', absolute: now + 50 * 60_000, label: 'Snoozed 60m' },
        ],
      }),
    );

    await mountRuntime();

    await settleUntilStored(async () => {
      const stored = await itemRepo.get('ab');
      expect(stored!.reminders.map((r) => r.id)).toEqual(['fired', 'owed']);
    });
    // The pending row is still in the future, so no tick could have delivered it either: the
    // only thing that could have removed it is the load pass, and it did not.
    expect(gates.deliver.length).toBeGreaterThan(0);
  });
});

describe('ReminderRuntime snooze writer', () => {
  /** The service-worker message channel the notification snooze action writes through. */
  function stubServiceWorker(): EventTarget {
    const target = new EventTarget();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
      },
      configurable: true,
    });
    return target;
  }

  /**
   * Presses the notification snooze action for `minutes` and returns the row that press
   * persisted, once it has actually landed.
   *
   * The handler is a non-atomic read-modify-write, so the next press must not start before
   * this one is durable: behind a bare `setTimeout(0)` barrier a blind append loses the
   * earlier presses (last write wins) and still leaves one absolute row, which is how that
   * mutation survived a full-suite run. Polling for a *changed* row makes each press compose.
   */
  async function pressSnooze(
    sw: EventTarget,
    itemId: string,
    minutes: number,
  ): Promise<{ pressedAt: number; reminders: Reminder[] }> {
    const before = (await itemRepo.get(itemId))!.reminders;
    const pressedAt = Date.now();
    await act(async () => {
      sw.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'OPEN_ITEM',
            itemId,
            occKey: formatISODate(new Date()),
            action: `snooze-${minutes}`,
          },
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    let reminders: Reminder[] = [];
    await settleUntilStored(async () => {
      reminders = (await itemRepo.get(itemId))!.reminders;
      expect(reminders).not.toEqual(before);
    });
    return { pressedAt, reminders };
  }

  it('supersedes the previous snooze instead of appending one row per press', async () => {
    const sw = stubServiceWorker();
    await itemRepo.create(
      normalizeItem({
        ...createItem({ kind: 'task', title: 'Snoozed', start: formatISODate(new Date()) }),
        id: 'presses',
        reminders: [{ id: 'rel', offsetMinutes: -10 }],
      }),
    );

    await mountRuntime();

    // Asserted per press, not once at the end: an append that only lost the earlier writes
    // would still leave a single row, so what has to be checked is that *each* press is
    // applied to the row the press before it persisted.
    for (const minutes of [10, 60, 10]) {
      const { pressedAt, reminders } = await pressSnooze(sw, 'presses', minutes);
      const absolutes = reminders.filter((reminder) => typeof reminder.absolute === 'number');
      expect(absolutes).toHaveLength(1);
      expect(reminders.map((reminder) => reminder.id)).toEqual(['rel', absolutes[0].id]);
      expect(absolutes[0].label).toBe(`Snoozed ${minutes}m`);
      // This press's own timestamp, not merely some future one, so a stale survivor fails too.
      expect(absolutes[0].absolute).toBeGreaterThanOrEqual(pressedAt + minutes * 60_000);
      expect(absolutes[0].absolute).toBeLessThan(pressedAt + minutes * 60_000 + 5_000);
    }
  });
});
