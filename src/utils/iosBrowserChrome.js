// file location: src/utils/iosBrowserChrome.js
//
// iOS Safari (in a browser tab, not the home-screen app) floats its address /
// tab bar over the bottom of the page, and neither the visual viewport nor
// env(safe-area-inset-bottom) reliably reports the area it covers. Anything
// that must stay tappable along the bottom edge (the /messages composer) is
// lifted by this much there, so it sits clear of the bar the way the composer
// in Apple's Messages app sits clear of the home indicator.

export const IOS_BROWSER_TOOLBAR_LIFT = 48;

// navigator.standalone only exists on iOS Safari: false in a browser tab, true
// in the home-screen app (which has no toolbar). Everywhere else it is
// undefined, so Android and desktop browsers are never lifted. Client-only.
export function isIosBrowserTab() {
  return typeof navigator !== "undefined" && navigator.standalone === false;
}
