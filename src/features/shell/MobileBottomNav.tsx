import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './nav';
import { cn } from '@/lib/cn';
import { clearMobileNavHeight, publishMobileNavHeight } from '@/lib/layout';

export function MobileBottomNav() {
  const gridRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const publish = () => publishMobileNavHeight(grid.getBoundingClientRect().height);
    publish();
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(publish);
    observer?.observe(grid);
    // RO notifications are deferred when the tab is not rendering, so the viewport events
    // are a second, independent chance to keep the published height current.
    window.addEventListener('resize', publish);
    document.addEventListener('visibilitychange', publish);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', publish);
      document.removeEventListener('visibilitychange', publish);
      clearMobileNavHeight();
    };
  }, []);

  return (
    // The bottom inset keeps the last row of cells off the iOS home indicator. It is
    // deliberately *not* part of the published height: consumers add
    // `env(safe-area-inset-bottom)` themselves, which CSS resolves live.
    <div
      data-testid="mobile-nav-bar"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      {/* Ten destinations must all be visible at 390px with no lateral scroll, so the strip
          wraps to two rows of five instead of overflowing. Nothing here may be absolutely
          positioned: any overlay would paint over a link's label and break its contrast. */}
      <nav
        ref={gridRef}
        aria-label="Primary"
        data-testid="mobile-nav-grid"
        className="grid grid-cols-5 gap-1 px-1 py-1"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium',
                isActive ? 'bg-accent text-accent-fg' : 'text-muted',
              )
            }
          >
            <item.icon size={18} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
