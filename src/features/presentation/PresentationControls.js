import { usePresentation } from "./PresentationProvider";

export default function PresentationControls({ onExport, exportBusy }) {
  const {
    slides,
    slideIndex,
    stepIndex,
    currentSteps,
    next,
    prev,
    devOverlayOn,
    toggleDevOverlay,
    exit,
    currentSlide,
    userRoles,
  } = usePresentation();

  const slideCount = slides.length;
  const stepCount = currentSteps.length;
  const atStart = slideIndex === 0 && stepIndex === 0;
  const atEnd = slideIndex === slideCount - 1 && stepIndex === stepCount - 1;
  const primaryRole = (userRoles?.[0] || "viewer").toLowerCase();

  return (
    <div
      data-presentation-controls
      data-presentation-callout="controls"
      className="app-section-card"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 10003,
        width: "min(calc(100vw - 24px), 900px)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px",
        boxShadow: "0 14px 42px rgba(0, 0, 0, 0.28)",
        pointerEvents: "auto",
        border: "1px solid rgba(var(--primary-rgb), 0.28)",
        background: "rgba(var(--surface-rgb), 0.96)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ display: "flex", gap: 8, minWidth: 0, flex: "0 0 auto" }}>
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
      </div>

      <div style={{ minWidth: 180, textAlign: "center", flex: "1 1 260px" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentSlide?.title || "Presentation"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          Slide {slideIndex + 1} of {slideCount} | Step {stepIndex + 1} of {stepCount} | Role: {primaryRole}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, minWidth: 0, flex: "0 0 auto" }}>
        <button
          type="button"
          className={devOverlayOn ? "app-btn app-btn--success app-btn--sm" : "app-btn app-btn--ghost app-btn--sm"}
          onClick={toggleDevOverlay}
          title="Toggle Presentation dev overlay"
          aria-pressed={devOverlayOn}
        >
          Dev
        </button>
        <button
          type="button"
          className="app-btn app-btn--ghost app-btn--sm"
          onClick={onExport}
          disabled={exportBusy}
          title="Export Presentation PDF"
        >
          {exportBusy ? "Exporting" : "Export"}
        </button>
        <button
          type="button"
          className="app-btn app-btn--danger app-btn--sm"
          onClick={exit}
          title="Exit Presentation Mode"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
