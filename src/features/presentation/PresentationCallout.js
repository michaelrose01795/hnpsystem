import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePresentation } from "./PresentationProvider";

const KIND_LABEL = {
  main: "Overview",
  tooltip: "UI Detail",
  feature: "Business Value",
};

const PAGE_FILE_BY_ROUTE = {
  "/accounts/invoices": "src/pages/accounts/invoices/index.js",
  "/appointments": "src/pages/appointments/index.js",
  "/customer": "src/pages/customer/index.js",
  "/customer/vhc": "src/pages/customer/vhc.js",
  "/dashboard": "src/pages/dashboard.js",
  "/hr": "src/pages/hr/index.js",
  "/job-cards/DEMO-1042": "src/pages/job-cards/[jobNumber].js",
  "/job-cards/archive": "src/pages/job-cards/archive/index.js",
  "/job-cards/create": "src/pages/job-cards/create/index.js",
  "/job-cards/myjobs": "src/pages/job-cards/myjobs/index.js",
  "/job-cards/view": "src/pages/job-cards/view/index.js",
  "/messages": "src/pages/messages/index.js",
  "/parts/create-order": "src/pages/parts/create-order/index.js",
  "/parts/deliveries": "src/pages/parts/deliveries.js",
  "/parts/goods-in": "src/pages/parts/goods-in.js",
  "/valet": "src/pages/valet/index.js",
};

function formatRouteLabel(route) {
  return String(route || "")
    .replace(/^\//, "")
    .replace(/\/$/, "") || "dashboard";
}

function getPageFile(slide) {
  if (!slide?.route) return "src/pages/unknown";
  return slide.pageFile || PAGE_FILE_BY_ROUTE[slide.route] || `src/pages/${formatRouteLabel(slide.route)}`;
}

function sideRailPosition(calloutSize, position = "right") {
  if (typeof window === "undefined") return { left: 24, top: 24 };
  const pad = 18;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const reservedBottom = 104;
  const { width: cw, height: ch } = calloutSize;
  const usableHeight = Math.max(220, viewportH - reservedBottom);
  const top = Math.max(pad, (usableHeight - ch) / 2);

  if (viewportW < 760) {
    return {
      left: Math.max(12, (viewportW - cw) / 2),
      top: 12,
    };
  }

  if (position === "left" || position === "top-left" || position === "bottom-left") {
    return { left: pad, top };
  }

  return { left: viewportW - cw - pad, top };
}

function computePosition(anchorRect, position, calloutSize) {
  if (!anchorRect) return sideRailPosition(calloutSize, position);
  if (typeof window !== "undefined" && window.innerWidth < 760) {
    return sideRailPosition(calloutSize, "center");
  }

  const pad = 16;
  const { width: cw, height: ch } = calloutSize;
  const { top, left, right, bottom, width, height } = anchorRect;
  const cx = left + width / 2;
  const cy = top + height / 2;

  switch (position) {
    case "top":
      return { left: cx - cw / 2, top: top - ch - pad };
    case "bottom":
      return { left: cx - cw / 2, top: bottom + pad };
    case "left":
      return { left: left - cw - pad, top: cy - ch / 2 };
    case "right":
      return { left: right + pad, top: cy - ch / 2 };
    case "top-left":
      return { left, top: top - ch - pad };
    case "top-right":
      return { left: right - cw, top: top - ch - pad };
    case "bottom-left":
      return { left, top: bottom + pad };
    case "bottom-right":
      return { left: right - cw, top: bottom + pad };
    case "center":
    default:
      return sideRailPosition(calloutSize, position);
  }
}

function clampToViewport(style, calloutSize) {
  if (typeof window === "undefined") return style;
  const pad = 10;
  const reservedBottom = 112;
  const maxLeft = window.innerWidth - calloutSize.width - pad;
  const maxTop = window.innerHeight - calloutSize.height - reservedBottom;
  return {
    ...style,
    left: Math.max(pad, Math.min(Number(style.left), Math.max(pad, maxLeft))),
    top: Math.max(pad, Math.min(Number(style.top), Math.max(pad, maxTop))),
  };
}

function isAnchorVisible(selector) {
  if (!selector || typeof document === "undefined") return false;
  const el = document.querySelector(selector);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export default function PresentationCallout({ step }) {
  const ref = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [calloutSize, setCalloutSize] = useState({ width: 380, height: 250 });
  const [anchorFound, setAnchorFound] = useState(() => isAnchorVisible(step?.anchor));

  const {
    slides,
    slideIndex,
    stepIndex,
    currentSteps,
    next,
    prev,
    exit,
    currentSlide,
    userRoles,
    canExit,
    isPublicViewer,
  } = usePresentation();

  const slideCount = slides.length;
  const stepCount = currentSteps.length;
  const atStart = slideIndex === 0 && stepIndex === 0;
  const atEnd = slideIndex === slideCount - 1 && stepIndex === stepCount - 1;
  const primaryRole = (userRoles?.[0] || "viewer").toLowerCase();
  const pageRoute = formatRouteLabel(currentSlide?.route);
  const pageFile = getPageFile(currentSlide);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setCalloutSize({ width: rect.width, height: rect.height });
  }, [step]);

  useEffect(() => {
    function resolveAnchor() {
      if (!step?.anchor) {
        setAnchorRect(null);
        setAnchorFound(false);
        return;
      }
      const el = document.querySelector(step.anchor);
      if (!el) {
        setAnchorRect(null);
        setAnchorFound(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      setAnchorFound(rect.width > 0 && rect.height > 0);
      setAnchorRect(rect.width > 0 && rect.height > 0 ? rect : null);
    }

    resolveAnchor();
    const interval = setInterval(resolveAnchor, 350);
    window.addEventListener("resize", resolveAnchor);
    window.addEventListener("scroll", resolveAnchor, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resolveAnchor);
      window.removeEventListener("scroll", resolveAnchor, true);
    };
  }, [step?.anchor]);

  const rawPosition = computePosition(anchorRect, step?.position || "center", calloutSize);
  const style = clampToViewport(rawPosition, calloutSize);

  return (
    <aside
      ref={ref}
      role="dialog"
      aria-live="polite"
      data-presentation-callout={step?.id || step?.title || "step"}
      className="app-section-card"
      style={{
        position: "fixed",
        zIndex: 10002,
        width: "min(calc(100vw - 24px), 400px)",
        maxHeight: "min(72vh, 520px)",
        overflow: "auto",
        pointerEvents: "auto",
        boxShadow: "0 18px 46px rgba(0, 0, 0, 0.32)",
        border: "1px solid rgba(var(--primary-rgb), 0.38)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "rgba(var(--surface-rgb), 0.98)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            color: "var(--primary)",
            fontWeight: 800,
          }}
        >
          {KIND_LABEL[step?.kind] || "Note"}
        </span>
        <span
          aria-hidden="true"
          style={{
            flex: 1,
            height: 1,
            background: "rgba(var(--primary-rgb), 0.24)",
          }}
        />
      </div>

      <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.25 }}>
        {step?.title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-1)" }}>
        {step?.body}
      </div>
      {step?.anchor && !anchorFound && (
        <div
          style={{
            fontSize: 12,
            color: "var(--warning)",
            background: "var(--warning-surface)",
            borderRadius: "var(--radius-xs)",
            padding: "7px 9px",
          }}
        >
          Anchor not visible for this viewport; the note is docked instead.
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--text-1)", marginTop: 2 }}>
        <strong style={{ color: "var(--text-1)" }}>{currentSlide?.title}</strong>
        {" | "}Slide {slideIndex + 1}/{slideCount}
        {" | "}Step {stepIndex + 1}/{stepCount}
        {" | "}Role: {primaryRole}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 8,
          marginTop: 4,
          paddingTop: 10,
          borderTop: "1px solid rgba(var(--primary-rgb), 0.16)",
        }}
      >
        <button
          type="button"
          className="app-btn app-btn--ghost app-btn--sm"
          onClick={prev}
          disabled={atStart}
          style={{ opacity: atStart ? 0.5 : 1 }}
        >
          Back
        </button>
        <button
          type="button"
          className="app-btn app-btn--primary app-btn--sm"
          onClick={next}
          disabled={atEnd}
          style={{ opacity: atEnd ? 0.5 : 1 }}
        >
          Next
        </button>
        {canExit ? (
          <button
            type="button"
            className="app-btn app-btn--danger app-btn--sm"
            onClick={exit}
            title="Exit Presentation Mode"
          >
            Exit
          </button>
        ) : (
          <span
            className="app-badge app-badge--info"
            title="This public demo stays inside Presentation Mode."
            style={{
              alignSelf: "center",
              justifySelf: "end",
              whiteSpace: "nowrap",
            }}
          >
            {isPublicViewer ? "Public demo" : "Locked"}
          </span>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(var(--primary-rgb), 0.14)",
          paddingTop: 8,
          fontSize: 11,
          color: "var(--text-1)",
          lineHeight: 1.45,
        }}
      >
        <div>
          Page: <code>{pageRoute}</code>
        </div>
        <div>
          File: <code>{pageFile}</code>
        </div>
      </div>
    </aside>
  );
}
