import { DemoDataProvider } from "./demoData/DemoDataProvider";
import { usePresentation } from "./PresentationProvider";
import PresentationPageFrame from "./PresentationPageFrame";
import PresentationOverlay from "./PresentationOverlay";
import PresentationDevOverlay from "./PresentationDevOverlay";
import useKeyboardNav from "./useKeyboardNav";

function EmptyState() {
  return (
    <div className="app-page-shell" style={{ padding: 40 }}>
      <div className="app-page-card">
        <div className="app-section-card">
          <h2 style={{ marginTop: 0 }}>No slides available for your role</h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Presentation Mode has no pages matching your assigned roles. Try a role with broader access, or contact an administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PresentationRunner() {
  const { slides } = usePresentation();
  useKeyboardNav();

  if (!slides || slides.length === 0) return <EmptyState />;

  return (
    <DemoDataProvider>
      <PresentationPageFrame />
      <PresentationOverlay />
      <PresentationDevOverlay />
    </DemoDataProvider>
  );
}
