import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isTypingElement, planRouteChange } from './routeChange';

function hasOpenOverlay(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

function focusView(): void {
  const heading = document.querySelector<HTMLElement>('#main h1');
  const target = heading ?? document.getElementById('main');
  if (!target) return;
  // A heading is not focusable until it carries tabindex="-1"; `main` already does.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus();
}

// Sets a per-route document title and announces the view name for assistive tech. It
// renders only a visually-hidden live region, so no route gains visible UI.
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState('');
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    const plan = planRouteChange(pathname, {
      previousPathname: previousPathname.current,
      overlayOpen: hasOpenOverlay(),
      typingFieldFocused: isTypingElement(document.activeElement),
    });
    previousPathname.current = pathname;

    if (plan.title) document.title = plan.title;
    if (plan.moveFocus) focusView();
    if (plan.announcement) setAnnouncement(plan.announcement);
  }, [pathname]);

  return (
    <div aria-live="polite" role="status" className="sr-only">
      {announcement}
    </div>
  );
}
