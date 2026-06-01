// file location: src/components/layout/RouteProgressBar.js
// Thin top-of-viewport progress bar that gives instant feedback the moment a
// client-side navigation starts. Mounted once globally by _app.js.
//
// Why this exists: in the Pages Router, clicking a <Link> does not update
// router.asPath until the destination route has finished loading. Before this
// bar there was NO visual acknowledgement of a click during the (sometimes
// multi-second) bundle-fetch / data-load window, so the app felt like the click
// "did nothing". This bar paints within a frame of routeChangeStart.
//
// Rules:
// - routeChangeStart  -> show + animate toward (but never reach) 100%
// - routeChangeComplete / routeChangeError -> snap to 100% then fade out
// - Ignore shallow route changes, same-path changes, and hash-only changes so
//   in-page anchors / query tweaks don't flash the bar.
// - Uses existing theme tokens only (var(--primary)). No new colours.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

// Strip query + hash so we can detect "real" path changes vs. hash/query-only.
const pathOnly = (url = "") => String(url).split("#")[0].split("?")[0];

export default function RouteProgressBar() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const tickRef = useRef(null);
  const fadeRef = useRef(null);

  useEffect(() => {
    if (!router?.events) return undefined;

    const clearTimers = () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (fadeRef.current) {
        clearTimeout(fadeRef.current);
        fadeRef.current = null;
      }
    };

    const start = (url, { shallow } = {}) => {
      // Ignore shallow updates (router.replace(..., { shallow: true })) and
      // navigations that don't change the actual path (hash-only / query-only).
      if (shallow) return;
      if (pathOnly(url) === pathOnly(router.asPath)) return;

      clearTimers();
      setVisible(true);
      setProgress(12); // immediate jump so the bar is visible on the first frame

      // Creep toward 90% while the route resolves; never hit 100% until done.
      tickRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          // Ease-out: smaller increments as we approach the cap.
          const next = prev + Math.max(1, (90 - prev) * 0.12);
          return Math.min(90, next);
        });
      }, 180);
    };

    const done = () => {
      clearTimers();
      setProgress(100);
      // Let the 100% paint, then fade the bar out and reset.
      fadeRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
    };

    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", done);
    router.events.on("routeChangeError", done);

    return () => {
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", done);
      router.events.off("routeChangeError", done);
      clearTimers();
    };
  }, [router]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label="Loading page"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        zIndex: 9900, // above app chrome (nav toggle is 3600, status 3400) but below nothing critical
        pointerEvents: "none",
        background: "transparent",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "var(--primary)",
          boxShadow: "0 0 8px var(--primary)",
          // Quick width tween for the creep; near-instant on the initial jump.
          transition: "width 0.18s ease-out, opacity 0.22s ease-out",
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
