// @vitest-environment jsdom
import { afterAll, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DndContext } from '@dnd-kit/core';
import { ItemCard } from './ItemCard';
import { resolveCardTime } from './cardTime';
import { createItem } from '@/domain/itemFactory';
import { expandOccurrences } from '@/domain/recurrence';
import { db } from '@/db/schema';
import type { Item, RecurrenceRule } from '@/types';

interface Mounted {
  host: HTMLElement;
  root: Root;
}

async function render(node: React.ReactNode): Promise<Mounted> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<DndContext>{node}</DndContext>);
  });
  return { host, root };
}

async function unmount({ host, root }: Mounted): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

function makeItem(start: string, rule?: Partial<RecurrenceRule> | null): Item {
  const item = createItem({ kind: 'task', title: 'Standup', start, allDay: false });
  item.recurrence = rule
    ? {
        freq: 'daily',
        interval: 1,
        weekStartsOn: 1,
        exceptions: [],
        overrides: {},
        ...rule,
      }
    : null;
  return item;
}

afterAll(async () => {
  await db.delete();
});

describe('resolveCardTime', () => {
  it('prefers the resolved occurrence start over the series anchor', () => {
    expect(resolveCardTime('2026-10-08T16:30', '2026-10-01T09:00')).toBe('16:30');
  });

  it('falls back to the series anchor when no occurrence start is supplied', () => {
    expect(resolveCardTime(undefined, '2026-10-01T09:00')).toBe('09:00');
    expect(resolveCardTime(null, '2026-10-01T09:00')).toBe('09:00');
  });

  it('returns no label for all-day values', () => {
    expect(resolveCardTime('2026-10-08', '2026-10-01T09:00')).toBe('');
    expect(resolveCardTime(undefined, '2026-10-01')).toBe('');
  });
});

describe('ItemCard time label', () => {
  it('shows the overridden time of a moved occurrence', async () => {
    const item = makeItem('2026-10-01T09:00', {
      freq: 'weekly',
      overrides: { '2026-10-08': { start: '2026-10-08T16:30' } },
    });
    const moved = expandOccurrences(
      item,
      new Date('2026-10-01T00:00:00'),
      new Date('2026-10-31T23:59:59'),
    ).find((occ) => occ.occKey === '2026-10-08');
    expect(moved?.start).toBe('2026-10-08T16:30');

    const mounted = await render(
      <ItemCard item={item} occurrenceKey={moved!.occKey} start={moved!.start} />,
    );
    expect(mounted.host.textContent).toContain('16:30');
    expect(mounted.host.textContent).not.toContain('09:00');
    await unmount(mounted);
  });

  it('still shows the series anchor time when the occurrence start is not supplied', async () => {
    const item = makeItem('2026-10-01T09:00', { freq: 'weekly' });
    const mounted = await render(<ItemCard item={item} />);
    expect(mounted.host.textContent).toContain('09:00');
    await unmount(mounted);
  });

  it('is unchanged for a non-recurring item with a time', async () => {
    const item = makeItem('2026-10-01T09:00');
    const occ = expandOccurrences(
      item,
      new Date('2026-10-01T00:00:00'),
      new Date('2026-10-02T00:00:00'),
    )[0];
    expect(occ.start).toBe(item.start);

    const mounted = await render(
      <ItemCard item={item} occurrenceKey={occ.occKey} start={occ.start} />,
    );
    expect(mounted.host.textContent).toContain('09:00');
    await unmount(mounted);
  });
});

describe('ItemCard completion toggle target', () => {
  it('wraps the 16px circle in a 44x44 hit area without changing the visual size', async () => {
    const item = makeItem('2026-10-01T09:00');
    const mounted = await render(<ItemCard item={item} />);

    const toggle = mounted.host.querySelector<HTMLButtonElement>(
      'button[aria-label="Mark as done"]',
    );
    expect(toggle).not.toBeNull();
    expect(toggle!.className).toContain('h-11');
    expect(toggle!.className).toContain('w-11');

    const circle = toggle!.querySelector('span');
    expect(circle?.className).toContain('h-4');
    expect(circle?.className).toContain('w-4');

    await unmount(mounted);
  });
});

describe('ItemCard occurrence title', () => {
  it('renders a retitled occurrence and leaves its siblings on the series title', async () => {
    const item = makeItem('2026-10-01T09:00', {
      freq: 'weekly',
      overrides: { '2026-10-08': { title: 'Renamed standup' } },
    });

    const retitled = await render(<ItemCard item={item} occurrenceKey="2026-10-08" />);
    expect(retitled.host.textContent).toContain('Renamed standup');
    await unmount(retitled);

    const sibling = await render(<ItemCard item={item} occurrenceKey="2026-10-15" />);
    expect(sibling.host.textContent).toContain('Standup');
    expect(sibling.host.textContent).not.toContain('Renamed standup');
    await unmount(sibling);
  });

  it('renders the series title when no occurrence is supplied', async () => {
    const item = makeItem('2026-10-01T09:00', {
      freq: 'weekly',
      overrides: { '2026-10-08': { title: 'Renamed standup' } },
    });
    const mounted = await render(<ItemCard item={item} />);
    expect(mounted.host.textContent).toContain('Standup');
    expect(mounted.host.textContent).not.toContain('Renamed standup');
    await unmount(mounted);
  });
});
