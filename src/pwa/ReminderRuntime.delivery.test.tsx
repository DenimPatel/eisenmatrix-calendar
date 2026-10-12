// @vitest-environment jsdom
/**
 * Delivery-path regressions that need the real `deliver`. `ReminderRuntime.test.tsx` mocks it
 * out to read the `notificationsEnabled` gate, so it cannot see a reminder being notified or
 * logged twice.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/schema';
import { itemRepo, reminderLogRepo } from '@/db/repository';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import { formatISODate } from '@/lib/date';
import { useUiStore } from '@/store/useUiStore';
import { ReminderRuntime } from './ReminderRuntime';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const realWasFired = reminderLogRepo.wasFired.bind(reminderLogRepo);

/**
 * Holds every dedupe check open until the test releases it, so a tick stays parked in
 * `deliver`'s check-then-record window for as long as the test needs. A real
 * `wasFired`/`record` pair takes IndexedDB round trips; parking it turns "the prune wrote
 * `items` while a tick was still delivering" from a coin flip into a certainty.
 */
const gate = {
  held: Promise.resolve(),
  release: () => {},
  checks: 0,
};

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  await db.reminderLog.clear();
  useUiStore.setState({ toasts: [] });
  gate.checks = 0;
  gate.held = new Promise<void>((resolve) => {
    gate.release = resolve;
  });
  vi.spyOn(reminderLogRepo, 'wasFired').mockImplementation(async (itemId, occKey) => {
    gate.checks += 1;
    await gate.held;
    return realWasFired(itemId, occKey);
  });
});

afterEach(() => {
  gate.release();
  vi.restoreAllMocks();
});

const SETTLE_ATTEMPTS = 150;

async function actRounds(rounds: number): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
    });
  }
}

/**
 * Re-runs `assertion` until it passes. The live queries resolve on their own schedule, so a
 * fixed number of rounds races them; a genuinely unmet expectation still fails, with its
 * own message.
 */
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

/** Same, for assertions that read storage. */
async function settleUntilStored(assertion: () => Promise<void>): Promise<void> {
  let failure: unknown;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    await actRounds(1);
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
}

afterEach(async () => {
  if (root) await act(async () => void root!.unmount());
  root = null;
  host?.remove();
  host = null;
});

afterAll(async () => {
  await db.delete();
});

describe('ReminderRuntime cold load that prunes', () => {
  it('delivers each reminder exactly once', async () => {
    const now = Date.now();
    const occKey = formatISODate(new Date());
    await itemRepo.create(
      normalizeItem({
        ...createItem({ kind: 'task', title: 'A/B', start: occKey }),
        id: 'ab',
        reminders: [
          // Already delivered but still inside the 24h lookback, so the pass keeps it …
          { id: 'due', absolute: now - 5 * 60_000, label: 'Snoozed 10m' },
          // … and reclaims this one: that write is what used to re-trigger the tick.
          { id: 'stale', absolute: now - 48 * 60 * 60_000, label: 'Snoozed 10m' },
        ],
      }),
    );

    await mountRuntime();

    // The boot tick is now parked inside its dedupe check. Let the prune run: it must not
    // write `items` here, or the effect rebuild starts a second tick that passes the same
    // check before the first one has recorded.
    await settleUntil(() => expect(gate.checks).toBe(1));
    await actRounds(20);
    expect(gate.checks).toBe(1);

    gate.release();

    await settleUntilStored(async () => {
      const stored = await itemRepo.get('ab');
      expect(stored!.reminders.map((reminder) => reminder.id)).toEqual(['due']);
    });
    // Long enough for the tick the pass does trigger to run and deliver again if it can.
    await actRounds(20);

    const logged = await db.reminderLog
      .where('[itemId+occKey]')
      .equals(['ab', `${occKey}::due`])
      .count();
    expect(useUiStore.getState().toasts).toHaveLength(1);
    expect(logged).toBe(1);
  });
});
