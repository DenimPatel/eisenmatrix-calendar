// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ReminderEditor } from './ReminderEditor';
import { reconcileReminderMode } from '@/domain/reminders';
import type { Reminder } from '@/types';

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

describe('ReminderEditor control selection', () => {
  it('renders a stored timeOfDay row as a time input even when the item is timed', async () => {
    const mounted = await mount(
      <ReminderEditor
        value={[{ id: 'r', timeOfDay: '09:00' }]}
        allDay={false}
        onChange={() => {}}
      />,
    );

    // The regression: choosing the control by `allDay` showed the offset select here.
    const time = mounted.host.querySelector<HTMLInputElement>('input[type="time"]');
    expect(time?.value).toBe('09:00');
    expect(mounted.host.querySelector('select')).toBeNull();
    expect(mounted.host.textContent).toContain('At 09:00');
    expect(mounted.host.textContent).not.toContain('min before');

    await mounted.unmount();
  });

  it('renders a stored offset row as the offset select even when the item is all-day', async () => {
    const mounted = await mount(
      <ReminderEditor
        value={[{ id: 'r', offsetMinutes: -10 }]}
        allDay={true}
        onChange={() => {}}
      />,
    );

    const select = mounted.host.querySelector<HTMLSelectElement>(
      'select[aria-label="Reminder offset"]',
    );
    expect(select?.value).toBe('-10');
    expect(mounted.host.querySelector('input[type="time"]')).toBeNull();
    expect(mounted.host.textContent).toContain('Before 10 min');

    await mounted.unmount();
  });

  it('renders an absolute row as a read-only timestamp', async () => {
    const at = new Date('2026-07-20T08:30').getTime();
    const mounted = await mount(
      <ReminderEditor value={[{ id: 'r', absolute: at }]} allDay={false} onChange={() => {}} />,
    );

    const input = mounted.host.querySelector<HTMLInputElement>('input[readonly]');
    expect(input?.value).toBe(new Date(at).toLocaleString());
    expect(mounted.host.querySelector('select')).toBeNull();

    await mounted.unmount();
  });

  it('shows a kept cross-day offset as its own select option, matching the label', async () => {
    const mounted = await mount(
      <ReminderEditor
        value={[{ id: 'r', offsetMinutes: -600 }]}
        allDay={true}
        onChange={() => {}}
      />,
    );

    const select = mounted.host.querySelector<HTMLSelectElement>(
      'select[aria-label="Reminder offset"]',
    );
    expect(select?.value).toBe('-600');
    const selected = select!.selectedOptions[0];
    expect(selected.textContent).toBe('Before 10 hours');
    expect(mounted.host.textContent).toContain('Before 10 hours');

    await mounted.unmount();
  });
});

describe('ReminderEditor across an All-day toggle', () => {
  function Harness() {
    const [allDay, setAllDay] = useState(true);
    const [start, setStart] = useState<string | null>('2026-07-20');
    const [reminders, setReminders] = useState<Reminder[]>([{ id: 'r', timeOfDay: '09:00' }]);
    return (
      <>
        <input
          type="checkbox"
          aria-label="All day"
          checked={allDay}
          onChange={(e) => {
            const next = e.target.checked;
            const reconciled = reconcileReminderMode(reminders, next, start);
            setAllDay(next);
            setStart(reconciled.start);
            setReminders(reconciled.reminders);
          }}
        />
        <ReminderEditor value={reminders} allDay={allDay} onChange={setReminders} />
      </>
    );
  }

  it('keeps the control and the label describing the same instant in both directions', async () => {
    const mounted = await mount(<Harness />);
    expect(mounted.host.textContent).toContain('At 09:00');

    const toggle = mounted.host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => {
      toggle.click();
    });

    // Timed now: the row is the offset select, and its value and the label name one instant.
    const select = mounted.host.querySelector<HTMLSelectElement>(
      'select[aria-label="Reminder offset"]',
    );
    expect(select).not.toBeNull();
    expect(select!.value).toBe('0');
    expect(mounted.host.querySelector('input[type="time"]')).toBeNull();
    expect(mounted.host.textContent).toContain('At start');
    expect(mounted.host.textContent).not.toContain('At 09:00');

    await act(async () => {
      toggle.click();
    });

    const time = mounted.host.querySelector<HTMLInputElement>('input[type="time"]');
    expect(time?.value).toBe('09:00');
    expect(mounted.host.textContent).toContain('At 09:00');
    expect(mounted.host.querySelector('select')).toBeNull();

    await mounted.unmount();
  });
});
