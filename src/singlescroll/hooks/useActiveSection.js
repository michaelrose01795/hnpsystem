// file location: src/singlescroll/hooks/useActiveSection.js
// Tracks which section is currently visible in the viewport, for the sticky-nav
// active-tab highlight. Uses IntersectionObserver — no GSAP required for this.

import { useEffect, useState } from "react";

export default function useActiveSection(sectionIds) {
  const [active, setActive] = useState(sectionIds[0] || null);

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!elements.length) return;

    let visible = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visible.set(entry.target.id, entry.intersectionRatio);
        });

        // Pick the section with the highest visible ratio above a threshold.
        let best = { id: null, ratio: 0 };
        visible.forEach((ratio, id) => {
          if (ratio > best.ratio) best = { id, ratio };
        });
        if (best.id && best.ratio > 0.25) {
          setActive(best.id);
        }
      },
      {
        // Trigger when section is meaningfully on-screen, not just touching the edge.
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: "-80px 0px -40% 0px",
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  return active;
}
