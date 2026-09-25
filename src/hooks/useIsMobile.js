import { useEffect, useState } from "react";

import { BREAKPOINTS, MEDIA } from "@/styles/breakpoints";

/* The phone/tablet boundary. Kept as a local const so the long-standing
   `useIsMobile(720)` style call sites keep working unchanged. */
const MOBILE_BREAKPOINT = BREAKPOINTS.MOBILE;

/**
 * Subscribe to an arbitrary media query string.
 *
 * Returns false on the server and on the very first client render, then
 * corrects after mount. That ordering is deliberate: returning the real match
 * during SSR is impossible, so every consumer must treat "false" as "not known
 * yet" and render the desktop layout first. Rendering the MOBILE layout as the
 * SSR default would be worse — it flashes the wrong layout on every desktop
 * load, which is the more common case.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !query) return undefined;
    const mediaQuery = window.matchMedia(query);
    const apply = () => setMatches(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, [query]);

  return matches;
}

/**
 * True below the phone/tablet boundary (640px by default).
 *
 * Pass a number to use a different width. Prefer one of the BREAKPOINTS
 * values over a hand-picked number — an off-scale width is exactly how a
 * toolbar ends up collapsing at a different point from the card beneath it.
 */
export default function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  return useMediaQuery(`(max-width: ${breakpoint}px)`);
}

/** True on the narrowest supported phones (<= 375px) — the hard floor. */
export function useIsPhoneFloor() {
  return useMediaQuery(MEDIA.phoneFloor);
}

/** True on a phone held upright (<= 640px and portrait) — the same "vertical
    phone" StaffLayout folds its topbar for, where page search bars collapse
    into a search button (see searchBarAPI/PhoneSearchCollapse). */
export function useIsVerticalPhone() {
  return useMediaQuery(`${MEDIA.mobile} and (orientation: portrait)`);
}

/** True at tablet width and below (<= 768px). */
export function useIsTablet() {
  return useMediaQuery(MEDIA.tablet);
}

/** True on any touch device, regardless of width. Use for hit-target and
    hover-affordance decisions, NOT for layout — a 1024px tablet is touch but
    is not a phone. */
export function useIsTouch() {
  return useMediaQuery(MEDIA.touch);
}

export { BREAKPOINTS, MEDIA };
