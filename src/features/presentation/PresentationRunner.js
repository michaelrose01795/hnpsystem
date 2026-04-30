import { DemoDataProvider } from "./demoData/DemoDataProvider";
import { usePresentation } from "./PresentationProvider";
import PresentationPageFrame from "./PresentationPageFrame";
import PresentationOverlay from "./PresentationOverlay";
import PresentationDevOverlay from "./PresentationDevOverlay";
import useKeyboardNav from "./useKeyboardNav";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";

function EmptyState() {
  return (
    <div className="app-page-shell" style={{ padding: 40 }}>
      <div className="app-page-card">
        <div className="app-section-card">
          <h2 style={{ marginTop: 0 }}>No slides available for your role</h2>
          <p style={{ color: "var(--text-1)" }}>
            Presentation Mode has no pages matching your assigned roles. Try a role with broader access, or contact an administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PresentationRunner() {
  const { slides, authLoading } = usePresentation();
  useKeyboardNav();

  if (authLoading) return <PageSkeleton />;
  if (!slides || slides.length === 0) return <EmptyState />;

  return (
    <DemoDataProvider>
      <PresentationPageFrame />
      <PresentationOverlay />
      <PresentationDevOverlay />
    </DemoDataProvider>
  );
}
