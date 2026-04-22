import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSlideshow } from "./SlideshowProvider";
import usePdfExport from "./usePdfExport";

const KIND_LABEL = {
  main: "Overview",
  tooltip: "UI Detail",
  feature: "Key Benefit",
};

// Dock the callout in the side rail when there's no anchor to attach to,
// so the real page being demoed stays visible instead of being covered.
function sideRailPosition(calloutSize, position = "center") {
  if (typeof window === "undefined") return { left: 24, top: 24 };
  const pad = 20;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const { width: cw, height: ch } = calloutSize;
  const top = Math.max(pad, (viewportH - ch) / 2);
  const rightDock = { left: viewportW - cw - pad, top };
  const leftDock = { left: pad, top };
  switch (position) {
    case "left":
    case "top-left":
    case "bottom-left":
      return leftDock;
    default:
      return rightDock;
  }
}

function computePosition(anchorRect, position, calloutSize) {
  if (!anchorRect) return sideRailPosition(calloutSize, position);
  const pad = 16;
  const { width: cw, height: ch } = calloutSize;
  const { top, left, right, bottom, width, height } = anchorRect;
  const cx = left + width / 2;
  const cy = top + height / 2;
  switch (position) {
    case "top":    return { left: cx - cw / 2, top: top - ch - pad };
    case "bottom": return { left: cx - cw / 2, top: bottom + pad };
    case "left":   return { left: left - cw - pad, top: cy - ch / 2 };
    case "right":  return { left: right + pad, top: cy - ch / 2 };
    case "top-left":     return { left: left, top: top - ch - pad };
    case "top-right":    return { left: right - cw, top: top - ch - pad };
    case "bottom-left":  return { left: left, top: bottom + pad };
    case "bottom-right": return { left: right - cw, top: bottom + pad };
    case "center":
    default: return sideRailPosition(calloutSize, position);
  }
}

function clampToViewport(style, calloutSize) {
  if (typeof window === "undefined") return style;
  if (style.transform) return style;
  const maxLeft = window.innerWidth - calloutSize.width - 8;
  const maxTop = window.innerHeight - calloutSize.height - 8;
  return {
    ...style,
    left: Math.max(8, Math.min(Number(style.left), maxLeft)),
    top: Math.max(8, Math.min(Number(style.top), maxTop)),
  };
}

export default function SlideshowCallout({ step }) {
  const ref = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [calloutSize, setCalloutSize] = useState({ width: 360, height: 240 });

  const {
    slides, slideIndex, stepIndex, currentSteps,
    next, prev, exit, currentSlide, userRoles,
  } = useSlideshow();
  const { exportPdf, busy: exportBusy } = usePdfExport();

  const slideCount = slides.length;
  const stepCount = currentSteps.length;
  const atStart = slideIndex === 0 && stepIndex === 0;
  const atEnd = slideIndex === slideCount - 1 && stepIndex === stepCount - 1;
  const primaryRole = (userRoles?.[0] || "viewer").toLowerCase();

  useLayoutEffect(() => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setCalloutSize({ width: r.width, height: r.height });
    }
  }, [step]);

  useEffect(() => {
    function resolveAnchor() {
      if (!step?.anchor) { setAnchorRect(null); return; }
      const el = document.querySelector(step.anchor);
      if (!el) { setAnchorRect(null); return; }
      setAnchorRect(el.getBoundingClientRect());
    }
    resolveAnchor();
    const interval = setInterval(resolveAnchor, 400);
    window.addEventListener("resize", resolveAnchor);
    window.addEventListener("scroll", resolveAnchor, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resolveAnchor);
      window.removeEventListener("scroll", resolveAnchor, true);
    };
  }, [step?.anchor]);

  const raw = computePosition(anchorRect, step?.position || "center", calloutSize);
  const style = clampToViewport(raw, calloutSize);

  return (
    <div
      ref={ref}
      className="app-section-card"
      style={{
        position: "fixed",
        zIndex: 10002,
        maxWidth: 380,
        minWidth: 320,
        pointerEvents: "auto",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        border: "2px solid var(--accentMain)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      }}
    >
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accentMain)", fontWeight: 700 }}>
        {KIND_LABEL[step?.kind] || "Note"}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
        {step?.title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
        {step?.body}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
        <strong style={{ color: "var(--text-primary)" }}>{currentSlide?.title}</strong>
        {" · "}Slide {slideIndex + 1}/{slideCount}
        {" · "}Step {stepIndex + 1}/{stepCount}
        {" · "}Role: {primaryRole}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
          paddingTop: 10,
        }}
      >
        <button
          type="button"
          className="app-btn app-btn--ghost"
          onClick={prev}
          disabled={atStart}
          style={{ flex: 1, opacity: atStart ? 0.5 : 1 }}
        >
          ← Back
        </button>
        <button
          type="button"
          className="app-btn app-btn--primary"
          onClick={next}
          disabled={atEnd}
          style={{ flex: 1, opacity: atEnd ? 0.5 : 1 }}
        >
          Next →
        </button>
        <button
          type="button"
          className="app-btn app-btn--danger"
          onClick={exit}
          style={{ flex: 1 }}
          title="Exit slideshow (Esc)"
        >
          Exit
        </button>
        {/* Export button kept in the DOM but hidden per product decision. Flip
            display back on to re-enable without code changes. */}
        <button
          type="button"
          className="app-btn app-btn--ghost"
          onClick={exportPdf}
          disabled={exportBusy}
          style={{ display: "none" }}
          aria-hidden="true"
        >
          {exportBusy ? "Exporting…" : "Export PDF"}
        </button>
      </div>
    </div>
  );
}
