// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Sheet } from './Sheet';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** jsdom has no layout, so `offsetParent` is always null; the trap filters on it. */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.isConnected ? this : null;
    },
  });
});

async function mount(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
  return {
    host,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

function accessibleName(host: HTMLElement): string {
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
  const labelledBy = dialog?.getAttribute('aria-labelledby');
  if (labelledBy) return document.getElementById(labelledBy)?.textContent?.trim() ?? '';
  return dialog?.getAttribute('aria-label') ?? '';
}

function accessibleDescription(host: HTMLElement): string {
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
  const describedBy = dialog?.getAttribute('aria-describedby');
  return describedBy ? (document.getElementById(describedBy)?.textContent?.trim() ?? '') : '';
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('Sheet', () => {
  it('uses the visible title as its accessible name and subtitle as its description', async () => {
    const mounted = await mount(
      <Sheet open onClose={() => undefined} title="Edit task" subtitle="Due tomorrow">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = mounted.host.querySelector<HTMLElement>('[role="dialog"]');
    expect(accessibleName(mounted.host)).toBe('Edit task');
    expect(accessibleDescription(mounted.host)).toBe('Due tomorrow');
    expect(dialog?.hasAttribute('aria-label')).toBe(false);
    await mounted.unmount();
  });

  it('falls back to a non-empty aria-label when the title is empty', async () => {
    const mounted = await mount(
      <Sheet open onClose={() => undefined} title="">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = mounted.host.querySelector<HTMLElement>('[role="dialog"]');
    expect(accessibleName(mounted.host)).toBe('Panel');
    expect(dialog?.hasAttribute('aria-labelledby')).toBe(false);
    await mounted.unmount();
  });

  it('accepts a custom aria-label fallback when the title is empty', async () => {
    const mounted = await mount(
      <Sheet open onClose={() => undefined} title="" ariaLabel="Filters">
        <p>Body</p>
      </Sheet>,
    );
    expect(accessibleName(mounted.host)).toBe('Filters');
    await mounted.unmount();
  });

  it('does not set aria-describedby without a subtitle', async () => {
    const mounted = await mount(
      <Sheet open onClose={() => undefined} title="Edit task">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = mounted.host.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
    await mounted.unmount();
  });
});
