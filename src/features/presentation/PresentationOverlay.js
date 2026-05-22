import { usePresentation } from "./PresentationProvider";
import PresentationCallout from "./PresentationCallout";
import PresentationHighlight from "./PresentationHighlight";
import { DEFAULT_PRESENTATION_HIGHLIGHT_ANCHOR } from "./runtime/anchorVisibility";

// Renders the current callout and its highlight ring without touching the
// main app dev layout overlay system.
export default function PresentationOverlay() {
  const { currentSlide, currentStep, stepIndex, overlayHidden } = usePresentation();
  const isWebsiteSlide = String(currentSlide?.route || "").startsWith("/website");

  if (!currentStep) return null;
  // User clicked "Hide" on the callout — stop painting the scrim, ring and
  // popup. The "Show overlay" button in the sidebar will flip this back on.
  if (overlayHidden && !isWebsiteSlide) return null;
  const highlightAnchor = currentStep.anchor || DEFAULT_PRESENTATION_HIGHLIGHT_ANCHOR;

  return (
    <>
      <PresentationHighlight anchor={highlightAnchor} />
      <PresentationCallout key={stepIndex} step={currentStep} anchor={highlightAnchor} />
    </>
  );
}
