import { useSlideshow } from "./SlideshowProvider";
import { MOCKS_BY_SLIDE_ID } from "./mocks";

// Renders a self-contained mock of the slide's target page. The real page
// components are NEVER mounted — the slideshow shows visual recreations
// powered by demo data, so no real queries or side effects ever run.
function FallbackPage({ slide }) {
  return (
    <div className="app-page-shell">
      <div className="app-page-card">
        <div className="app-page-stack">
          <div className="app-section-card">
            <h1 style={{ marginTop: 0 }}>{slide?.title || "Slide"}</h1>
            <p style={{ color: "var(--text-secondary)" }}>
              No mock registered for slide id <code>{slide?.id}</code>.
              Add one in <code>src/features/slideshow/mocks/index.js</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SlideshowPageFrame() {
  const { currentSlide } = useSlideshow();
  const MockComponent = currentSlide ? MOCKS_BY_SLIDE_ID[currentSlide.id] : null;

  return (
    <div className="slideshow-frame" style={{ width: "100%" }}>
      {MockComponent ? <MockComponent /> : <FallbackPage slide={currentSlide} />}
    </div>
  );
}
