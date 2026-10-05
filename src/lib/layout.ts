/**
 * Custom property the mobile bottom nav writes its rendered grid height into. Anything that
 * must clear the bar (the toast stack, the page's bottom padding) reads it instead of
 * hardcoding an offset, so a taller or shorter grid — or browser font scaling — cannot leave
 * an overlay sitting on a nav cell. Measuring rather than computing also keeps the two from
 * drifting apart when the layout changes.
 *
 * The height is the grid's, *excluding* the bar's `env(safe-area-inset-bottom)` padding, so
 * consumers add that inset themselves and stay correct on a notched device without waiting
 * for a measurement to catch up.
 */
export const MOBILE_NAV_HEIGHT_VAR = '--mobile-nav-h';

export function publishMobileNavHeight(heightPx: number): void {
  document.documentElement.style.setProperty(MOBILE_NAV_HEIGHT_VAR, `${Math.round(heightPx)}px`);
}

export function clearMobileNavHeight(): void {
  document.documentElement.style.removeProperty(MOBILE_NAV_HEIGHT_VAR);
}
