import { useEffect, useState } from "react";
import { usePresentation } from "./PresentationProvider";

function collectRects(selector, labelAttribute) {
  const rects = [];
  document.querySelectorAll(selector).forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    rects.push({
      key: node.getAttribute(labelAttribute) || selector,
      rect,
    });
  });
  return rects;
}

export default function PresentationDevOverlay() {
  const { devOverlayOn, currentSlide, currentStep, slideIndex, stepIndex } = usePresentation();
  const [anchors, setAnchors] = useState([]);
  const [callouts, setCallouts] = useState([]);

  useEffect(() => {
    if (!devOverlayOn) {
      setAnchors([]);
      setCallouts([]);
      return undefined;
    }

    function scan() {
      setAnchors(collectRects("[data-presentation]", "data-presentation"));
      setCallouts(collectRects("[data-presentation-callout]", "data-presentation-callout"));
    }

    scan();
    const interval = setInterval(scan, 500);
    window.addEventListener("resize", scan);
    window.addEventListener("scroll", scan, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", scan);
      window.removeEventListener("scroll", scan, true);
    };
  }, [devOverlayOn, currentSlide?.id, currentStep?.anchor]);

  if (!devOverlayOn) return null;

  return (
    <>
      {anchors.map((anchor, index) => (
        <OverlayBox
          key={`${anchor.key}-${index}`}
          rect={anchor.rect}
          label={anchor.key}
          color="#00d4ff"
          zIndex={10005}
        />
      ))}
      {callouts.map((callout, index) => (
        <OverlayBox
          key={`callout-${callout.key}-${index}`}
          rect={callout.rect}
          label={`callout: ${callout.key}`}
          color="#facc15"
          zIndex={10006}
        />
      ))}

      <div
        data-presentation-dev-panel
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 10007,
          background: "rgba(0, 20, 30, 0.92)",
          color: "#b7f6ff",
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          fontSize: 11,
          pointerEvents: "none",
          maxWidth: 390,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
        }}
      >
        <div>presentation slide: {slideIndex} / step: {stepIndex}</div>
        <div>id: {currentSlide?.id || "-"}</div>
        <div>route: {currentSlide?.route || "-"}</div>
        <div>anchor: {currentStep?.anchor || "(none)"}</div>
        <div>anchors: {anchors.length} / callouts: {callouts.length}</div>
      </div>
    </>
  );
}

function OverlayBox({ rect, label, color, zIndex }) {
  return (
    <div
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: `1px dashed ${color}`,
        pointerEvents: "none",
        zIndex,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -18,
          left: 0,
          fontSize: 10,
          background: color,
          color: "#001018",
          padding: "1px 5px",
          borderRadius: 3,
          fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}
