// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgressRing } from './ProgressRing';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

function ring(host: HTMLElement): HTMLElement | null {
  return host.querySelector('[role="progressbar"]');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ProgressRing progress semantics', () => {
  it('exposes role, value bounds and a default percentage name', async () => {
    const mounted = await mount(<ProgressRing value={62} />);
    const el = ring(mounted.host)!;
    expect(el).not.toBeNull();
    expect(el.getAttribute('aria-valuenow')).toBe('62');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.getAttribute('aria-valuemax')).toBe('100');
    expect(el.getAttribute('aria-label')).toBe('62%');
    await mounted.unmount();
  });

  it('uses the supplied accessible name for surrounding context', async () => {
    const mounted = await mount(<ProgressRing value={40} ariaLabel="Goals progress: 40%" />);
    expect(ring(mounted.host)!.getAttribute('aria-label')).toBe('Goals progress: 40%');
    await mounted.unmount();
  });

  it('clamps out-of-range values into the 0-100 bounds', async () => {
    const over = await mount(<ProgressRing value={150} />);
    expect(ring(over.host)!.getAttribute('aria-valuenow')).toBe('100');
    await over.unmount();

    const under = await mount(<ProgressRing value={-20} />);
    expect(ring(under.host)!.getAttribute('aria-valuenow')).toBe('0');
    await under.unmount();
  });

  it('keeps the value semantics when a custom label replaces the percentage text', async () => {
    const mounted = await mount(
      <ProgressRing value={100} label={<span aria-hidden="true">✓</span>} />,
    );
    expect(ring(mounted.host)!.getAttribute('aria-valuenow')).toBe('100');
    await mounted.unmount();
  });

  it('hides a decorative ring from assistive tech without a progressbar role', async () => {
    const mounted = await mount(<ProgressRing value={50} decorative label="0" />);
    expect(ring(mounted.host)).toBeNull();
    const hidden = mounted.host.querySelector('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
    await mounted.unmount();
  });
});
