// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/schema';
import { reminderFailureRepo, reminderLogRepo } from '@/db/repository';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import { expandOccurrences } from '@/domain/recurrence';
import type { Item } from '@/types';
import { DIGEST_TAG, deliver, deliverDigest, undeliveredCount } from './delivery';

/** The real sweep, captured so the mock can be re-armed after `restoreAllMocks`. */
const recurrence = vi.hoisted(() => ({ expand: undefined as unknown }));

vi.mock('@/domain/recurrence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/recurrence')>();
  recurrence.expand = actual.expandOccurrences;
  return { ...actual, expandOccurrences: vi.fn(actual.expandOccurrences) };
});

const expandSpy = vi.mocked(expandOccurrences);

const ITEM_ID = 'item-1';
const DEDUPE_KEY = '2024-06-10::r1';
const OCC_KEY = '2024-06-10';

const toasts: Array<{ message: string; tone?: string; duration?: number }> = [];
const record = (toast: { message: string; tone?: string; duration?: number }) => toasts.push(toast);

function item(id: string, kind: Item['kind'] = 'task'): Item {
  return normalizeItem({ ...createItem({ kind, title: `Item ${id}`, start: '2024-06-10' }), id });
}

beforeEach(async () => {
  await db.reminderLog.clear();
  await db.reminderFailures.clear();
  toasts.length = 0;
  vi.restoreAllMocks();
  expandSpy.mockReset();
  expandSpy.mockImplementation(recurrence.expand as typeof expandOccurrences);
});

afterAll(async () => {
  await db.delete();
});

describe('deliver', () => {
  it('records the reminder when the notification was shown', async () => {
    const delivered = await deliver(
      'Standup',
      '09:00 · 2024-06-10',
      ITEM_ID,
      DEDUPE_KEY,
      OCC_KEY,
      'info',
      {
        show: async () => true,
        pushToast: record,
        isVisible: () => false,
        notifyEnabled: true,
      },
    );

    expect(delivered).toBe(true);
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(true);
    expect(toasts).toEqual([]);
  });

  it('records the reminder when only a visible toast was shown', async () => {
    const delivered = await deliver(
      'Standup',
      '09:00 · 2024-06-10',
      ITEM_ID,
      DEDUPE_KEY,
      OCC_KEY,
      'info',
      {
        show: async () => false,
        pushToast: record,
        isVisible: () => true,
        notifyEnabled: true,
      },
    );

    expect(delivered).toBe(true);
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(true);
    expect(toasts).toEqual([
      { message: 'Standup — 09:00 · 2024-06-10', tone: 'info', duration: 8000 },
    ]);
  });

  it('does not record when the notification failed and the document is hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    const delivered = await deliver(
      'Standup',
      '09:00 · 2024-06-10',
      ITEM_ID,
      DEDUPE_KEY,
      OCC_KEY,
      'info',
      {
        show: async () => false,
        pushToast: record,
        notifyEnabled: true,
      },
    );

    expect(delivered).toBe(false);
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(false);
    expect(toasts).toEqual([]);
    expect(await undeliveredCount()).toBe(1);
    expect(await reminderFailureRepo.all()).toEqual([
      expect.objectContaining({
        itemId: ITEM_ID,
        dedupeKey: DEDUPE_KEY,
        occKey: OCC_KEY,
        title: 'Standup',
      }),
    ]);
  });

  it('appends one failure row across repeated undeliverable ticks and clears it on delivery', async () => {
    const show = vi.fn(async () => false);
    let hidden = true;
    const options = {
      show,
      pushToast: record,
      isVisible: () => !hidden,
      notifyEnabled: true,
    };

    for (let tick = 0; tick < 500; tick += 1) {
      await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', options);
    }
    // 500 undeliverable ticks must not append 500 rows for the same reminder.
    expect(await reminderFailureRepo.all()).toHaveLength(1);
    expect(await undeliveredCount()).toBe(1);

    hidden = false;
    await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', options);

    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(true);
    expect(toasts).toHaveLength(1);
    expect(await undeliveredCount()).toBe(0);
  });

  it('retries an undelivered reminder on the next tick instead of deduping it', async () => {
    const show = vi.fn(async () => false);
    let hidden = true;
    const options = {
      show,
      pushToast: record,
      isVisible: () => !hidden,
      notifyEnabled: true,
    };

    await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', options);
    await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', options);
    expect(show).toHaveBeenCalledTimes(2);
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(false);

    hidden = false;
    await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', options);

    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(true);
    expect(toasts).toHaveLength(1);
    await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', options);
    expect(show).toHaveBeenCalledTimes(3);
    expect(toasts).toHaveLength(1);
  });

  it('skips a reminder that was already recorded', async () => {
    await reminderLogRepo.record(ITEM_ID, DEDUPE_KEY);
    const show = vi.fn(async () => true);

    const delivered = await deliver(
      'Standup',
      '09:00 · 2024-06-10',
      ITEM_ID,
      DEDUPE_KEY,
      OCC_KEY,
      'info',
      {
        show,
        pushToast: record,
        notifyEnabled: true,
      },
    );

    expect(delivered).toBe(false);
    expect(show).not.toHaveBeenCalled();
    expect(toasts).toEqual([]);
  });

  it('passes the item/occurrence payload to the notification', async () => {
    const show = vi.fn(async () => true);

    await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', {
      show,
      pushToast: record,
      notifyEnabled: true,
    });

    expect(show).toHaveBeenCalledWith('Standup', {
      body: '09:00 · 2024-06-10',
      tag: `${ITEM_ID}:${DEDUPE_KEY}`,
      actions: [
        { action: 'done', title: 'Done' },
        { action: 'snooze-10', title: 'Snooze 10m' },
        { action: 'snooze-60', title: 'Snooze 1h' },
      ],
      data: { itemId: ITEM_ID, occKey: OCC_KEY },
      requireInteraction: true,
    });
  });
});

describe('deliverDigest', () => {
  const today = new Date('2024-06-10T08:00:00');
  const todayKey = '2024-06-10';

  it('records the digest only when it was delivered', async () => {
    const shown = await deliverDigest([item('a'), item('b', 'habit')], today, {
      show: async () => true,
      pushToast: record,
      isVisible: () => false,
      notifyEnabled: true,
    });

    expect(shown).toBe(true);
    expect(await reminderLogRepo.wasFired(DIGEST_TAG, todayKey)).toBe(true);
    expect(toasts).toEqual([]);
  });

  it('does not record the digest when the notification failed and the document is hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    const shown = await deliverDigest([item('a')], today, {
      show: async () => false,
      pushToast: record,
      notifyEnabled: true,
    });

    expect(shown).toBe(false);
    expect(await reminderLogRepo.wasFired(DIGEST_TAG, todayKey)).toBe(false);
    expect(toasts).toEqual([]);
  });

  it('retries an undelivered digest, reusing its build instead of re-sweeping', async () => {
    const show = vi.fn(async () => false);
    let hidden = true;
    const options = { show, pushToast: record, isVisible: () => !hidden, notifyEnabled: true };
    const items = [item('a')];

    await deliverDigest(items, today, options);
    const sweepsAfterFirst = expandSpy.mock.calls.length;
    expect(sweepsAfterFirst).toBeGreaterThan(0);

    await deliverDigest(items, today, options);
    // The tick that cannot deliver must not re-expand every item.
    expect(expandSpy.mock.calls.length).toBe(sweepsAfterFirst);
    expect(await reminderLogRepo.wasFired(DIGEST_TAG, todayKey)).toBe(false);
    // The digest is not a timed reminder, so it never inflates the failure count.
    expect(await undeliveredCount()).toBe(0);

    hidden = false;
    await deliverDigest(items, today, options);

    expect(await reminderLogRepo.wasFired(DIGEST_TAG, todayKey)).toBe(true);
    expect(toasts).toEqual([
      {
        message: 'Daily digest — 1 scheduled today · 0 overdue · 0 habits',
        tone: 'info',
        duration: 10000,
      },
    ]);

    await deliverDigest(items, today, options);
    expect(show).toHaveBeenCalledTimes(3);
    expect(toasts).toHaveLength(1);
  });
});

describe('notificationsEnabled gate', () => {
  it('shows no device notification while the setting is off but still toasts and records', async () => {
    const show = vi.fn(async () => true);

    const delivered = await deliver(
      'Standup',
      '09:00 · 2024-06-10',
      ITEM_ID,
      DEDUPE_KEY,
      OCC_KEY,
      'info',
      {
        show,
        pushToast: record,
        isVisible: () => true,
        notifyEnabled: false,
      },
    );

    expect(show).not.toHaveBeenCalled();
    expect(delivered).toBe(true);
    expect(toasts).toEqual([
      { message: 'Standup — 09:00 · 2024-06-10', tone: 'info', duration: 8000 },
    ]);
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(true);
  });

  it('treats a caller that passes no gate as notifications off', async () => {
    const show = vi.fn(async () => true);

    await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', {
      show,
      pushToast: record,
      isVisible: () => true,
    });

    expect(show).not.toHaveBeenCalled();
    expect(toasts).toHaveLength(1);
  });

  it('leaves a gated reminder undelivered while hidden, then delivers it once enabled', async () => {
    const show = vi.fn(async () => true);

    await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', {
      show,
      pushToast: record,
      isVisible: () => false,
      notifyEnabled: false,
    });
    expect(show).not.toHaveBeenCalled();
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(false);

    const delivered = await deliver(
      'Standup',
      '09:00 · 2024-06-10',
      ITEM_ID,
      DEDUPE_KEY,
      OCC_KEY,
      'info',
      {
        show,
        pushToast: record,
        isVisible: () => false,
        notifyEnabled: true,
      },
    );

    expect(delivered).toBe(true);
    expect(show).toHaveBeenCalledTimes(1);
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(true);
  });

  it('shows the digest as a toast only while device notifications are off', async () => {
    const show = vi.fn(async () => true);
    const today = new Date('2024-06-10T08:00:00');

    const shown = await deliverDigest([item('a')], today, {
      show,
      pushToast: record,
      isVisible: () => true,
      notifyEnabled: false,
    });

    expect(show).not.toHaveBeenCalled();
    expect(shown).toBe(true);
    expect(toasts).toEqual([
      {
        message: 'Daily digest — 1 scheduled today · 0 overdue · 0 habits',
        tone: 'info',
        duration: 10000,
      },
    ]);
  });
});
