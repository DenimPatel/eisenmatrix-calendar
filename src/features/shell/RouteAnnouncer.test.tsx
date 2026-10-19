// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RouteAnnouncer } from './RouteAnnouncer';
import { BASE_TITLE } from './nav';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(ui: ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(ui);
  });
  return {
    host,
    main: () => host.querySelector('#main') as HTMLElement,
    heading: () => host.querySelector('#main h1') as HTMLElement | null,
    status: () => host.querySelector('[role="status"]') as HTMLElement | null,
    clickCalendar: async () => {
      await act(async () => {
        (host.querySelector('a[href="/calendar"]') as HTMLAnchorElement).click();
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

beforeEach(() => {
  document.title = BASE_TITLE;
});

afterEach(() => {
  document.body.innerHTML = '';
  document.title = BASE_TITLE;
});

describe('RouteAnnouncer', () => {
  it('leaves the title, focus and live region untouched on first paint', async () => {
    const view = await mount(
      <MemoryRouter initialEntries={['/today']}>
        <main id="main" tabIndex={-1}>
          <h1>Today</h1>
        </main>
        <Link to="/calendar">Calendar</Link>
        <RouteAnnouncer />
      </MemoryRouter>,
    );

    expect(document.title).toBe(BASE_TITLE);
    expect(document.activeElement).not.toBe(view.heading());
    expect(view.status()?.textContent).toBe('');

    await view.unmount();
  });

  it('sets the route title, focuses the heading and announces the view', async () => {
    const view = await mount(
      <MemoryRouter initialEntries={['/today']}>
        <main id="main" tabIndex={-1}>
          <h1>Today</h1>
        </main>
        <Link to="/calendar">Calendar</Link>
        <RouteAnnouncer />
      </MemoryRouter>,
    );

    await view.clickCalendar();

    expect(document.title).toBe(`Calendar — ${BASE_TITLE}`);
    expect(document.activeElement).toBe(view.heading());
    expect(view.status()?.textContent).toBe('Calendar');

    await view.unmount();
  });

  it('falls back to focusing main when the view has no heading yet', async () => {
    const view = await mount(
      <MemoryRouter initialEntries={['/today']}>
        <main id="main" tabIndex={-1} />
        <Link to="/calendar">Calendar</Link>
        <RouteAnnouncer />
      </MemoryRouter>,
    );

    await view.clickCalendar();

    expect(document.activeElement).toBe(view.main());
    expect(view.status()?.textContent).toBe('Calendar');

    await view.unmount();
  });

  it('does not steal focus from an open overlay but still announces', async () => {
    const view = await mount(
      <MemoryRouter initialEntries={['/today']}>
        <main id="main" tabIndex={-1} />
        <div role="dialog" aria-modal="true">
          <input aria-label="Field" />
        </div>
        <Link to="/calendar">Calendar</Link>
        <RouteAnnouncer />
      </MemoryRouter>,
    );

    const input = view.host.querySelector('input') as HTMLInputElement;
    input.focus();
    await view.clickCalendar();

    expect(document.activeElement).toBe(input);
    expect(view.status()?.textContent).toBe('Calendar');
    expect(document.title).toBe(`Calendar — ${BASE_TITLE}`);

    await view.unmount();
  });

  it('does not steal focus from a typing field', async () => {
    const view = await mount(
      <MemoryRouter initialEntries={['/today']}>
        <main id="main" tabIndex={-1} />
        <input aria-label="Search" />
        <Link to="/calendar">Calendar</Link>
        <RouteAnnouncer />
      </MemoryRouter>,
    );

    const input = view.host.querySelector('input') as HTMLInputElement;
    input.focus();
    await view.clickCalendar();

    expect(document.activeElement).toBe(input);
    expect(view.status()?.textContent).toBe('Calendar');

    await view.unmount();
  });
});
