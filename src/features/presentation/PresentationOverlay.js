import { usePresentation } from "./PresentationProvider";
import PresentationCallout from "./PresentationCallout";
import PresentationHighlight from "./PresentationHighlight";

// Renders the current callout and its highlight ring without touching the
// main app dev layout overlay system.
export default function PresentationOverlay() {
  const { currentStep, stepIndex } = usePresentation();

  if (!currentStep) return null;

  return (
    <>
      <PresentationHighlight anchor={currentStep.anchor} />
      <PresentationCallout key={stepIndex} step={currentStep} />
    </>
  );
}
