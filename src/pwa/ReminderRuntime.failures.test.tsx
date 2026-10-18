// @vitest-environment jsdom
/**
 * The undelivered-reminder path end to end, in its own file because `useItems` keeps a
 * module-level item cache: a runtime mounted after another test's runtime would tick once
 * against the previous test's items before the live query re-emits. This file mounts first,
 * so its boot tick sees an empty cache and only ever the item created below.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/schema';
import { itemRepo, reminderFailureRepo, reminderLogRepo } from '@/db/repository';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import { formatISODate } from '@/lib/date';
import { useUiStore } from '@/store/useUiStore';
import { ReminderRuntime } from './ReminderRuntime';

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

beforeEach(async () => {
  await db.items.clear();
  await db.settings.clear();
  await db.reminderLog.clear();
  await db.reminderFailures.clear();
  useUiStore.setState({ toasts: [] });
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

describe('ReminderRuntime undelivered reminders', () => {
  it('reports an aged-out undelivered reminder once, not on every visible tick', async () => {
    // A previous session attempted and failed this reminder until it aged out of the
    // lookback; the failure row is all that is left of it.
    await reminderFailureRepo.record({
      itemId: 'aged',
      dedupeKey: '2026-01-01::r1',
      occKey: '2026-01-01',
      title: 'Aged out',
    });

    await mountRuntime();

    await settleUntil(() => expect(useUiStore.getState().toasts).toHaveLength(1));
    expect(useUiStore.getState().toasts[0].message).toContain('1 reminder passed its time');

    // Further ticks re-read the same pending count and must not re-report it.
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await actRounds(2);
    }
    expect(useUiStore.getState().toasts).toHaveLength(1);
  });

  it('records one failure while hidden, delivers once when visible, and never reports a loss', async () => {
    const now = Date.now();
    const occKey = formatISODate(new Date());
    await itemRepo.create(
      normalizeItem({
        ...createItem({
          kind: 'task',
          title: 'Series',
          start: occKey,
          recurrence: {
            freq: 'daily',
            interval: 1,
            count: 1,
            weekStartsOn: 1,
            exceptions: [],
            overrides: { [occKey]: { title: 'Overridden' } },
          },
        }),
        id: 'late',
        reminders: [{ id: 'r1', absolute: now - 5 * 60_000, label: 'probe' }],
      }),
    );

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await mountRuntime();

    // The undeliverable attempt is recorded, using the resolved occurrence title …
    await settleUntilStored(async () => {
      const rows = await reminderFailureRepo.all();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ itemId: 'late', title: 'Overridden' });
    });
    // … and nothing is claimed delivered or reported while the tab is hidden.
    expect(await reminderLogRepo.wasFired('late', `${occKey}::r1`)).toBe(false);
    expect(useUiStore.getState().toasts).toHaveLength(0);

    hidden.mockReturnValue(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Exactly one delivery toast, with the resolved title, and the failure row is
    // cleared so the pending count is back to zero.
    await settleUntil(() => expect(useUiStore.getState().toasts).toHaveLength(1));
    expect(useUiStore.getState().toasts[0].message).toContain('Overridden');
    await settleUntilStored(async () => {
      expect(await reminderLogRepo.wasFired('late', `${occKey}::r1`)).toBe(true);
      expect(await reminderFailureRepo.count()).toBe(0);
    });
    await actRounds(10);
    expect(useUiStore.getState().toasts).toHaveLength(1);
  });
});
