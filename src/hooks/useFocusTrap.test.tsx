// @vitest-environment jsdom
import { useRef } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

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

function Trap({ primary }: { primary: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useFocusTrap<HTMLDivElement>(true, primary ? inputRef : undefined);
  return (
    <div ref={ref}>
      <button type="button" aria-label="Close">
        close
      </button>
      <input ref={primary ? inputRef : undefined} aria-label="Primary" />
      <button type="button" aria-label="Footer">
        footer
      </button>
    </div>
  );
}

function Harness({ open }: { open: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useFocusTrap<HTMLDivElement>(open, inputRef);
  if (!open) return <span>closed</span>;
  return (
    <div ref={ref}>
      <button type="button" aria-label="Close">
        close
      </button>
      <input ref={inputRef} aria-label="Primary" />
      <button type="button" aria-label="Footer">
        footer
      </button>
    </div>
  );
}

async function mount(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const render = async (next: React.ReactNode) => {
    await act(async () => {
      root.render(next);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  };
  await render(node);
  return {
    host,
    render,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

function activeLabel(): string | null {
  return document.activeElement?.getAttribute('aria-label') ?? null;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useFocusTrap', () => {
  it('falls back to the first focusable element without an initial focus ref', async () => {
    const mounted = await mount(<Trap primary={false} />);
    expect(activeLabel()).toBe('Close');
    await mounted.unmount();
  });

  it('focuses the initial ref instead of the Close button', async () => {
    const mounted = await mount(<Trap primary />);
    expect(activeLabel()).toBe('Primary');
    await mounted.unmount();
  });

  it('keeps Tab trapped inside the container', async () => {
    const mounted = await mount(<Trap primary />);
    const footer = mounted.host.querySelector<HTMLButtonElement>('[aria-label="Footer"]')!;
    footer.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => {
      footer.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(activeLabel()).toBe('Close');
    await mounted.unmount();
  });

  it('returns focus to the opener when the trap closes', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    const mounted = await mount(<Harness open />);
    expect(activeLabel()).toBe('Primary');

    await mounted.render(<Harness open={false} />);
    expect(document.activeElement).toBe(opener);

    await mounted.unmount();
    opener.remove();
  });
});
