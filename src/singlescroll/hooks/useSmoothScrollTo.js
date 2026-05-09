// file location: src/singlescroll/hooks/useSmoothScrollTo.js
// Smooth-scrolls to a section by id, accounting for the sticky-nav height so
// anchors aren't hidden under the bar.

import { useCallback } from "react";

const NAV_OFFSET_FALLBACK = 72;

export default function useSmoothScrollTo() {
  return useCallback((sectionId) => {
    if (typeof window === "undefined" || !sectionId) return;
    const el = document.getElementById(sectionId);
    if (!el) return;

    const navEl = document.querySelector("[data-singlescroll-nav]");
    const navHeight = navEl?.getBoundingClientRect().height || NAV_OFFSET_FALLBACK;

    const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 8;
    const prefersReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({
      top,
      behavior: prefersReduce ? "auto" : "smooth",
    });
  }, []);
}
