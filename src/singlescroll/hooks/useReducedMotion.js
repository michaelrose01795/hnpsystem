// file location: src/singlescroll/hooks/useReducedMotion.js
// Detects the user's prefers-reduced-motion setting. Used to disable parallax,
// scroll-driven 3D, and the heavy hero scene on visitors who opt out.

import { useEffect, useState } from "react";

export default function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return reduced;
}
