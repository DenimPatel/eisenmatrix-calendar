import { routeMetaFor } from './nav';

export interface RouteChangeContext {
  /** The pathname observed on the previous render, or null on the first render. */
  previousPathname: string | null;
  /** A modal dialog or sheet currently owns focus. */
  overlayOpen: boolean;
  /** Focus is currently inside a text field. */
  typingFieldFocused: boolean;
}

export interface RouteChangePlan {
  title: string | null;
  announcement: string | null;
  moveFocus: boolean;
}

const NO_ACTION: RouteChangePlan = { title: null, announcement: null, moveFocus: false };

export function planRouteChange(pathname: string, context: RouteChangeContext): RouteChangePlan {
  const { previousPathname, overlayOpen, typingFieldFocused } = context;
  // No action on the initial render, on a re-render without a pathname change, or on an
  // unknown route. The `previousPathname === pathname` case also absorbs React
  // StrictMode's double-invoked effect, which must not announce the landing view.
  if (previousPathname === null || previousPathname === pathname) return NO_ACTION;

  const meta = routeMetaFor(pathname);
  if (!meta) return NO_ACTION;

  // The root redirect (`/` -> `/today`) is part of the initial load: keep the static
  // title and stay silent, exactly like a first paint on a deep link.
  if (previousPathname === '/') return NO_ACTION;

  return {
    title: meta.title,
    announcement: meta.name,
    moveFocus: !overlayOpen && !typingFieldFocused,
  };
}

export function isTypingElement(element: Element | null): boolean {
  if (!element) return false;
  if (typeof HTMLElement !== 'undefined' && element instanceof HTMLElement) {
    if (element.isContentEditable) return true;
  }
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
