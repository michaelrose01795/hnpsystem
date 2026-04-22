import { useSlideshow } from "./SlideshowProvider";

export default function SlideshowControls({ onExport, exportBusy }) {
  const { slides, slideIndex, stepIndex, currentSteps, next, prev, devOverlayOn, toggleDevOverlay, exit, currentSlide, userRoles } = useSlideshow();

  const slideCount = slides.length;
  const stepCount = currentSteps.length;
  const atStart = slideIndex === 0 && stepIndex === 0;
  const atEnd = slideIndex === slideCount - 1 && stepIndex === stepCount - 1;
  const primaryRole = (userRoles?.[0] || "viewer").toLowerCase();

  return (
    <div
      className="app-section-card"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 20,
        transform: "translateX(-50%)",
        zIndex: 10003,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        className="app-btn app-btn--ghost"
        onClick={prev}
        disabled={atStart}
        style={{ opacity: atStart ? 0.5 : 1 }}
      >
        ← Back
      </button>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 180 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          {currentSlide?.title || "—"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          Slide {slideIndex + 1} / {slideCount} · Step {stepIndex + 1} / {stepCount} · Role: {primaryRole}
        </div>
      </div>

      <button
        type="button"
        className="app-btn app-btn--primary"
        onClick={next}
        disabled={atEnd}
        style={{ opacity: atEnd ? 0.5 : 1 }}
      >
        Next →
      </button>

      <div style={{ width: 1, height: 28, background: "var(--border)" }} />

      <button
        type="button"
        className={devOverlayOn ? "app-btn app-btn--success" : "app-btn app-btn--ghost"}
        onClick={toggleDevOverlay}
        title="Toggle slideshow dev overlay (D)"
      >
        Dev
      </button>
      <button
        type="button"
        className="app-btn app-btn--ghost"
        onClick={onExport}
        disabled={exportBusy}
        title="Export deck to PDF (E)"
      >
        {exportBusy ? "Exporting…" : "Export PDF"}
      </button>
      <button
        type="button"
        className="app-btn app-btn--danger"
        onClick={exit}
        title="Exit slideshow (Esc)"
      >
        Exit
      </button>
    </div>
  );
}
