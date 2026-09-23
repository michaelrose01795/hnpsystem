/* file location: src/styles/breakpoints.js
 *
 * THE canonical breakpoint scale for staff UI.
 *
 * Before this file, staffglobal.css carried 50+ media blocks spread across 16
 * different widths (375/390/479/480/520/600/640/720/768/820/860/900/920/1024/
 * 1100/1280). Two components could disagree about where "mobile" starts by
 * 100px, so a card would collapse while the toolbar above it had not, and the
 * row blew out sideways. The scale below is deliberately small and every new
 * media query must use one of these six widths.
 *
 * The values are NOT arbitrary — each one is the width already most used in
 * the codebase for that tier, so adopting the scale moves existing behaviour
 * as little as possible:
 *
 *   PHONE_FLOOR 375  the hard minimum the app must be usable at (iPhone SE).
 *                    Nothing may scroll horizontally at this width.
 *   PHONE       480  large phone / small phone landscape.
 *   MOBILE      640  the phone-to-tablet boundary. This is the big one: it is
 *                    useIsMobile's long-standing default and the width most
 *                    existing blocks already use, so it stays the definition
 *                    of "is mobile".
 *   TABLET      768  tablet portrait.
 *   DESKTOP    1024  tablet landscape / small desktop.
 *   WIDE       1280  full desktop.
 *
 * CSS cannot read a custom property inside a media condition: a media query
 * written against a theme.css custom property never matches, because custom
 * properties are not substituted in media conditions. So these cannot live in
 * theme.css. They are literals in CSS and this module in JS, and the
 * pairing is asserted by `npm run check:responsive`.
 */

export const BREAKPOINTS = Object.freeze({
  PHONE_FLOOR: 375,
  PHONE: 480,
  MOBILE: 640,
  TABLET: 768,
  DESKTOP: 1024,
  WIDE: 1280,
});

/* Media query strings, for matchMedia in JS. Mirrors the CSS exactly. */
export const MEDIA = Object.freeze({
  phoneFloor: `(max-width: ${BREAKPOINTS.PHONE_FLOOR}px)`,
  phone: `(max-width: ${BREAKPOINTS.PHONE}px)`,
  mobile: `(max-width: ${BREAKPOINTS.MOBILE}px)`,
  tablet: `(max-width: ${BREAKPOINTS.TABLET}px)`,
  desktop: `(max-width: ${BREAKPOINTS.DESKTOP}px)`,
  wide: `(max-width: ${BREAKPOINTS.WIDE}px)`,
  /* Coarse pointer — a touch device of any width. Touch targets must hit the
     44px floor here even on a large tablet, where no max-width rule fires. */
  touch: "(pointer: coarse)",
});

export default BREAKPOINTS;
