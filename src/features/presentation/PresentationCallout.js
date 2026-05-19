import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePresentation } from "./PresentationProvider";
import { isAnchorVisible, scrollAnchorIntoView } from "./runtime/anchorVisibility";

const KIND_LABEL = {
  main: "Overview",
  tooltip: "UI Detail",
  feature: "Business Value",
};

const PAGE_FILE_BY_ROUTE = {
  "/accounts/invoices": "src/pages/accounts/invoices/index.js",
  "/appointments": "src/pages/appointments/index.js",
  "/website": "src/pages/website.js",
  "/website/login": "src/pages/website/login.js",
  "/website/profile": "src/pages/website/profile.js",
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

const GAP = 16; // minimum gap between the callout and the highlighted rect
const VIEWPORT_PAD = 12; // padding from the viewport edges
const HIGHLIGHT_PAD = 10; // matches PresentationHighlight's PAD constant

function formatRouteLabel(route) {
  return String(route || "")
    .replace(/^\//, "")
    .replace(/\/$/, "") || "dashboard";
}

function getPageFile(slide) {
  if (!slide?.route) return "src/pages/unknown";
  return slide.pageFile || PAGE_FILE_BY_ROUTE[slide.route] || `src/pages/${formatRouteLabel(slide.route)}`;
}

function rectsOverlap(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

// Pad the highlighted rect by HIGHLIGHT_PAD to match the visible highlight ring
// — the callout must not cover the ring either.
function inflateAnchor(anchorRect) {
  if (!anchorRect) return null;
  return {
    top: anchorRect.top - HIGHLIGHT_PAD,
    left: anchorRect.left - HIGHLIGHT_PAD,
    right: anchorRect.right + HIGHLIGHT_PAD,
    bottom: anchorRect.bottom + HIGHLIGHT_PAD,
    width: anchorRect.width + HIGHLIGHT_PAD * 2,
    height: anchorRect.height + HIGHLIGHT_PAD * 2,
  };
}

// Generate candidate placements for each side. Returned as a `position` rect
// with top/left/width/height and a free-space score (higher is better).
function buildCandidates(anchor, calloutSize, viewport) {
  const { width: cw, height: ch } = calloutSize;
  const { width: vw, height: vh } = viewport;
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;

  // Try each side at three alignments (start, center, end) so the callout
  // can shift along the side instead of forcing center alignment.
  const right = anchor.right + GAP;
  const leftSide = anchor.left - GAP - cw;
  const top = anchor.top - GAP - ch;
  const bottom = anchor.bottom + GAP;

  const verticalAlignments = [
    cy - ch / 2, // center
    anchor.top, // top-aligned
    anchor.bottom - ch, // bottom-aligned
  ];
  const horizontalAlignments = [
    cx - cw / 2, // center
    anchor.left, // left-aligned
    anchor.right - cw, // right-aligned
  ];

  const candidates = [];

  // Right side
  for (const t of verticalAlignments) {
    candidates.push({ side: "right", top: t, left: right });
  }
  // Left side
  for (const t of verticalAlignments) {
    candidates.push({ side: "left", top: t, left: leftSide });
  }
  // Bottom
  for (const l of horizontalAlignments) {
    candidates.push({ side: "bottom", top: bottom, left: l });
  }
  // Top
  for (const l of horizontalAlignments) {
    candidates.push({ side: "top", top, left: l });
  }

  return candidates.map((c) => {
    // Clamp into the viewport so we score the placement we'd actually render.
    const clampedLeft = Math.max(
      VIEWPORT_PAD,
      Math.min(c.left, vw - cw - VIEWPORT_PAD)
    );
    const clampedTop = Math.max(
      VIEWPORT_PAD,
      Math.min(c.top, vh - ch - VIEWPORT_PAD)
    );
    const placed = {
      ...c,
      left: clampedLeft,
      top: clampedTop,
      right: clampedLeft + cw,
      bottom: clampedTop + ch,
    };
    const fitsHoriz = placed.left >= VIEWPORT_PAD && placed.right <= vw - VIEWPORT_PAD;
    const fitsVert = placed.top >= VIEWPORT_PAD && placed.bottom <= vh - VIEWPORT_PAD;
    const fitsViewport = fitsHoriz && fitsVert;
    const overlaps = rectsOverlap(placed, anchor);

    // Score: higher = better. Hard penalty for overlap, soft penalty for not
    // fitting the viewport.
    let score = 1000;
    if (overlaps) score -= 10000;
    if (!fitsViewport) score -= 2000;

    // Prefer side placements (left/right) for wide elements, top/bottom for
    // tall elements — so the callout sits in the more open direction.
    const elementIsWide = anchor.width > anchor.height;
    if (elementIsWide && (c.side === "top" || c.side === "bottom")) score += 50;
    if (!elementIsWide && (c.side === "left" || c.side === "right")) score += 50;

    return { ...placed, side: c.side, score, overlaps, fitsViewport };
  });
}

// Resting spot for the Overview "break" popup. It is parked clear of the page
// content (default: bottom-left, roughly the sidebar column) so the presenter
// can see the whole screen with nothing highlighted.
function pickBreakPlacement(calloutSize, defaultPosition) {
  if (typeof window === "undefined") {
    return { left: VIEWPORT_PAD, top: VIEWPORT_PAD, side: "break-dock" };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxLeft = Math.max(VIEWPORT_PAD, vw - calloutSize.width - VIEWPORT_PAD);
  const maxTop = Math.max(VIEWPORT_PAD, vh - calloutSize.height - VIEWPORT_PAD);
  const corners = {
    "bottom-left": { left: VIEWPORT_PAD, top: maxTop },
    "bottom-right": { left: maxLeft, top: maxTop },
    "top-left": { left: VIEWPORT_PAD, top: VIEWPORT_PAD },
    "top-right": { left: maxLeft, top: VIEWPORT_PAD },
  };
  const spot = corners[defaultPosition] || corners["bottom-left"];
  return { ...spot, side: "break-dock" };
}

function pickPlacement(anchorRect, calloutSize, preferredSide) {
  if (typeof window === "undefined") {
    return { left: VIEWPORT_PAD, top: VIEWPORT_PAD, side: "rail" };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Mobile: dock to bottom as a sheet so the highlight stays visible above.
  if (vw < 760) {
    const top = Math.max(
      VIEWPORT_PAD,
      vh - calloutSize.height - VIEWPORT_PAD
    );
    const left = Math.max(VIEWPORT_PAD, (vw - calloutSize.width) / 2);
    return { left, top, side: "mobile-sheet" };
  }

  if (!anchorRect) {
    // No anchor — dock to the right rail.
    const top = Math.max(VIEWPORT_PAD, (vh - calloutSize.height) / 2);
    const left = vw - calloutSize.width - VIEWPORT_PAD;
    return { left, top, side: "rail" };
  }

  const anchor = inflateAnchor(anchorRect);
  const candidates = buildCandidates(anchor, calloutSize, {
    width: vw,
    height: vh,
  });

  // Apply a hint bonus for the preferred side.
  if (preferredSide) {
    for (const c of candidates) {
      if (c.side === preferredSide) c.score += 25;
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // If even the best candidate overlaps the anchor, fall back to the side rail
  // so the callout cannot block the feature it describes.
  if (!best || best.overlaps) {
    const top = Math.max(VIEWPORT_PAD, (vh - calloutSize.height) / 2);
    // Pick the rail with more free space.
    const leftRailFree = anchor.left;
    const rightRailFree = vw - anchor.right;
    const left =
      rightRailFree >= leftRailFree
        ? vw - calloutSize.width - VIEWPORT_PAD
        : VIEWPORT_PAD;
    return { left, top, side: "rail" };
  }

  return best;
}

export default function PresentationCallout({ step }) {
  const ref = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [calloutSize, setCalloutSize] = useState({ width: 380, height: 260 });
  // Manual drag position. Null = follow the automatic placement. This is kept
  // in component state only (never persisted), so it resets on reload and the
  // popup returns to its default spot for each step.
  const [dragPos, setDragPos] = useState(null);

  const isBreak = Boolean(step?.isBreak);

  const {
    slides,
    slideIndex,
    stepIndex,
    currentSteps,
    next,
    prev,
    hideOverlay,
    currentSlide,
    userRoles,
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
    let scrollAttempts = 0;

    function resolveAnchor() {
      if (!step?.anchor) {
        setAnchorRect(null);
        return;
      }
      const el = document.querySelector(step.anchor);
      if (!el) {
        setAnchorRect(null);
        return;
      }
      if (!isAnchorVisible(step.anchor) && scrollAttempts < 6) {
        scrollAttempts += 1;
        scrollAnchorIntoView(step.anchor);
      }
      const rect = el.getBoundingClientRect();
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

  // `step.preferredSide` is the new authoring hint; `step.position` stays
  // honored as a legacy fallback for slides not yet migrated.
  const preferredSide = step?.preferredSide || step?.position || null;
  const placement = isBreak
    ? pickBreakPlacement(calloutSize, step?.defaultPosition)
    : pickPlacement(anchorRect, calloutSize, preferredSide);

  // A manual drag overrides the automatic placement until the step changes.
  const left = dragPos ? dragPos.left : placement.left;
  const top = dragPos ? dragPos.top : placement.top;

  // Drag the popup anywhere on screen by its header. Position is clamped to the
  // viewport and lives in state only — it is forgotten on reload.
  const handleDragStart = (event) => {
    if (typeof window === "undefined" || !ref.current) return;
    event.preventDefault();
    const rect = ref.current.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const handleMove = (moveEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nextLeft = Math.max(
        VIEWPORT_PAD,
        Math.min(moveEvent.clientX - offsetX, vw - rect.width - VIEWPORT_PAD)
      );
      const nextTop = Math.max(
        VIEWPORT_PAD,
        Math.min(moveEvent.clientY - offsetY, vh - rect.height - VIEWPORT_PAD)
      );
      setDragPos({ left: nextLeft, top: nextTop });
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <aside
      ref={ref}
      role="dialog"
      aria-live="polite"
      data-presentation-callout={step?.id || step?.title || "step"}
      data-presentation-side={placement.side}
      className="app-section-card"
      style={{
        position: "fixed",
        zIndex: 10002,
        width: isBreak
          ? "min(calc(100vw - 24px), 300px)"
          : "min(calc(100vw - 24px), 400px)",
        maxHeight: "min(72vh, 520px)",
        overflow: "auto",
        pointerEvents: "auto",
        boxShadow: "0 18px 46px rgba(0, 0, 0, 0.32)",
        border: "none",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "rgba(var(--surface-rgb), 0.98)",
        backdropFilter: "blur(12px)",
        left,
        top,
      }}
    >
      <div
        onPointerDown={handleDragStart}
        title="Drag to move this popup"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          cursor: "grab",
          touchAction: "none",
        }}
      >
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
        >
          {atEnd ? "Finish" : "Next"}
        </button>
        <button
          type="button"
          className="app-btn app-btn--secondary app-btn--sm"
          onClick={hideOverlay}
          title="Hide the highlight ring and this popup. Use the 'Show overlay' button in the sidebar to bring it back."
        >
          Hide
        </button>
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
