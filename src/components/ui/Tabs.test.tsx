// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs, TabPanel } from './Tabs';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Value = 'one' | 'two' | 'three';

const TABS = [
  { value: 'one' as const, label: 'One' },
  { value: 'two' as const, label: 'Two' },
  { value: 'three' as const, label: 'Three' },
];

function Harness({ onChange }: { onChange?: (value: Value) => void }) {
  const [value, setValue] = useState<Value>('one');
  return (
    <Tabs
      tabs={TABS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    >
      <TabPanel value="one">Panel one</TabPanel>
      <TabPanel value="two">Panel two</TabPanel>
      <TabPanel value="three">Panel three</TabPanel>
    </Tabs>
  );
}

async function mount(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
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

function tabs(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
}

async function press(target: HTMLElement, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Tabs ARIA and keyboard semantics', () => {
  it('renders a tablist with exactly one tabbable, selected tab', async () => {
    const mounted = await mount(<Harness />);
    const list = tabs(mounted.host);
    expect(mounted.host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(list).toHaveLength(3);
    expect(list.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(list.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(list.every((t) => t.getAttribute('type') === 'button')).toBe(true);
    await mounted.unmount();
  });

  it('associates each tab with its panel through aria-controls and aria-labelledby', async () => {
    const mounted = await mount(<Harness />);
    const [first] = tabs(mounted.host);
    const panel = mounted.host.querySelector('[role="tabpanel"]')!;
    expect(panel.textContent).toBe('Panel one');
    expect(panel.getAttribute('aria-labelledby')).toBe(first.id);
    expect(first.getAttribute('aria-controls')).toBe(panel.id);
    await mounted.unmount();
  });

  it('only sets aria-controls on the selected tab so no reference dangles', async () => {
    const mounted = await mount(<Harness />);
    const list = tabs(mounted.host);
    const panel = mounted.host.querySelector('[role="tabpanel"]')!;
    expect(list[0].getAttribute('aria-controls')).toBe(panel.id);
    expect(list[1].getAttribute('aria-controls')).toBeNull();
    expect(list[2].getAttribute('aria-controls')).toBeNull();
    await mounted.unmount();
  });

  it('moves selection and focus with ArrowRight and wraps around', async () => {
    const onChange = vi.fn();
    const mounted = await mount(<Harness onChange={onChange} />);
    await press(tabs(mounted.host)[0], 'ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith('two');
    expect(document.activeElement).toBe(tabs(mounted.host)[1]);
    expect(tabs(mounted.host)[1].getAttribute('aria-selected')).toBe('true');

    await press(tabs(mounted.host)[1], 'ArrowRight');
    await press(tabs(mounted.host)[2], 'ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith('one');
    expect(document.activeElement).toBe(tabs(mounted.host)[0]);
    await mounted.unmount();
  });

  it('moves with ArrowLeft, Home and End', async () => {
    const onChange = vi.fn();
    const mounted = await mount(<Harness onChange={onChange} />);

    await press(tabs(mounted.host)[0], 'ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith('three');

    await press(tabs(mounted.host)[0], 'End');
    expect(onChange).toHaveBeenLastCalledWith('three');
    expect(document.activeElement).toBe(tabs(mounted.host)[2]);

    await press(tabs(mounted.host)[2], 'Home');
    expect(onChange).toHaveBeenLastCalledWith('one');
    expect(document.activeElement).toBe(tabs(mounted.host)[0]);
    await mounted.unmount();
  });

  it('ignores unrelated keys', async () => {
    const onChange = vi.fn();
    const mounted = await mount(<Harness onChange={onChange} />);
    await press(tabs(mounted.host)[0], 'Enter');
    await press(tabs(mounted.host)[0], 'a');
    expect(onChange).not.toHaveBeenCalled();
    await mounted.unmount();
  });
});
