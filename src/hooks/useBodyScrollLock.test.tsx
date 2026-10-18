// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useBodyScrollLock } from './useBodyScrollLock';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Locker({ active }: { active: boolean }) {
  useBodyScrollLock(active);
  return null;
}

async function mount(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  return {
    render: async (next: React.ReactNode) => {
      await act(async () => {
        root.render(next);
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('useBodyScrollLock', () => {
  it('holds the lock until every active layer is gone, then restores the prior value', async () => {
    document.body.style.overflow = 'scroll';
    const mounted = await mount(
      <>
        <Locker active />
        <Locker active />
      </>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    await mounted.render(
      <>
        <Locker active={false} />
        <Locker active />
      </>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    await mounted.render(
      <>
        <Locker active={false} />
        <Locker active={false} />
      </>,
    );
    expect(document.body.style.overflow).toBe('scroll');

    await mounted.unmount();
  });

  it('normalizes a pre-existing hidden overflow to empty on unlock', async () => {
    document.body.style.overflow = 'hidden';
    const mounted = await mount(<Locker active />);
    expect(document.body.style.overflow).toBe('hidden');

    await mounted.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('unlocks on unmount without a deactivation render', async () => {
    const mounted = await mount(<Locker active />);
    expect(document.body.style.overflow).toBe('hidden');

    await mounted.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
