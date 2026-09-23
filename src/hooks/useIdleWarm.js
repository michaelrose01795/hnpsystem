// file location: src/hooks/useIdleWarm.js
//
// Warm one or more dynamic-import chunks once the browser has gone idle.
//
// Used where a primary control keeps its heavy surface behind next/dynamic:
// the launcher button stays in the first-load bundle so it is immediately
// available, and the surface it opens is fetched in the background before the
// user can reach for it, instead of on the click. Behaviour-neutral - this
// starts exactly the same import() the render path would start anyway, just
// earlier, and a failure here is ignored because the render path will retry.

import { useEffect } from "react";

/** @param {Array<() => Promise<unknown>>} loaders dynamic import thunks */
export default function useIdleWarm(loaders) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      for (const load of loaders) {
        try {
          Promise.resolve(load()).catch(() => {}); // chunk is fetched on demand instead
        } catch {
          // ignore - the render path loads it when the surface opens
        }
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const timer = setTimeout(warm, 1500); // Safari / older browsers
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // warm once per mount - the loader identities are module-level
}
