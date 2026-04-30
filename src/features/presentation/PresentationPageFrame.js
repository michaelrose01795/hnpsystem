import { usePresentation } from "./PresentationProvider";
import { MOCKS_BY_SLIDE_ID } from "./mocks";

function FallbackPage({ slide }) {
  return (
    <div className="app-page-shell">
      <div className="app-page-card">
        <div className="app-page-stack">
          <div className="app-section-card">
            <h1 style={{ marginTop: 0 }}>{slide?.title || "Presentation page"}</h1>
            <p style={{ color: "var(--text-1)" }}>
              No Presentation mock is registered for <code>{slide?.id}</code>.
              Add one in <code>src/features/presentation/mocks/index.js</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PresentationPageFrame() {
  const { currentSlide } = usePresentation();
  const MockComponent = currentSlide ? MOCKS_BY_SLIDE_ID[currentSlide.id] : null;

  return (
    <div
      data-presentation-frame
      style={{
        width: "100%",
        minHeight: "100%",
        paddingBottom: "24px",
      }}
    >
      {MockComponent ? <MockComponent /> : <FallbackPage slide={currentSlide} />}
    </div>
  );
}
