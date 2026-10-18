// @vitest-environment jsdom
import { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Dialog, ConfirmDialog } from './Dialog';
import { Sheet } from './Sheet';
import { useUiStore } from '@/store/useUiStore';

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

async function pressEscape() {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
}

function dialogTitles(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll<HTMLElement>('[role="dialog"]')).map(
    (dialog) =>
      document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent ?? '',
  );
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
  useUiStore.setState({
    overlayStack: [],
    commandOpen: false,
    quickAddOpen: false,
    shortcutsOpen: false,
  });
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

function LayerDialog({
  title,
  open,
  onClose,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      titleRef={headingRef}
      initialFocusRef={headingRef}
    >
      <p>{title} body</p>
    </Dialog>
  );
}

function StackedStoreDialogs() {
  const quickAddOpen = useUiStore((s) => s.quickAddOpen);
  const commandOpen = useUiStore((s) => s.commandOpen);
  return (
    <>
      <LayerDialog
        title="Quick add"
        open={quickAddOpen}
        onClose={() => useUiStore.getState().setQuickAddOpen(false)}
      />
      <LayerDialog
        title="Command palette"
        open={commandOpen}
        onClose={() => useUiStore.getState().setCommandOpen(false)}
      />
    </>
  );
}

function SheetAndDialogStack() {
  const [sheetOpen, setSheetOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(true);
  const sheetHeadingRef = useRef<HTMLHeadingElement>(null);
  return (
    <>
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Editor"
        initialFocusRef={sheetHeadingRef}
      >
        <h2 ref={sheetHeadingRef} tabIndex={-1} className="outline-none">
          Editor body
        </h2>
      </Sheet>
      <LayerDialog title="Command palette" open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
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

  it('closes only the topmost stacked dialog on Escape, one layer per press', async () => {
    useUiStore.setState({ quickAddOpen: true, commandOpen: true });
    const mounted = await mount(<StackedStoreDialogs />);

    expect(dialogTitles(mounted.host)).toEqual(['Quick add', 'Command palette']);
    expect(activeText()).toBe('Command palette');

    await pressEscape();
    expect(dialogTitles(mounted.host)).toEqual(['Quick add']);
    expect(activeText()).toBe('Quick add');
    expect(useUiStore.getState().quickAddOpen).toBe(true);
    expect(useUiStore.getState().commandOpen).toBe(false);

    await pressEscape();
    expect(dialogTitles(mounted.host)).toEqual([]);
    expect(useUiStore.getState().quickAddOpen).toBe(false);

    await mounted.unmount();
  });

  it('treats a Dialog over a Sheet as the top layer and returns focus into the Sheet', async () => {
    const mounted = await mount(<SheetAndDialogStack />);

    expect(dialogTitles(mounted.host)).toEqual(['Editor', 'Command palette']);
    expect(activeText()).toBe('Command palette');

    await pressEscape();
    expect(dialogTitles(mounted.host)).toEqual(['Editor']);
    expect(activeText()).toBe('Editor body');

    await pressEscape();
    expect(dialogTitles(mounted.host)).toEqual([]);

    await mounted.unmount();
  });

  it('keeps body scroll locked until the last stacked layer closes, then restores the prior value', async () => {
    document.body.style.overflow = 'scroll';
    useUiStore.setState({ quickAddOpen: true, commandOpen: true });
    const mounted = await mount(<StackedStoreDialogs />);
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      useUiStore.getState().setCommandOpen(false);
    });
    expect(dialogTitles(mounted.host)).toEqual(['Quick add']);
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      useUiStore.getState().setQuickAddOpen(false);
    });
    expect(dialogTitles(mounted.host)).toEqual([]);
    expect(document.body.style.overflow).toBe('scroll');

    await mounted.unmount();
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
