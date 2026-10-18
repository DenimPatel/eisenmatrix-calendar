// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from './Form';

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

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Checkbox target size', () => {
  it('renders a 24x24 control so the hit area clears the WCAG 2.2 minimum', async () => {
    const mounted = await mount(<Checkbox aria-label="Pick" />);
    const box = mounted.host.querySelector('input[type="checkbox"]');
    expect(box).not.toBeNull();
    expect(box!.className).toContain('h-6');
    expect(box!.className).toContain('w-6');
    await mounted.unmount();
  });
});
