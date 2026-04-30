import { useEffect, useState } from "react";

function getAnchorRect(anchor) {
  if (!anchor || typeof document === "undefined") return null;
  const el = document.querySelector(anchor);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

export default function PresentationHighlight({ anchor }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!anchor) {
      setRect(null);
      return undefined;
    }

    let rafId = null;
    function resolve() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setRect(getAnchorRect(anchor)));
    }

    resolve();
    const interval = setInterval(resolve, 350);
    window.addEventListener("resize", resolve);
    window.addEventListener("scroll", resolve, true);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearInterval(interval);
      window.removeEventListener("resize", resolve);
      window.removeEventListener("scroll", resolve, true);
    };
  }, [anchor]);

  if (!rect) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: rect.top - 7,
        left: rect.left - 7,
        width: rect.width + 14,
        height: rect.height + 14,
        borderRadius: "var(--radius-md)",
        outline: "2px solid var(--primary)",
        outlineOffset: 0,
        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.42), 0 10px 28px rgba(0, 0, 0, 0.24)",
        pointerEvents: "none",
        zIndex: 10001,
        transition: "top 0.18s ease, left 0.18s ease, width 0.18s ease, height 0.18s ease",
      }}
    />
  );
}
