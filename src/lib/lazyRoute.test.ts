// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearChunkReloadGuard, shouldReloadChunk } from './lazyRoute';

const RELOAD_FLAG = 'eisenmatrix:chunk-reload';

beforeEach(() => {
  clearChunkReloadGuard();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearChunkReloadGuard();
});

function blockedStorage(): Storage {
  const fail = () => {
    throw new Error('storage blocked');
  };
  return {
    getItem: fail,
    setItem: fail,
    removeItem: fail,
    clear: fail,
    key: fail,
    length: 0,
  } as unknown as Storage;
}

describe('shouldReloadChunk', () => {
  it('allows exactly one reload when the guard can be persisted', () => {
    expect(shouldReloadChunk()).toBe(true);
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBe('1');
    // A second failure in the same document must not reload again.
    expect(shouldReloadChunk()).toBe(false);
  });

  it('re-arms after a successful load clears the guard', () => {
    expect(shouldReloadChunk()).toBe(true);
    clearChunkReloadGuard();
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBeNull();
    expect(shouldReloadChunk()).toBe(true);
  });

  it('never reloads when sessionStorage is blocked (no reload loop)', () => {
    vi.stubGlobal('sessionStorage', blockedStorage());

    expect(shouldReloadChunk()).toBe(false);
    expect(shouldReloadChunk()).toBe(false);
  });

  it('uses the in-memory flag when storage reads fail', () => {
    const storage = blockedStorage();
    vi.stubGlobal('sessionStorage', {
      ...storage,
      setItem: () => {},
      removeItem: () => {},
    });

    expect(shouldReloadChunk()).toBe(true);
    // The in-memory flag still dedupes, even though the read is unavailable.
    expect(shouldReloadChunk()).toBe(false);
  });
});
