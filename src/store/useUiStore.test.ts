import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from './useUiStore';

beforeEach(() => {
  useUiStore.setState({ undoStack: [], toasts: [] });
});

describe('pushUndo / undo', () => {
  it('returns a stable id and undo(id) runs and removes that entry', async () => {
    const runA = vi.fn();
    const runB = vi.fn();
    const idA = useUiStore.getState().pushUndo({ label: 'A', run: runA });
    useUiStore.getState().pushUndo({ label: 'B', run: runB });

    expect(await useUiStore.getState().undo(idA)).toBe(true);

    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).not.toHaveBeenCalled();
    expect(useUiStore.getState().undoStack.map((entry) => entry.label)).toEqual(['B']);
  });

  it('undo() with no id pops the newest entry', async () => {
    const runA = vi.fn();
    const runB = vi.fn();
    useUiStore.getState().pushUndo({ label: 'A', run: runA });
    useUiStore.getState().pushUndo({ label: 'B', run: runB });

    expect(await useUiStore.getState().undo()).toBe(true);

    expect(runB).toHaveBeenCalledTimes(1);
    expect(runA).not.toHaveBeenCalled();
    expect(useUiStore.getState().undoStack.map((entry) => entry.label)).toEqual(['A']);
  });

  it('is a no-op for an id that is no longer on the stack', async () => {
    const runA = vi.fn();
    const runB = vi.fn();
    const idA = useUiStore.getState().pushUndo({ label: 'A', run: runA });
    useUiStore.getState().pushUndo({ label: 'B', run: runB });

    // Undo A first, then the same id again — it must not fall back to the stack top.
    expect(await useUiStore.getState().undo(idA)).toBe(true);
    expect(await useUiStore.getState().undo(idA)).toBe(false);

    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).not.toHaveBeenCalled();
    expect(useUiStore.getState().undoStack.map((entry) => entry.label)).toEqual(['B']);
  });

  it('does not run an entry evicted by the 25-entry cap', async () => {
    const runs = Array.from({ length: 26 }, () => vi.fn());
    const ids = runs.map((run, i) => useUiStore.getState().pushUndo({ label: `E${i}`, run }));

    expect(useUiStore.getState().undoStack).toHaveLength(25);
    expect(useUiStore.getState().undoStack.some((entry) => entry.id === ids[0])).toBe(false);

    expect(await useUiStore.getState().undo(ids[0])).toBe(false);
    expect(runs[0]).not.toHaveBeenCalled();
    expect(useUiStore.getState().undoStack).toHaveLength(25);
  });

  it('returns false when the stack is empty', async () => {
    expect(await useUiStore.getState().undo()).toBe(false);
    expect(await useUiStore.getState().undo('missing')).toBe(false);
  });
});
