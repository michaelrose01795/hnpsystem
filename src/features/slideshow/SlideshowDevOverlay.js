import { useEffect, useState } from "react";
import { useSlideshow } from "./SlideshowProvider";

// Independent slideshow dev overlay. Reads only from SlideshowContext — never
// touches DevLayoutOverlayContext so the two systems do not collide.
export default function SlideshowDevOverlay() {
  const { devOverlayOn, currentSlide, currentStep, slideIndex, stepIndex } = useSlideshow();
  const [anchors, setAnchors] = useState([]);

  useEffect(() => {
    if (!devOverlayOn) { setAnchors([]); return undefined; }
    function scan() {
      const nodes = document.querySelectorAll("[data-slideshow]");
      const rects = [];
      nodes.forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        rects.push({ key: n.getAttribute("data-slideshow"), rect: r });
      });
      setAnchors(rects);
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
      {anchors.map((a, i) => (
        <div
          key={`${a.key}-${i}`}
          style={{
            position: "fixed",
            top: a.rect.top,
            left: a.rect.left,
            width: a.rect.width,
            height: a.rect.height,
            border: "1px dashed #00d4ff",
            pointerEvents: "none",
            zIndex: 10005,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -18,
              left: 0,
              fontSize: 10,
              background: "#00d4ff",
              color: "#001018",
              padding: "1px 4px",
              borderRadius: 3,
              fontFamily: "monospace",
            }}
          >
            {a.key}
          </span>
        </div>
      ))}

      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 10006,
          background: "rgba(0,20,30,0.9)",
          color: "#00d4ff",
          padding: "8px 10px",
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 11,
          pointerEvents: "none",
          maxWidth: 360,
        }}
      >
        <div>slide: {slideIndex} · step: {stepIndex}</div>
        <div>id: {currentSlide?.id || "—"}</div>
        <div>anchor: {currentStep?.anchor || "(center)"}</div>
        <div>anchors on page: {anchors.length}</div>
      </div>
    </>
  );
}
