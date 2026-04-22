import { DemoDataProvider } from "./demoData/DemoDataProvider";
import { useSlideshow } from "./SlideshowProvider";
import SlideshowPageFrame from "./SlideshowPageFrame";
import SlideshowOverlay from "./SlideshowOverlay";
import SlideshowDevOverlay from "./SlideshowDevOverlay";
import useKeyboardNav from "./useKeyboardNav";
import usePdfExport from "./usePdfExport";

function EmptyState() {
  return (
    <div className="app-page-shell" style={{ padding: 40 }}>
      <div className="app-page-card">
        <div className="app-section-card">
          <h2 style={{ marginTop: 0 }}>No slides available for your role</h2>
          <p style={{ color: "var(--text-secondary)" }}>
            The slideshow had no pages matching your assigned roles. Try logging in as a role with more access, or contact an administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SlideshowRunner() {
  const { slides } = useSlideshow();
  const { exportPdf } = usePdfExport();
  useKeyboardNav({ onExport: exportPdf });

  if (!slides || slides.length === 0) return <EmptyState />;

  return (
    <DemoDataProvider>
      <SlideshowPageFrame />
      <SlideshowOverlay />
      <SlideshowDevOverlay />
    </DemoDataProvider>
  );
}
