// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecurrenceEditor } from './RecurrenceEditor';
import type { RecurrenceRule } from '@/types';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function weeklyRule(byWeekday?: number[]): RecurrenceRule {
  return {
    freq: 'weekly',
    interval: 1,
    weekStartsOn: 1,
    ...(byWeekday ? { byWeekday } : {}),
    exceptions: [],
    overrides: {},
  };
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

function weekdayButtons(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RecurrenceEditor weekday picker', () => {
  it('exposes aria-pressed and a full weekday name per day', async () => {
    // Monday start: the default selection mirrors the start day.
    const mounted = await mount(
      <RecurrenceEditor
        value={weeklyRule()}
        start="2026-07-13T09:00"
        weekStartsOn={1}
        onChange={() => {}}
      />,
    );

    const buttons = weekdayButtons(mounted.host);
    expect(buttons).toHaveLength(7);
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
    await mounted.unmount();
  });

  it('toggles a day through aria-pressed and reports the new rule', async () => {
    const onChange = vi.fn();
    const mounted = await mount(
      <RecurrenceEditor
        value={weeklyRule([1])}
        start="2026-07-13T09:00"
        weekStartsOn={1}
        onChange={onChange}
      />,
    );

    const wednesday = weekdayButtons(mounted.host)[3];
    expect(wednesday.getAttribute('aria-pressed')).toBe('false');
    await act(async () => {
      wednesday.click();
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ byWeekday: [1, 3] }));
    await mounted.unmount();
  });
});
