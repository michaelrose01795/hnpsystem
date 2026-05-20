// file location: src/features/roleTreeDemo/hooks/useReducedMotionPreference.js
// Tracks the user's prefers-reduced-motion preference so the presentation can
// downgrade transitions and looping animations without relying on CSS alone.

import { useEffect, useState } from "react";

export default function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);
    apply();
    if (query.addEventListener) {
      query.addEventListener("change", apply);
      return () => query.removeEventListener("change", apply);
    }
    query.addListener(apply);
    return () => query.removeListener(apply);
  }, []);

  return reduced;
}
