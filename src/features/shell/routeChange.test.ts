import { describe, expect, it } from 'vitest';
import { BASE_TITLE, NAV_ITEMS, ROUTE_META, routeMetaFor } from './nav';
import { isTypingElement, planRouteChange } from './routeChange';

describe('route metadata', () => {
  it('maps every nav destination to a distinct title starting with its view name', () => {
    expect(Object.keys(ROUTE_META)).toHaveLength(NAV_ITEMS.length);
    const titles = NAV_ITEMS.map((item) => {
      const meta = routeMetaFor(item.to);
      expect(meta).not.toBeNull();
      expect(meta!.name).toBe(item.label);
      expect(meta!.title).toBe(`${item.label} — ${BASE_TITLE}`);
      expect(meta!.title.startsWith(item.label)).toBe(true);
      return meta!.title;
    });
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('returns null for unknown routes', () => {
    expect(routeMetaFor('/nope')).toBeNull();
    expect(routeMetaFor('/')).toBeNull();
  });
});

describe('planRouteChange', () => {
  const base = { previousPathname: '/today', overlayOpen: false, typingFieldFocused: false };

  it('does nothing on the first render', () => {
    expect(planRouteChange('/today', { ...base, previousPathname: null })).toEqual({
      title: null,
      announcement: null,
      moveFocus: false,
    });
  });

  it('does nothing when the pathname is unchanged (StrictMode re-run)', () => {
    expect(planRouteChange('/today', base)).toEqual({
      title: null,
      announcement: null,
      moveFocus: false,
    });
  });

  it('does nothing on the initial root redirect', () => {
    expect(planRouteChange('/today', { ...base, previousPathname: '/' })).toEqual({
      title: null,
      announcement: null,
      moveFocus: false,
    });
  });

  it('falls back safely for an unknown route', () => {
    expect(planRouteChange('/nope', base)).toEqual({
      title: null,
      announcement: null,
      moveFocus: false,
    });
  });

  it('sets the title, announces the view and moves focus on a real navigation', () => {
    expect(planRouteChange('/calendar', base)).toEqual({
      title: `Calendar — ${BASE_TITLE}`,
      announcement: 'Calendar',
      moveFocus: true,
    });
  });

  it('keeps announcing but does not move focus while an overlay is open', () => {
    expect(planRouteChange('/calendar', { ...base, overlayOpen: true })).toEqual({
      title: `Calendar — ${BASE_TITLE}`,
      announcement: 'Calendar',
      moveFocus: false,
    });
  });

  it('keeps announcing but does not steal focus from a typing field', () => {
    expect(planRouteChange('/calendar', { ...base, typingFieldFocused: true })).toEqual({
      title: `Calendar — ${BASE_TITLE}`,
      announcement: 'Calendar',
      moveFocus: false,
    });
  });
});

describe('isTypingElement', () => {
  it('is false for null', () => {
    expect(isTypingElement(null)).toBe(false);
  });
});
