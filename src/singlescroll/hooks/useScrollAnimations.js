// file location: src/singlescroll/hooks/useScrollAnimations.js
// Wires up GSAP + ScrollTrigger reveals for the marketing page.
// - Loaded only on the client (dynamic import) to avoid SSR issues.
// - Respects prefers-reduced-motion.
// - Uses ScrollTrigger.batch for performance — sections fade-up once on first entry.
//
// Anything you want animated should carry the data attribute  data-reveal
// (or data-reveal-stagger for staggered children).

import { useEffect } from "react";

export default function useScrollAnimations(rootRef) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduce) return;

    let cleanups = [];
    let cancelled = false;

    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      const scope = rootRef?.current || document;

      // ---- Section reveal: deliberate Razorpay-style fade + lift ------
      // Slower duration, longer stagger, expo easing — the kind of cadence
      // that makes a dark cinematic page feel intentional rather than
      // bouncy.
      const reveals = scope.querySelectorAll("[data-reveal]");
      if (reveals.length) {
        gsap.set(reveals, { opacity: 0, y: 44 });
        const triggers = ScrollTrigger.batch(reveals, {
          start: "top 90%",
          onEnter: (els) =>
            gsap.to(els, {
              opacity: 1,
              y: 0,
              duration: 1.2,
              ease: "expo.out",
              stagger: 0.12,
              overwrite: true,
            }),
          once: true,
        });
        cleanups.push(() => triggers.forEach((t) => t.kill()));
      }

      // ---- Parallax layers --------------------------------------------
      const parallaxNodes = scope.querySelectorAll("[data-parallax]");
      parallaxNodes.forEach((node) => {
        const speed = parseFloat(node.dataset.parallax) || -15;
        const tween = gsap.fromTo(
          node,
          { yPercent: 0 },
          {
            yPercent: speed,
            ease: "none",
            scrollTrigger: {
              trigger: node.closest("[data-parallax-container]") || node,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
        cleanups.push(() => {
          tween.scrollTrigger?.kill();
          tween.kill();
        });
      });

      // ---- Force a refresh after fonts/images settle ------------------
      const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 250);
      cleanups.push(() => clearTimeout(refreshTimer));
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [rootRef]);
}
