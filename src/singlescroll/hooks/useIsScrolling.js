// file location: src/singlescroll/hooks/useIsScrolling.js
// Returns true while the user is actively scrolling. Flips to false after
// `idleMs` of no scroll events. Used to gate the 3D render loop so the
// scene only animates while the user is interacting with the page.
//
// Stores the latest value on a ref too (for non-React readers like
// useFrame loops that don't want a re-render every event).

import { useEffect, useRef, useState } from "react";

export default function useIsScrolling(idleMs = 220) {
  const [scrolling, setScrolling] = useState(false);
  const ref = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer = null;

    const start = () => {
      if (!ref.current) {
        ref.current = true;
        setScrolling(true);
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        ref.current = false;
        setScrolling(false);
      }, idleMs);
    };

    // Trigger on scroll, wheel, touchmove, and arrow-key navigation.
    window.addEventListener("scroll", start, { passive: true });
    window.addEventListener("wheel", start, { passive: true });
    window.addEventListener("touchmove", start, { passive: true });
    window.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) {
        start();
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("scroll", start);
      window.removeEventListener("wheel", start);
      window.removeEventListener("touchmove", start);
    };
  }, [idleMs]);

  return { scrolling, ref };
}
