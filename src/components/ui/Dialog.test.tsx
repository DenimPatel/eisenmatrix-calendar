// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Dialog, ConfirmDialog } from './Dialog';

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

function activeText(): string {
  return document.activeElement?.textContent?.trim() ?? '';
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

function HeadingDialog({ open = true }: { open?: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog
      open={open}
      onClose={() => undefined}
      title="Keyboard shortcuts"
      size="sm"
      titleRef={headingRef}
      initialFocusRef={headingRef}
      footer={<button type="button">Footer</button>}
    >
      <p>Body</p>
    </Dialog>
  );
}

describe('Dialog', () => {
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

  it('uses the visible title as its accessible name and description text as its description', async () => {
    const mounted = await mount(
      <Dialog
        open
        onClose={() => undefined}
        title="Keyboard shortcuts"
        description="Press a key to run a command."
        size="sm"
      >
        <p>Body</p>
      </Dialog>,
    );
    const dialog = mounted.host.querySelector<HTMLElement>('[role="dialog"]');
    expect(accessibleName(mounted.host)).toBe('Keyboard shortcuts');
    expect(accessibleDescription(mounted.host)).toBe('Press a key to run a command.');
    expect(dialog?.hasAttribute('aria-label')).toBe(false);
    await mounted.unmount();
  });

  it('falls back to a non-empty aria-label when no title is given', async () => {
    const mounted = await mount(
      <Dialog open onClose={() => undefined} description="This deletes everything." size="sm">
        <p>Body</p>
      </Dialog>,
    );
    const dialog = mounted.host.querySelector<HTMLElement>('[role="dialog"]');
    expect(accessibleName(mounted.host)).toBe('Dialog');
    expect(dialog?.hasAttribute('aria-labelledby')).toBe(false);
    expect(accessibleDescription(mounted.host)).toBe('This deletes everything.');
    await mounted.unmount();
  });

  it('accepts a custom aria-label fallback when no title is given', async () => {
    const mounted = await mount(
      <Dialog open onClose={() => undefined} ariaLabel="Pick a date" size="sm">
        <p>Body</p>
      </Dialog>,
    );
    expect(accessibleName(mounted.host)).toBe('Pick a date');
    expect(
      mounted.host.querySelector<HTMLElement>('[role="dialog"]')?.hasAttribute('aria-describedby'),
    ).toBe(false);
    await mounted.unmount();
  });

  it('focuses the title heading instead of the Close button', async () => {
    const mounted = await mount(<HeadingDialog />);
    const heading = mounted.host.querySelector('h2');
    expect(document.activeElement).toBe(heading);
    expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Close dialog');
    await mounted.unmount();
  });

  it('still starts on Close without an initial focus ref', async () => {
    const mounted = await mount(
      <Dialog open onClose={() => undefined} title="Keyboard shortcuts" size="sm">
        <p>Body</p>
      </Dialog>,
    );
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog');
    await mounted.unmount();
  });

  it('keeps the Tab loop unchanged: last focusable wraps to Close', async () => {
    const mounted = await mount(<HeadingDialog />);
    const footer = mounted.host.querySelectorAll<HTMLButtonElement>('button');
    const last = footer[footer.length - 1];
    expect(activeText()).toBe('Keyboard shortcuts');
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => {
      last.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog');
    await mounted.unmount();
  });

  it('returns focus to the opener when it closes', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    const mounted = await mount(<HeadingDialog />);
    expect(activeText()).toBe('Keyboard shortcuts');

    await mounted.render(<HeadingDialog open={false} />);
    expect(document.activeElement).toBe(opener);

    await mounted.unmount();
    opener.remove();
  });
});

describe('ConfirmDialog', () => {
  const confirm = { onConfirm: () => undefined, onCancel: () => undefined };

  it('focuses Cancel, not the destructive confirm button', async () => {
    const mounted = await mount(
      <ConfirmDialog
        open
        title="Reset all data?"
        message="This permanently deletes everything."
        confirmLabel="Delete everything"
        danger
        {...confirm}
      />,
    );
    expect(activeText()).toBe('Cancel');
    expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Close dialog');
    await mounted.unmount();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    document.body.appendChild(opener);
    opener.focus();

    const onCancel = vi.fn();
    const mounted = await mount(
      <ConfirmDialog
        open
        title="Reset all data?"
        message="This permanently deletes everything."
        confirmLabel="Delete everything"
        danger
        onConfirm={() => undefined}
        onCancel={onCancel}
      />,
    );
    expect(activeText()).toBe('Cancel');

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    await mounted.render(
      <ConfirmDialog open={false} title="Reset all data?" message="x" {...confirm} />,
    );
    expect(document.activeElement).toBe(opener);

    await mounted.unmount();
    opener.remove();
  });
});
