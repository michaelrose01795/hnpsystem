// file location: src/hooks/useRotatingViews.js
//
// Rotates through a list of short strings for the top bar's status line (Phase
// 2.6 delivery mechanism). Respects prefers-reduced-motion (no auto-rotation —
// shows the first/most-important view statically) and exposes pause/resume so the
// bar can hold on hover/focus. Content rotation only — no animation, so the bar's
// dimensions never change.

import { useEffect, useMemo, useRef, useState } from "react";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    // addEventListener is the modern API; guard for older Safari.
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);
  return reduced;
}

export function useRotatingViews(views, { intervalMs = 6000 } = {}) {
  const list = useMemo(() => (Array.isArray(views) ? views.filter(Boolean) : []), [views]);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const [, force] = useState(0);
  const reduced = usePrefersReducedMotion();
  const total = list.length;

  // Keep the index in range when the view list shrinks.
  useEffect(() => {
    if (index >= total && total > 0) setIndex(0);
  }, [total, index]);

  // Reset to the highest-priority view whenever the content itself changes, so a
  // fresh insight is shown first rather than mid-cycle.
  const key = list.join("|");
  useEffect(() => {
    setIndex(0);
  }, [key]);

  useEffect(() => {
    if (reduced || total <= 1) return undefined;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setIndex((i) => (i + 1) % total);
    }, intervalMs);
    return () => clearInterval(id);
  }, [reduced, total, intervalMs]);

  const current = total > 0 ? list[Math.min(index, total - 1)] : null;

  const pause = () => {
    pausedRef.current = true;
    force((n) => n + 1);
  };
  const resume = () => {
    pausedRef.current = false;
    force((n) => n + 1);
  };

  return { current, index: total > 0 ? Math.min(index, total - 1) : 0, total, pause, resume };
}

export default useRotatingViews;
