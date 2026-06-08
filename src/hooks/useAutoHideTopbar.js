// file location: src/hooks/useAutoHideTopbar.js
// Auto-hiding "floating" behaviour for the staff desktop topbar.
//
// Behaviour (desktop only — the caller gates this via `enabled`):
//   • At the very top of the page the topbar is docked in normal flow and is
//     always visible (identical resting position to before this feature).
//   • As soon as the page scrolls away from the top, the topbar switches to a
//     fixed overlay that floats in the SAME on-screen position, so page content
//     scrolls behind it (frosted-glass "floating above the content" look).
//   • While the user keeps scrolling it stays visible; 1.5s after scrolling stops
//     it folds up out of view from the top edge. Any further scroll unfolds it.
//
// Why position:fixed (not sticky): `.app-layout-main-column` sets
// `overflow-x: hidden`, which makes its `overflow-y` compute to `auto` — that
// turns it into a scroll container, so a sticky child would pin to a box that
// never scrolls and never actually stick. A JS-driven fixed overlay sidesteps
// that entirely. Geometry (left / width / height) is mirrored from an in-flow
// spacer wrapper so the fixed bar lines up exactly with the page card beneath
// it and the layout never jumps when the bar leaves the flow.
//
// IMPORTANT: no ancestor of the bar may establish a fixed-positioning
// containing block (transform / perspective / filter), or the fixed bar would
// be trapped + clipped by the overflow ancestor. The fold's 3D `perspective`
// is therefore baked into the bar's own `transform` (the perspective() function)
// rather than set on the wrapper.
import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_DELAY_MS = 1500; // idle time after scrolling stops before folding away
const TOP_THRESHOLD_PX = 2; // treat this close to the top as "at the top"
const FALLBACK_TOP_GAP = 18; // matches --page-gutter-y in theme.css

// `overlay` mode: used by the fixed-card (locked-viewport) layout. The page no
// longer scrolls — an inner scroller (passed via `scrollRef`) does — and the bar
// is already positioned as an absolute overlay by the caller. In that mode this
// hook does NOT reposition the bar; it only drives the fold-away animation off
// the inner scroller's scrollTop: visible at the top, visible while scrolling,
// folds 1.5s after scrolling stops, unfolds the moment scrolling resumes.
export default function useAutoHideTopbar({ enabled = true, overlay = false, scrollRef = null } = {}) {
  const wrapperRef = useRef(null);
  const barRef = useRef(null);
  const hideTimerRef = useRef(null);
  const floatingRef = useRef(false);
  const rafRef = useRef(0);

  const [floating, setFloating] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  const [geom, setGeom] = useState({ left: 0, width: 0, top: FALLBACK_TOP_GAP });
  const [reducedMotion, setReducedMotion] = useState(false);

  // Mirror the in-flow spacer's left/width and read the desired top gap from the
  // same token the main column pads with, so the fixed bar lines up with the
  // page card and sits where the docked bar rests at scrollTop 0.
  const measureGeom = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof window === "undefined") return;
    const rect = wrapper.getBoundingClientRect();
    const parsedTop = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--page-gutter-y")
    );
    const top = Number.isFinite(parsedTop) ? parsedTop : FALLBACK_TOP_GAP;
    setGeom((prev) =>
      prev.left === rect.left && prev.width === rect.width && prev.top === top
        ? prev
        : { left: rect.left, width: rect.width, top }
    );
  }, []);

  // Honour reduced-motion: drop the 3D fold, keep a plain slide/fade.
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [enabled]);

  // Track the docked bar height so the spacer can hold its place once the bar
  // goes fixed. Observing the wrapper too catches main-column width changes
  // (e.g. sidebar toggling) so the fixed bar re-aligns horizontally.
  useEffect(() => {
    // Geometry mirroring only matters in window-scroll mode (the bar goes fixed
    // and a spacer holds its place). Overlay mode keeps the caller's absolute
    // positioning, so there is nothing to measure.
    if (!enabled || overlay || typeof window === "undefined") return undefined;
    const bar = barRef.current;
    const wrapper = wrapperRef.current;
    if (!bar || !wrapper || typeof ResizeObserver === "undefined") return undefined;

    const ro = new ResizeObserver(() => {
      const h = bar.getBoundingClientRect().height;
      setBarHeight((prev) => (Math.abs(prev - h) < 0.5 ? prev : h));
      measureGeom();
    });
    ro.observe(bar);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [enabled, overlay, measureGeom]);

  useEffect(() => {
    if (!enabled) {
      floatingRef.current = false;
      setFloating(false);
      setHidden(false);
      return undefined;
    }
    if (typeof window === "undefined") return undefined;

    // Overlay mode watches the inner page scroller; window mode watches the
    // document scroll. Bail (bar stays visible) if overlay is on but the inner
    // scroller isn't mounted yet.
    const scroller = overlay ? scrollRef?.current : null;
    if (overlay && !scroller) return undefined;

    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
    const scheduleHide = () => {
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => setHidden(true), HIDE_DELAY_MS);
    };
    // Overlay mode reads the inner scroller; window mode reads the document
    // scroll (lives on body in this app, but read defensively).
    const readScrollTop = () =>
      overlay
        ? scroller.scrollTop || 0
        : Math.max(
            window.scrollY || 0,
            document.documentElement?.scrollTop || 0,
            document.body?.scrollTop || 0
          );

    const update = () => {
      const atTop = readScrollTop() <= TOP_THRESHOLD_PX;
      if (atTop) {
        // `floating` = "scrolled away from the top". Window mode also uses it to
        // drive the fixed positioning; overlay mode exposes it so the page card
        // can rise behind the bar the moment scrolling starts.
        if (floatingRef.current) {
          floatingRef.current = false;
          setFloating(false);
        }
        clearHideTimer();
        setHidden(false);
        return;
      }
      if (!floatingRef.current) {
        floatingRef.current = true;
        setFloating(true);
        if (!overlay) measureGeom(); // window mode: measure before the first fixed frame
      }
      setHidden(false); // any scroll activity reveals the bar...
      scheduleHide(); // ...and (re)arms the fold-away timer
    };

    const onScrollOrResize = (event) => {
      // Window mode: only the main page scroll drives the bar — ignore inner
      // scroll areas. Overlay mode listens directly on the inner scroller, so
      // every scroll event from it is relevant.
      if (!overlay && event && event.type === "scroll") {
        const t = event.target;
        const isPageScroll =
          t === document ||
          t === window ||
          t === document.body ||
          t === document.documentElement;
        if (!isPageScroll) return;
      }
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        if (!overlay) measureGeom();
        update();
      });
    };

    if (overlay) {
      scroller.addEventListener("scroll", onScrollOrResize, { passive: true });
    } else {
      // Capture phase so we still catch the scroll even though it fires on body.
      window.addEventListener("scroll", onScrollOrResize, true);
    }
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    update();
    if (!overlay) measureGeom();

    return () => {
      if (overlay) {
        scroller.removeEventListener("scroll", onScrollOrResize);
      } else {
        window.removeEventListener("scroll", onScrollOrResize, true);
      }
      window.removeEventListener("resize", onScrollOrResize);
      clearHideTimer();
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [enabled, overlay, scrollRef, measureGeom]);

  // ---- derived styles ----------------------------------------------------
  const foldedTransform = reducedMotion
    ? "translateY(-110%)"
    : "perspective(1400px) rotateX(-92deg) translateY(-14px)";
  const openTransform = reducedMotion
    ? "translateY(0)"
    : "perspective(1400px) rotateX(0deg) translateY(0)";
  const foldTransition = reducedMotion
    ? "opacity 0.25s ease, transform 0.25s ease"
    : "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease";

  // Overlay mode: the caller owns positioning (absolute overlay over the page
  // card). We contribute only the fold-away animation — no fixed repositioning,
  // no spacer (the page card layout never shifts; the bar folds over content
  // that has already scrolled behind it).
  if (enabled && overlay) {
    const barStyle = {
      transformOrigin: "top center",
      transform: hidden ? foldedTransform : openTransform,
      opacity: hidden ? 0 : 1,
      pointerEvents: hidden ? "none" : "auto",
      transition: foldTransition,
      willChange: "transform, opacity",
    };
    return { wrapperRef, barRef, wrapperStyle: undefined, barStyle, floating, hidden };
  }

  const wrapperStyle = enabled
    ? {
        position: "relative",
        width: "100%",
        // Reserve the bar's footprint only while it is lifted out of flow, so
        // the page content below never jumps as the bar goes fixed / returns.
        height: floating && barHeight ? `${barHeight}px` : undefined,
        zIndex: 3300,
      }
    : undefined;

  const barStyle =
    enabled && floating
      ? {
          position: "fixed",
          top: `${geom.top}px`,
          left: `${geom.left}px`,
          width: `${geom.width}px`,
          zIndex: 3300,
          transformOrigin: "top center",
          transform: hidden ? foldedTransform : openTransform,
          opacity: hidden ? 0 : 1,
          pointerEvents: hidden ? "none" : "auto",
          transition: reducedMotion
            ? "opacity 0.25s ease, transform 0.25s ease"
            : "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
          willChange: "transform, opacity",
        }
      : undefined;

  return { wrapperRef, barRef, wrapperStyle, barStyle, floating, hidden };
}
