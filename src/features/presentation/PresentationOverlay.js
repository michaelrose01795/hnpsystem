import { usePresentation } from "./PresentationProvider";
import PresentationCallout from "./PresentationCallout";
import PresentationHighlight from "./PresentationHighlight";

// Renders the current callout and its highlight ring without touching the
// main app dev layout overlay system.
export default function PresentationOverlay() {
  const { currentStep, stepIndex, overlayHidden } = usePresentation();

  if (!currentStep) return null;
  // User clicked "Hide" on the callout — stop painting the scrim, ring and
  // popup. The "Show overlay" button in the sidebar will flip this back on.
  if (overlayHidden) return null;

  return (
    <>
      <PresentationHighlight anchor={currentStep.anchor} />
      <PresentationCallout key={stepIndex} step={currentStep} />
    </>
  );
}
