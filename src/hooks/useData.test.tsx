// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import type { Item } from '@/types';
import { useArchivedItems, useItems } from './useData';

const { liveQuery } = vi.hoisted(() => ({ liveQuery: { result: [] as Item[] } }));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => liveQuery.result,
}));

function item(id: string, title: string, archived = false): Item {
  return {
    ...normalizeItem({ ...createItem({ kind: 'task', title }), id }),
    archivedAt: archived ? 1 : null,
  };
}

const ALPHA = item('1', 'Alpha');
const BETA = item('2', 'Beta');
const ARCHIVED = item('3', 'Archived one', true);

interface ProbeProps {
  includeArchived: boolean;
  /** Changes on every re-render so React cannot bail out of rendering. */
  tick: number;
}

interface ProbeRun {
  items: Item[][];
  archived: Item[][];
  rerender: (props: ProbeProps) => Promise<void>;
  unmount: () => Promise<void>;
}

async function renderProbe(props: ProbeProps): Promise<ProbeRun> {
  const items: Item[][] = [];
  const archived: Item[][] = [];

  function Probe({ includeArchived, tick }: ProbeProps) {
    items.push(useItems(includeArchived));
    archived.push(useArchivedItems());
    return <span data-tick={tick} />;
  }

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const rerender = async (next: ProbeProps) => {
    await act(async () => {
      root.render(<Probe {...next} />);
    });
  };
  await rerender(props);

  return {
    items,
    archived,
    rerender,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

beforeEach(() => {
  liveQuery.result = [ALPHA, ARCHIVED, BETA];
});

describe('useItems identity', () => {
  it('returns the same array reference across re-renders when the data is unchanged', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    const first = run.items[0];
    await run.rerender({ includeArchived: false, tick: 1 });
    await run.rerender({ includeArchived: false, tick: 2 });

    expect(run.items).toHaveLength(3);
    expect(run.items[1]).toBe(first);
    expect(run.items[2]).toBe(first);
    await run.unmount();
  });

  it('keeps the archived-inclusive result stable too', async () => {
    const run = await renderProbe({ includeArchived: true, tick: 0 });
    await run.rerender({ includeArchived: true, tick: 1 });

    expect(run.items[1]).toBe(run.items[0]);
    expect(run.items[0]).toBe(liveQuery.result);
    await run.unmount();
  });

  it('produces a new array when the live-query data changes', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    const first = run.items[0];
    liveQuery.result = [item('4', 'Gamma')];
    await run.rerender({ includeArchived: false, tick: 1 });

    expect(run.items[1]).not.toBe(first);
    expect(run.items[1].map((entry) => entry.title)).toEqual(['Gamma']);
    await run.unmount();
  });

  it('produces a new array when includeArchived flips, then is stable again', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    const withoutArchived = run.items[0];
    await run.rerender({ includeArchived: true, tick: 1 });
    const withArchived = run.items[1];
    await run.rerender({ includeArchived: true, tick: 2 });

    expect(withArchived).not.toBe(withoutArchived);
    expect(run.items[2]).toBe(withArchived);
    await run.unmount();
  });
});

describe('useArchivedItems identity', () => {
  it('returns the same array reference across re-renders when the data is unchanged', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    const first = run.archived[0];
    await run.rerender({ includeArchived: false, tick: 1 });
    await run.rerender({ includeArchived: true, tick: 2 });

    expect(run.archived[1]).toBe(first);
    expect(run.archived[2]).toBe(first);
    await run.unmount();
  });
});

describe('archived filtering behavior', () => {
  it('excludes archived items by default and includes them on request', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    expect(run.items[0].map((entry) => entry.title)).toEqual(['Alpha', 'Beta']);

    await run.rerender({ includeArchived: true, tick: 1 });
    expect(run.items[1].map((entry) => entry.title)).toEqual(['Alpha', 'Archived one', 'Beta']);
    await run.unmount();
  });

  it('returns only archived items from useArchivedItems', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    expect(run.archived[0].map((entry) => entry.title)).toEqual(['Archived one']);
    await run.unmount();
  });

  it('returns an empty list when the live query has no data yet', async () => {
    liveQuery.result = [];
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    await run.rerender({ includeArchived: true, tick: 1 });

    expect(run.items[0]).toEqual([]);
    expect(run.items[1]).toEqual([]);
    expect(run.archived[0]).toEqual([]);
    await run.unmount();
  });
});
