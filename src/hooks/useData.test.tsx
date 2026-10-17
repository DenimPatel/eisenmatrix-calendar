// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createItem, normalizeItem } from '@/domain/itemFactory';
import { DEFAULT_SETTINGS, type Item, type List } from '@/types';
import { useArchivedItems, useChildren, useItem, useItems, useLists, useSetting } from './useData';

interface LiveQueryCall {
  querier: () => unknown;
  deps: unknown[] | undefined;
}

interface LiveQueryObserver {
  next?: (value: unknown) => void;
  error?: (error: unknown) => void;
}

const { liveQuery } = vi.hoisted(() => ({
  liveQuery: {
    result: undefined as unknown,
    calls: [] as LiveQueryCall[],
    queries: [] as Array<() => unknown>,
    observers: new Set<LiveQueryObserver>(),
    executions: 0,
  },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => unknown, deps?: unknown[], defaultResult?: unknown) => {
    liveQuery.calls.push({ querier, deps });
    return liveQuery.result === undefined ? defaultResult : liveQuery.result;
  },
}));

vi.mock('dexie', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dexie')>();
  return {
    ...actual,
    liveQuery: (querier: () => unknown) => {
      liveQuery.queries.push(querier);
      return {
        subscribe(observer: LiveQueryObserver) {
          let closed = false;
          liveQuery.observers.add(observer);
          liveQuery.executions += 1;
          observer.next?.(liveQuery.result);
          return {
            get closed() {
              return closed;
            },
            unsubscribe() {
              closed = true;
              liveQuery.observers.delete(observer);
            },
          };
        },
      };
    },
  };
});

function item(id: string, title: string, archived = false): Item {
  return {
    ...normalizeItem({ ...createItem({ kind: 'task', title }), id }),
    archivedAt: archived ? 1 : null,
  };
}

function list(id: string, name: string): List {
  return {
    id,
    name,
    kind: 'project',
    color: '#000000',
    icon: 'folder',
    order: 0,
    archivedAt: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

const ALPHA = item('1', 'Alpha');
const BETA = item('2', 'Beta');
const ARCHIVED = item('3', 'Archived one', true);
const ERRANDS = list('l1', 'Errands');
const WORK = list('l2', 'Work');

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

interface ValueRun<T> {
  values: T[];
  rerender: (useValue: () => T) => Promise<void>;
  unmount: () => Promise<void>;
}

async function renderValueProbe<T>(useValue: () => T): Promise<ValueRun<T>> {
  const values: T[] = [];
  const current = { useValue };

  function Probe() {
    values.push(current.useValue());
    return <span />;
  }

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const rerender = async (next: () => T) => {
    current.useValue = next;
    await act(async () => {
      root.render(<Probe />);
    });
  };
  await rerender(useValue);

  return {
    values,
    rerender,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

function lastCall(): LiveQueryCall {
  const call = liveQuery.calls.at(-1);
  if (!call) throw new Error('useLiveQuery was not called');
  return call;
}

function latest<T>(values: T[]): T {
  const value = values.at(-1);
  if (value === undefined) throw new Error('probe did not render');
  return value;
}

async function emitItems(next: Item[]): Promise<void> {
  liveQuery.result = next;
  await act(async () => {
    liveQuery.executions += 1;
    for (const observer of liveQuery.observers) observer.next?.(next);
  });
}

beforeEach(() => {
  liveQuery.result = [ALPHA, ARCHIVED, BETA];
  liveQuery.calls = [];
  liveQuery.queries = [];
  liveQuery.executions = 0;
});

describe('useItems identity', () => {
  it('returns the same array reference across re-renders when the data is unchanged', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    const first = latest(run.items);
    await run.rerender({ includeArchived: false, tick: 1 });
    await run.rerender({ includeArchived: false, tick: 2 });

    expect(latest(run.items)).toBe(first);
    await run.unmount();
  });

  it('keeps the archived-inclusive result stable too', async () => {
    const run = await renderProbe({ includeArchived: true, tick: 0 });
    const first = latest(run.items);
    await run.rerender({ includeArchived: true, tick: 1 });

    expect(latest(run.items)).toBe(first);
    expect(latest(run.items)).toBe(liveQuery.result);
    await run.unmount();
  });

  it('produces a new array when the live-query data changes', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    const first = latest(run.items);
    const next = [item('4', 'Gamma')];
    await emitItems(next);
    await run.rerender({ includeArchived: false, tick: 1 });

    expect(latest(run.items)).not.toBe(first);
    expect(latest(run.items).map((entry) => entry.title)).toEqual(['Gamma']);
    await run.unmount();
  });

  it('produces a new array when includeArchived flips, then is stable again', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    const withoutArchived = latest(run.items);
    await run.rerender({ includeArchived: true, tick: 1 });
    const withArchived = latest(run.items);
    await run.rerender({ includeArchived: true, tick: 2 });

    expect(withArchived).not.toBe(withoutArchived);
    expect(latest(run.items)).toBe(withArchived);
    await run.unmount();
  });
});

describe('useArchivedItems identity', () => {
  it('returns the same array reference across re-renders when the data is unchanged', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    const first = latest(run.archived);
    await run.rerender({ includeArchived: false, tick: 1 });
    await run.rerender({ includeArchived: true, tick: 2 });

    expect(latest(run.archived)).toBe(first);
    await run.unmount();
  });
});

describe('archived filtering behavior', () => {
  it('excludes archived items by default and includes them on request', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    expect(latest(run.items).map((entry) => entry.title)).toEqual(['Alpha', 'Beta']);

    await run.rerender({ includeArchived: true, tick: 1 });
    expect(latest(run.items).map((entry) => entry.title)).toEqual([
      'Alpha',
      'Archived one',
      'Beta',
    ]);
    await run.unmount();
  });

  it('returns only archived items from useArchivedItems', async () => {
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    expect(latest(run.archived).map((entry) => entry.title)).toEqual(['Archived one']);
    await run.unmount();
  });

  it('returns an empty list when the live query has no data yet', async () => {
    liveQuery.result = [];
    const run = await renderProbe({ includeArchived: false, tick: 0 });
    await run.rerender({ includeArchived: true, tick: 1 });

    expect(latest(run.items)).toEqual([]);
    expect(latest(run.archived)).toEqual([]);
    await run.unmount();
  });
});

describe('shared items query', () => {
  it('backs multiple consumers with one query and shares array instances', async () => {
    const withoutArchived = await renderValueProbe(() => useItems());
    const sameFilter = await renderValueProbe(() => useItems());
    const all = await renderValueProbe(() => useItems(true));
    const archived = await renderValueProbe(() => useArchivedItems());

    expect(liveQuery.queries).toHaveLength(1);
    expect(liveQuery.observers.size).toBe(1);
    expect(liveQuery.executions).toBe(1);

    expect(latest(withoutArchived.values)).toBe(latest(sameFilter.values));
    expect(latest(withoutArchived.values).map((entry) => entry.title)).toEqual(['Alpha', 'Beta']);
    expect(latest(all.values)).toBe(liveQuery.result);
    expect(latest(archived.values).map((entry) => entry.title)).toEqual(['Archived one']);

    await withoutArchived.unmount();
    await sameFilter.unmount();
    await all.unmount();
    await archived.unmount();
  });

  it('runs one query per change and updates every consumer', async () => {
    const first = await renderValueProbe(() => useItems());
    const second = await renderValueProbe(() => useItems());
    const archived = await renderValueProbe(() => useArchivedItems());
    expect(liveQuery.executions).toBe(1);

    await emitItems([item('4', 'Gamma'), item('5', 'Delta', true)]);

    expect(liveQuery.queries).toHaveLength(1);
    expect(liveQuery.executions).toBe(2);
    expect(latest(first.values)).toBe(latest(second.values));
    expect(latest(first.values).map((entry) => entry.title)).toEqual(['Gamma']);
    expect(latest(archived.values).map((entry) => entry.title)).toEqual(['Delta']);

    await first.unmount();
    await second.unmount();
    await archived.unmount();
  });

  it('drops the query when the last consumer unmounts and restarts it on demand', async () => {
    const first = await renderValueProbe(() => useItems());
    const second = await renderValueProbe(() => useItems());
    expect(liveQuery.observers.size).toBe(1);

    await first.unmount();
    expect(liveQuery.observers.size).toBe(1);
    await second.unmount();
    expect(liveQuery.observers.size).toBe(0);

    const remounted = await renderValueProbe(() => useItems());
    expect(liveQuery.observers.size).toBe(1);
    expect(liveQuery.queries).toHaveLength(2);
    expect(latest(remounted.values).map((entry) => entry.title)).toEqual(['Alpha', 'Beta']);
    await remounted.unmount();
  });
});

describe('useItem', () => {
  it('re-reads when the id changes', async () => {
    liveQuery.result = ALPHA;
    const run = await renderValueProbe(() => useItem('1'));
    expect(run.values[0]).toBe(ALPHA);
    expect(lastCall().deps).toEqual(['1']);

    liveQuery.result = BETA;
    await run.rerender(() => useItem('2'));
    expect(run.values[1]).toBe(BETA);
    expect(lastCall().deps).toEqual(['2']);
    expect(liveQuery.calls).toHaveLength(2);
    await run.unmount();
  });

  it('returns undefined without reading for a nullish id', async () => {
    liveQuery.result = undefined;
    const run = await renderValueProbe(() => useItem(null));
    expect(run.values[0]).toBeUndefined();
    expect(lastCall().deps).toEqual([null]);
    await expect(lastCall().querier()).resolves.toBeUndefined();

    await run.rerender(() => useItem(undefined));
    expect(run.values[1]).toBeUndefined();
    expect(lastCall().deps).toEqual([undefined]);
    await expect(lastCall().querier()).resolves.toBeUndefined();
    await run.unmount();
  });
});

describe('useLists', () => {
  it('returns the live list rows and re-reads when they change', async () => {
    liveQuery.result = [ERRANDS];
    const run = await renderValueProbe(() => useLists());
    expect(run.values[0]).toBe(liveQuery.result);
    expect(lastCall().deps).toEqual([]);

    liveQuery.result = [WORK];
    await run.rerender(() => useLists());
    expect(run.values[1]).toEqual([WORK]);
    expect(lastCall().deps).toEqual([]);
    await run.unmount();
  });

  it('falls back to an empty list before the query resolves', async () => {
    liveQuery.result = undefined;
    const run = await renderValueProbe(() => useLists());
    expect(run.values[0]).toEqual([]);
    await expect(lastCall().querier()).resolves.toEqual([]);
    await run.unmount();
  });
});

describe('useChildren', () => {
  it('re-reads when the parent id changes', async () => {
    liveQuery.result = [ALPHA, BETA];
    const run = await renderValueProbe(() => useChildren('1'));
    expect(run.values[0]).toEqual([ALPHA, BETA]);
    expect(lastCall().deps).toEqual(['1']);

    liveQuery.result = [ARCHIVED];
    await run.rerender(() => useChildren('2'));
    expect(run.values[1]).toEqual([ARCHIVED]);
    expect(lastCall().deps).toEqual(['2']);
    expect(liveQuery.calls).toHaveLength(2);
    await run.unmount();
  });

  it('returns an empty list without reading for a nullish parent', async () => {
    liveQuery.result = undefined;
    const run = await renderValueProbe(() => useChildren(null));
    expect(run.values[0]).toEqual([]);
    expect(lastCall().deps).toEqual([null]);
    await expect(lastCall().querier()).resolves.toEqual([]);
    await run.unmount();
  });
});

describe('useSetting', () => {
  it('re-reads when the key changes', async () => {
    const stored = { ...DEFAULT_SETTINGS, weekStartsOn: 0 as const };
    liveQuery.result = stored;
    const run = await renderValueProbe(() => useSetting('app', DEFAULT_SETTINGS));
    expect(run.values[0]).toBe(stored);
    expect(lastCall().deps).toEqual(['app', JSON.stringify(DEFAULT_SETTINGS)]);

    liveQuery.result = { ...stored, theme: 'dark' as const };
    await run.rerender(() => useSetting('other', DEFAULT_SETTINGS));
    expect(run.values[1]).toBe(liveQuery.result);
    expect(lastCall().deps).toEqual(['other', JSON.stringify(DEFAULT_SETTINGS)]);
    expect(liveQuery.calls).toHaveLength(2);
    await run.unmount();
  });

  it('returns the stored value, else the fallback', async () => {
    const stored = { ...DEFAULT_SETTINGS, weekStartsOn: 0 as const };
    liveQuery.result = stored;
    const fallback = { ...DEFAULT_SETTINGS, theme: 'light' as const };
    const run = await renderValueProbe(() => useSetting('app', fallback));
    expect(run.values[0]).toBe(stored);

    liveQuery.result = undefined;
    await run.rerender(() => useSetting('missing', fallback));
    expect(run.values[1]).toBe(fallback);
    await expect(lastCall().querier()).resolves.toBe(fallback);
    await run.unmount();
  });

  it('only changes the fallback dependency when the serialized value changes', async () => {
    liveQuery.result = DEFAULT_SETTINGS;
    const run = await renderValueProbe(() => useSetting('app', DEFAULT_SETTINGS));
    const initialDep = lastCall().deps?.[1];

    await run.rerender(() => useSetting('app', { ...DEFAULT_SETTINGS }));
    expect(lastCall().deps?.[1]).toBe(initialDep);

    await run.rerender(() => useSetting('app', { ...DEFAULT_SETTINGS, weekStartsOn: 0 }));
    expect(lastCall().deps?.[1]).not.toBe(initialDep);
    await run.unmount();
  });
});
