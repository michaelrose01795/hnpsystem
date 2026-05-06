import { useEffect, useState } from "react";

function getAnchorRect(anchor) {
  if (!anchor || typeof document === "undefined") return null;
  const el = document.querySelector(anchor);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { rect, el };
}

function readBorderRadius(el) {
  if (!el || typeof window === "undefined") return null;
  try {
    const cs = window.getComputedStyle(el);
    const r = cs.borderTopLeftRadius;
    if (r && r !== "0px") return r;
  } catch {
    // ignore
  }
  return null;
}

function isRectInViewport(rect, pad = 32) {
  if (!rect || typeof window === "undefined") return false;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return (
    rect.top >= pad &&
    rect.left >= pad &&
    rect.bottom <= viewportHeight - pad &&
    rect.right <= viewportWidth - pad
  );
}

function scrollAnchorIntoView(anchor) {
  const found = getAnchorRect(anchor);
  if (!found) return false;

  if (!isRectInViewport(found.rect)) {
    found.el.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }

  return true;
}

// Thick brand-accent border around the highlighted feature, with an inverse
// box-shadow that dims everything else without touching the highlight itself.
// Padding around the rect (10px) keeps the border off the content.
export default function PresentationHighlight({ anchor }) {
  const [state, setState] = useState({ rect: null, radius: null });

  useEffect(() => {
    if (!anchor) {
      setState({ rect: null, radius: null });
      return undefined;
    }

    let rafId = null;
    let scrollTimeoutId = null;

    function ensureAnchorVisible(attempt = 0) {
      if (scrollAnchorIntoView(anchor) || attempt >= 6) return;
      scrollTimeoutId = setTimeout(() => ensureAnchorVisible(attempt + 1), 120);
    }

    function resolve() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const found = getAnchorRect(anchor);
        if (!found) {
          setState({ rect: null, radius: null });
          return;
        }
        setState({ rect: found.rect, radius: readBorderRadius(found.el) });
      });
    }

    ensureAnchorVisible();
    resolve();
    const interval = setInterval(resolve, 350);
    window.addEventListener("resize", resolve);
    window.addEventListener("scroll", resolve, true);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollTimeoutId) clearTimeout(scrollTimeoutId);
      clearInterval(interval);
      window.removeEventListener("resize", resolve);
      window.removeEventListener("scroll", resolve, true);
    };
  }, [anchor]);

  const { rect, radius } = state;
  if (!rect) return null;

  const PAD = 10;
  // Match the highlighted element's own corner radius if it has one, otherwise
  // fall back to the canonical card radius so the highlight feels native.
  const borderRadius = radius || "var(--radius-card, 24px)";

  return (
    <>
      {/* Cutout scrim: an inverse box-shadow paints a 9999px ring around the
          highlight rect, dimming everything else while the highlighted feature
          stays fully bright. */}
      <div
        aria-hidden="true"
        data-presentation-highlight-scrim
        style={{
          position: "fixed",
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius,
          boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          pointerEvents: "none",
          zIndex: 10000,
          transition:
            "top 0.18s ease, left 0.18s ease, width 0.18s ease, height 0.18s ease",
        }}
      />
      {/* Border ring: thick brand-accent outline sits on top of the scrim so
          the highlighted feature is unmistakable. */}
      <div
        aria-hidden="true"
        data-presentation-highlight-ring
        style={{
          position: "fixed",
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius,
          border: "4px solid var(--accentMain, var(--primary))",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.18) inset, 0 12px 36px rgba(0,0,0,0.28)",
          pointerEvents: "none",
          zIndex: 10001,
          transition:
            "top 0.18s ease, left 0.18s ease, width 0.18s ease, height 0.18s ease",
        }}
      />
    </>
  );
}
