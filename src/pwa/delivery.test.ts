// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/schema';
import { reminderLogRepo } from '@/db/repository';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import type { Item } from '@/types';
import { DIGEST_TAG, deliver, deliverDigest } from './delivery';

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
  toasts.length = 0;
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.delete();
});

describe('deliver', () => {
  it('records the reminder when the notification was shown', async () => {
    const delivered = await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', {
      show: async () => true,
      pushToast: record,
      isVisible: () => false,
    });

    expect(delivered).toBe(true);
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(true);
    expect(toasts).toEqual([]);
  });

  it('records the reminder when only a visible toast was shown', async () => {
    const delivered = await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', {
      show: async () => false,
      pushToast: record,
      isVisible: () => true,
    });

    expect(delivered).toBe(true);
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(true);
    expect(toasts).toEqual([
      { message: 'Standup — 09:00 · 2024-06-10', tone: 'info', duration: 8000 },
    ]);
  });

  it('does not record when the notification failed and the document is hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    const delivered = await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', {
      show: async () => false,
      pushToast: record,
    });

    expect(delivered).toBe(false);
    expect(await reminderLogRepo.wasFired(ITEM_ID, DEDUPE_KEY)).toBe(false);
    expect(toasts).toEqual([]);
  });

  it('retries an undelivered reminder on the next tick instead of deduping it', async () => {
    const show = vi.fn(async () => false);
    let hidden = true;
    const options = {
      show,
      pushToast: record,
      isVisible: () => !hidden,
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

    const delivered = await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', {
      show,
      pushToast: record,
    });

    expect(delivered).toBe(false);
    expect(show).not.toHaveBeenCalled();
    expect(toasts).toEqual([]);
  });

  it('passes the item/occurrence payload to the notification', async () => {
    const show = vi.fn(async () => true);

    await deliver('Standup', '09:00 · 2024-06-10', ITEM_ID, DEDUPE_KEY, OCC_KEY, 'info', {
      show,
      pushToast: record,
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
    });

    expect(shown).toBe(false);
    expect(await reminderLogRepo.wasFired(DIGEST_TAG, todayKey)).toBe(false);
    expect(toasts).toEqual([]);
  });

  it('retries an undelivered digest and toasts once when visible', async () => {
    const show = vi.fn(async () => false);
    let hidden = true;
    const options = { show, pushToast: record, isVisible: () => !hidden };

    await deliverDigest([item('a')], today, options);
    await deliverDigest([item('a')], today, options);
    expect(await reminderLogRepo.wasFired(DIGEST_TAG, todayKey)).toBe(false);

    hidden = false;
    await deliverDigest([item('a')], today, options);

    expect(await reminderLogRepo.wasFired(DIGEST_TAG, todayKey)).toBe(true);
    expect(toasts).toEqual([
      {
        message: 'Daily digest — 1 scheduled today · 0 overdue · 0 habits',
        tone: 'info',
        duration: 10000,
      },
    ]);

    await deliverDigest([item('a')], today, options);
    expect(show).toHaveBeenCalledTimes(3);
    expect(toasts).toHaveLength(1);
  });
});