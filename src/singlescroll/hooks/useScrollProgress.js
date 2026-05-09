// file location: src/singlescroll/hooks/useScrollProgress.js
// Returns global scroll progress (0..1 across the whole page) — used to drive
// the camera rig, particle motion, and scene transformations in the 3D hero.
//
// Uses requestAnimationFrame to coalesce multiple scroll events into a single
// react state update per frame. Stores the current value on a ref too, so
// non-React callers (e.g. R3F's useFrame) can read the latest without
// re-rendering.

import { useEffect, useRef, useState } from "react";

export default function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = null;

    const compute = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const next = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      ref.current = next;
      setProgress(next);
      raf = null;
    };

    const onScroll = () => {
      if (raf == null) raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { progress, ref };
}
