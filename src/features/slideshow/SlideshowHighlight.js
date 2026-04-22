import { useEffect, useState } from "react";

export default function SlideshowHighlight({ anchor }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!anchor) { setRect(null); return undefined; }
    function resolve() {
      const el = document.querySelector(anchor);
      if (!el) { setRect(null); return; }
      setRect(el.getBoundingClientRect());
    }
    resolve();
    const interval = setInterval(resolve, 400);
    window.addEventListener("resize", resolve);
    window.addEventListener("scroll", resolve, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resolve);
      window.removeEventListener("scroll", resolve, true);
    };
  }, [anchor]);

  if (!rect) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        borderRadius: "var(--radius-md, 8px)",
        outline: "2px solid var(--accentMain)",
        outlineOffset: 0,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
        pointerEvents: "none",
        zIndex: 10001,
        transition: "all 0.2s ease",
      }}
    />
  );
}
